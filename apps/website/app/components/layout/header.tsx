import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { Container } from './container'
import { LanguageSelect } from './language-select'
import { Logo } from './logo'
import { APP_URL } from '~/lib/constants'
import { type MessageKey } from '~/lib/i18n/messages'
import { useTranslation } from '~/lib/i18n/use-translation'
import { cn } from '~/lib/utils'

const NAV_LINKS: Array<{ key: MessageKey; href: string }> = [
	{ key: 'nav.product', href: '/#product' },
	{ key: 'nav.security', href: '/#security' },
	{ key: 'nav.pricing', href: '/pricing' },
	{ key: 'nav.contact', href: '/#contact' },
]

export function Header() {
	const [menuOpen, setMenuOpen] = useState(false)
	const { t } = useTranslation()

	return (
		<header className="bg-background/90 sticky top-0 z-10 border-b backdrop-blur-md">
			<Container className="flex h-16 items-center gap-6">
				<Logo />
				<nav className="hidden flex-1 flex-wrap gap-7 text-sm md:flex">
					{NAV_LINKS.map((link) => (
						<NavLink
							key={link.key}
							to={link.href}
							end
							className={({ isActive }) =>
								cn(
									'hover:text-brand',
									isActive &&
										link.href.startsWith('/') &&
										!link.href.includes('#')
										? 'text-foreground font-medium'
										: 'text-muted-foreground',
								)
							}
						>
							{t(link.key)}
						</NavLink>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-2 text-sm sm:gap-3">
					<LanguageSelect />
					<a
						href={APP_URL}
						className="text-muted-foreground hover:text-brand hidden px-2 md:block"
					>
						{t('nav.signIn')}
					</a>
					<Link
						to="/#access"
						className="bg-foreground text-background rounded-full px-4 py-[9px] font-medium whitespace-nowrap hover:opacity-90"
					>
						{t('nav.startFree')}
					</Link>
					<button
						type="button"
						aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen((open) => !open)}
						className="border-input bg-background flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border md:hidden"
					>
						{menuOpen ? (
							<X className="size-4" strokeWidth={1.5} />
						) : (
							<Menu className="size-4" strokeWidth={1.5} />
						)}
					</button>
				</div>
			</Container>
			{menuOpen ? (
				<nav className="bg-background animate-in fade-in slide-in-from-top-2 flex flex-col border-t px-5 pt-2 pb-6 duration-250 md:hidden">
					{[...NAV_LINKS, { key: 'nav.signIn' as const, href: APP_URL }].map(
						(link, index, links) => (
							<Link
								key={link.key}
								to={link.href}
								onClick={() => setMenuOpen(false)}
								className={cn(
									'py-4 text-[17px]',
									index < links.length - 1 &&
										'border-b border-[#f0f0f2] dark:border-white/5',
								)}
							>
								{t(link.key)}
							</Link>
						),
					)}
				</nav>
			) : null}
		</header>
	)
}
