import { createClient } from '@supabase/supabase-js'
import { environmentVariables } from './actions/env.server'

/**
 * Supabase with the secret key, for the few operations that need admin rights
 * (sending invitations). It bypasses every access rule: server-only, and never
 * created from anything a browser sends.
 */
export function createSupabaseAdminClient() {
	const { SUPABASE_URL, SUPABASE_SECRET_KEY } = environmentVariables()
	if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null
	return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	})
}
