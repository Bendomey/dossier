import { useEffect, useRef, useState } from 'react'
import { useNavigation, useSubmit } from 'react-router'

export type EmailLinkStatus = 'none' | 'signing-in' | 'expired' | 'failed'

/**
 * Supabase's default invite and recovery emails sign people in by putting the
 * session after the `#`, which never reaches the server. This reads it, clears
 * it from the address bar and posts it to /auth/session.
 */
export function useEmailLinkSession(): EmailLinkStatus {
	const submit = useSubmit()
	const navigation = useNavigation()
	const handled = useRef(false)
	const sawSubmission = useRef(false)
	const [status, setStatus] = useState<EmailLinkStatus>('none')

	// A refused link redirects back to /login, which stays mounted.
	useEffect(() => {
		if (status !== 'signing-in') return
		if (navigation.state !== 'idle') sawSubmission.current = true
		else if (sawSubmission.current) setStatus('failed')
	}, [navigation.state, status])

	useEffect(() => {
		if (handled.current || !window.location.hash) return
		handled.current = true

		const params = new URLSearchParams(window.location.hash.slice(1))
		const accessToken = params.get('access_token')
		const refreshToken = params.get('refresh_token')
		const errorCode = params.get('error_code') ?? params.get('error')
		if (!accessToken && !errorCode) return

		window.history.replaceState(
			null,
			'',
			window.location.pathname + window.location.search,
		)

		if (accessToken && refreshToken) {
			setStatus('signing-in')
			void submit(
				{
					access_token: accessToken,
					refresh_token: refreshToken,
					type: params.get('type') ?? '',
				},
				{ method: 'post', action: '/auth/session', replace: true },
			)
		} else {
			setStatus(errorCode === 'otp_expired' ? 'expired' : 'failed')
		}
	}, [submit])

	return status
}
