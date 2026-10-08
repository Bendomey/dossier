/**
 * Liveness check for Fly. Deliberately touches nothing outside the process
 * (no Supabase, no database), so a misconfigured secret or a slow dependency
 * shows up as errors on real pages instead of a deploy that never goes healthy.
 */
export function loader() {
	return new Response('ok', {
		headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
	})
}
