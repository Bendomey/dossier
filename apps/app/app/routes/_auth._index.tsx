import { pageTitle } from '~/lib/seo'
import { WorkspaceModule } from '~/modules'

export const handle = { title: 'Workspace' }

export const meta = () => pageTitle('Workspace')

export default WorkspaceModule
