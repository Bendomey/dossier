import {
	type AuthError,
	type EmailOtpType,
	type SupabaseClient,
} from '@supabase/supabase-js'

export type AuthField = 'name' | 'company' | 'email' | 'password' | 'form'

export interface AuthFailure {
	error: string
	field: AuthField
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/
const MIN_PASSWORD_LENGTH = 8

/** Turns Supabase Auth errors into copy for the form field they belong to. */
function toFailure(error: AuthError): AuthFailure {
	switch (error.code) {
		case 'invalid_credentials':
			return {
				field: 'password',
				error: 'That email and password don’t match.',
			}
		case 'email_not_confirmed':
			return {
				field: 'email',
				error: 'Confirm your email first. Check your inbox for the link.',
			}
		case 'user_already_exists':
		case 'email_exists':
			return {
				field: 'email',
				error: 'An account with this email already exists. Sign in instead.',
			}
		case 'weak_password':
			return { field: 'password', error: 'Choose a stronger password.' }
		case 'same_password':
			return {
				field: 'password',
				error: 'Choose a password you haven’t used for this account before.',
			}
		case 'email_address_invalid':
			return { field: 'email', error: 'Enter a valid work email.' }
		case 'over_email_send_rate_limit':
		case 'over_request_rate_limit':
			return {
				field: 'form',
				error: 'Too many attempts. Wait a minute and try again.',
			}
		default:
			return {
				field: 'form',
				error: 'Something went wrong. Try again in a moment.',
			}
	}
}

export async function signInWithPassword(
	supabase: SupabaseClient,
	input: { email: string; password: string },
): Promise<AuthFailure | null> {
	if (!EMAIL_PATTERN.test(input.email))
		return { field: 'email', error: 'Enter a valid work email.' }
	if (!input.password)
		return { field: 'password', error: 'Enter your password.' }

	const { error } = await supabase.auth.signInWithPassword(input)
	return error ? toFailure(error) : null
}

/**
 * Creates the account. Name and company travel in user metadata: the profile
 * trigger reads the name, and the workspace is created from the company once
 * the person has a session (immediately, or after confirming their email).
 */
export async function signUp(
	supabase: SupabaseClient,
	input: {
		name: string
		company: string
		email: string
		password: string
		utm: Record<string, string>
		emailRedirectTo: string
	},
): Promise<AuthFailure | { hasSession: boolean }> {
	if (!input.name.trim()) return { field: 'name', error: 'Enter your name.' }
	if (!input.company.trim())
		return { field: 'company', error: 'Enter your company name.' }
	if (!EMAIL_PATTERN.test(input.email))
		return { field: 'email', error: 'Enter a valid work email.' }
	if (input.password.length < MIN_PASSWORD_LENGTH) {
		return { field: 'password', error: 'Use at least 8 characters.' }
	}

	const { data, error } = await supabase.auth.signUp({
		email: input.email,
		password: input.password,
		options: {
			emailRedirectTo: input.emailRedirectTo,
			data: {
				full_name: input.name.trim(),
				company: input.company.trim(),
				...(Object.keys(input.utm).length ? { utm: input.utm } : {}),
			},
		},
	})
	if (error) return toFailure(error)

	// With email confirmation on, an existing address returns a user with no
	// identities and no error, so callers cannot tell accounts apart.
	return { hasSession: Boolean(data.session) }
}

export async function startOAuth(
	supabase: SupabaseClient,
	provider: 'google',
	redirectTo: string,
): Promise<{ url: string } | AuthFailure> {
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider,
		options: { redirectTo },
	})
	if (error || !data.url) {
		return {
			field: 'form',
			error:
				'Google sign-in isn’t available right now. Use your email instead.',
		}
	}
	return { url: data.url }
}

/** Completes an OAuth sign-in or an email link and stores the session in cookies. */
export async function completeAuthRedirect(
	supabase: SupabaseClient,
	params: URLSearchParams,
): Promise<AuthFailure | null> {
	const code = params.get('code')
	const tokenHash = params.get('token_hash')
	const type = params.get('type') as EmailOtpType | null

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code)
		return error ? toFailure(error) : null
	}
	if (tokenHash && type) {
		const { error } = await supabase.auth.verifyOtp({
			token_hash: tokenHash,
			type,
		})
		return error ? toFailure(error) : null
	}
	return {
		field: 'form',
		error: 'That sign-in link is incomplete or has expired.',
	}
}

/**
 * Emails a password-reset link. Succeeds whether or not the address has an
 * account, so the form cannot be used to discover who signed up.
 */
export async function requestPasswordReset(
	supabase: SupabaseClient,
	email: string,
	redirectTo: string,
): Promise<AuthFailure | null> {
	if (!EMAIL_PATTERN.test(email))
		return { field: 'email', error: 'Enter a valid work email.' }

	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo,
	})
	if (
		error?.code === 'over_email_send_rate_limit' ||
		error?.code === 'over_request_rate_limit'
	) {
		return toFailure(error)
	}
	if (error)
		console.error('Password reset email failed', error.code ?? error.message)
	return null
}

/**
 * Sets a new password for the signed-in person (a recovery link signs them
 * in) and ends their other sessions, in case someone else knew the old one.
 */
export async function updatePassword(
	supabase: SupabaseClient,
	password: string,
): Promise<AuthFailure | null> {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return { field: 'password', error: 'Use at least 8 characters.' }
	}

	const { error } = await supabase.auth.updateUser({ password })
	if (error) return toFailure(error)

	await supabase.auth.signOut({ scope: 'others' })
	return null
}

/** Verified claims for the request's session, or null when signed out. */
export async function getSessionClaims(supabase: SupabaseClient) {
	const { data, error } = await supabase.auth.getClaims()
	if (error || !data?.claims.sub) return null
	return data.claims
}
