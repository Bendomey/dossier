import { data } from 'react-router'
import { pageTitle } from '~/lib/seo'
import { NotFoundModule } from '~/modules'

export function loader() {
	return data(null, { status: 404 })
}

export const meta = () => pageTitle('Page not found')

export default NotFoundModule
