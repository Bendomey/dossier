/**
 * The site has no service worker. Browsers that kept one registered for this
 * origin (e.g. another app previously served on the same localhost port) keep
 * requesting /sw.js, so serve one that unregisters itself.
 */
const SCRIPT = `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => {
	self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
		clients.forEach((client) => client.navigate(client.url))
	})
})
`

export function loader() {
	return new Response(SCRIPT, {
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	})
}
