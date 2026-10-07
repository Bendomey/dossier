import { Link } from 'react-router'
import { Logo } from '~/components/layout/logo'
import { useWebsiteUrl } from '~/lib/use-website-url'

interface Props {
	switchLead: string
	switchLabel: string
	switchTo: string
	title: string
	description: string
	children: React.ReactNode
}

export function AuthLayout({
	switchLead,
	switchLabel,
	switchTo,
	title,
	description,
	children,
}: Props) {
	const websiteUrl = useWebsiteUrl()

	return (
		<div className="flex min-h-dvh flex-col">
			<header className="flex items-center justify-between px-4 py-5 md:px-10">
				<a href={websiteUrl('/', 'auth_logo')} className="text-foreground">
					<Logo />
				</a>
				<p className="text-secondary text-sm">
					{switchLead}{' '}
					<Link
						to={switchTo}
						className="text-foreground font-medium hover:underline"
					>
						{switchLabel}
					</Link>
				</p>
			</header>
			<main className="flex flex-1 items-center justify-center px-4 pt-6 pb-16">
				<div className="animate-in fade-in slide-in-from-bottom-1.5 flex w-full max-w-[400px] flex-col gap-6 duration-350">
					<div className="flex flex-col gap-2 text-center">
						<h1 className="font-heading text-[34px] leading-[1.1] font-medium tracking-[-0.03em]">
							{title}
						</h1>
						<p className="text-secondary text-[15px]">{description}</p>
					</div>
					{children}
					<p className="text-muted text-center text-[13px] leading-normal">
						By continuing you agree to the{' '}
						<a
							href={websiteUrl('/terms', 'auth_terms')}
							className="text-accent hover:underline"
						>
							Terms
						</a>{' '}
						and{' '}
						<a
							href={websiteUrl('/privacy', 'auth_privacy')}
							className="text-accent hover:underline"
						>
							Privacy policy
						</a>
						.
					</p>
				</div>
			</main>
		</div>
	)
}
