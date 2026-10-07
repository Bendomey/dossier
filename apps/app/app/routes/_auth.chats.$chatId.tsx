import { pageTitle } from '~/lib/seo'
import { ChatModule } from '~/modules'

export const handle = { title: 'Chat' }

export const meta = () => pageTitle('Chat')

export default ChatModule
