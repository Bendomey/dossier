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
	useRouteLoaderData,
} from 'react-router'
import type { Route } from './+types/root'
import { TopbarLoader } from './components/top-bar-loader'
import { environmentVariables } from './lib/actions/env.server'
import { getTheme } from './lib/actions/theme.server'
import { resolveUtm } from './lib/utm.server'
import { ErrorModule } from './modules/error'
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
		href: 'https://fonts.googleapis.com/css2?family=Geist:wght@300..600&family=Geist+Mono:wght@400;500&display=swap',
	},
	{ rel: 'manifest', href: '/manifest.webmanifest' },
	{ rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
	{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
	{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
]

export async function loader({ request }: Route.LoaderArgs) {
	const { utm, setCookie } = await resolveUtm(request)

	return data(
		{
			theme: new URL(request.url).pathname.startsWith('/demo')
				? ('light' as const)
				: await getTheme(request),
			ENV: { API_ADDRESS: environmentVariables().API_ADDRESS },
			utm,
		},
		setCookie ? { headers: { 'Set-Cookie': setCookie } } : undefined,
	)
}

/* Resolves the system theme before first paint so dark mode never flashes light. */
const SYSTEM_THEME_SCRIPT = `document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useRouteLoaderData<typeof loader>('root')
	const theme = data?.theme ?? 'system'

	return (
		<html
			lang="en"
			data-theme={theme === 'system' ? undefined : theme}
			suppressHydrationWarning
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="apple-mobile-web-app-title" content="Dossier" />
				{theme === 'system' ? (
					<script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
				) : null}
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

export default function App({ loaderData }: Route.ComponentProps) {
	if (typeof window !== 'undefined') {
		window.ENV = loaderData.ENV
	}

	return (
		<Providers>
			<Outlet />
		</Providers>
	)
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	if (isRouteErrorResponse(error) && error.status === 404) {
		return <ErrorModule status={404} />
	}

	const details =
		import.meta.env.DEV && error instanceof Error ? error.message : undefined
	return (
		<ErrorModule
			status={isRouteErrorResponse(error) ? error.status : 500}
			details={details}
		/>
	)
}
