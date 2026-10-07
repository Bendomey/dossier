import './app.css'

import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
import {
	data,
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useRouteLoaderData,
} from 'react-router'
import type { Route } from './+types/root'
import { GoogleAnalytics } from './components/google-analytics'
import { TopbarLoader } from './components/top-bar-loader'
import { environmentVariables } from './lib/actions/env.server'
import { getLanguage } from './lib/i18n/language.server'
import { DEFAULT_LANGUAGE } from './lib/i18n/languages'
import { getMessages } from './lib/i18n/translate.server'
import { resolveUtm } from './lib/utm.server'
import { NotFoundModule } from './modules/404-page'
import { Providers } from './providers'

dayjs.locale('en-gb')
dayjs.extend(localizedFormat)

export const links: Route.LinksFunction = () => [
	{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
	{
		rel: 'preconnect',
		href: 'https://fonts.gstatic.com',
		crossOrigin: 'anonymous',
	},
	{
		rel: 'stylesheet',
		href: 'https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap',
	},
	{ rel: 'manifest', href: '/manifest.webmanifest' },
	{ rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
	{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
	{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
]

export async function loader({ request }: Route.LoaderArgs) {
	const env = environmentVariables()
	const language = await getLanguage(request)
	const { utm, setCookie } = await resolveUtm(request)

	return data(
		{
			ENV: {
				API_ADDRESS: env.API_ADDRESS,
				GOOGLE_ANALYTICS_ID: env.GOOGLE_ANALYTICS_ID,
			},
			language,
			messages: await getMessages(language),
			utm,
		},
		setCookie ? { headers: { 'Set-Cookie': setCookie } } : undefined,
	)
}

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useRouteLoaderData<typeof loader>('root')

	return (
		<html
			lang={data?.language ?? DEFAULT_LANGUAGE}
			className="scroll-smooth antialiased"
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta
					name="theme-color"
					content="#ffffff"
					media="(prefers-color-scheme: light)"
				/>
				<meta
					name="theme-color"
					content="#0c0d0f"
					media="(prefers-color-scheme: dark)"
				/>
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-title" content="Dossier" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<TopbarLoader />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export default function App() {
	const { ENV } = useLoaderData<typeof loader>()

	if (typeof window !== 'undefined') {
		window.ENV = ENV
	}
	return (
		<Providers>
			<GoogleAnalytics gaId={ENV.GOOGLE_ANALYTICS_ID} />
			<Outlet />
		</Providers>
	)
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = 'Oops!'
	let details = 'An unexpected error occurred.'
	let status = 500

	if (isRouteErrorResponse(error)) {
		status = error.status
		if (error.status === 403) {
			message = 'Forbidden'
			details = "You don't have permission to access this page."
		} else if (error.status === 404) {
			return <NotFoundModule />
		} else {
			message = 'Error'
			details = error.statusText || details
		}
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		message = error.message
		details = error.stack || details
	}

	return <NotFoundModule title={message} message={details} status={status} />
}
