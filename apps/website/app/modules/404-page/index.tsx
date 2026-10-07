import { useNavigate } from 'react-router'
import { Button } from '~/components/arc/button/button'
import { Container } from '~/components/layout/container'
import { Page } from '~/components/layout/page'
import { useTranslation } from '~/lib/i18n/use-translation'

interface Props {
	status?: number
	title?: string
	message?: string
}

export function NotFoundModule({ status = 404, title, message }: Props) {
	const navigate = useNavigate()
	const { t } = useTranslation()

	return (
		<Page>
			<Container className="py-20 sm:py-32">
				<div className="mx-auto max-w-2xl text-center">
					<p className="text-muted-foreground text-sm tabular-nums">{status}</p>
					<h1 className="font-display mt-2 text-4xl font-medium tracking-tight break-words">
						{title ?? t('notFound.title')}
					</h1>
					<p className="text-muted-foreground mt-4 text-lg break-words">
						{message || t('notFound.message')}
					</p>
					<div className="mt-8 flex justify-center">
						<Button onClick={() => navigate('/')}>{t('notFound.cta')}</Button>
					</div>
				</div>
			</Container>
		</Page>
	)
}
