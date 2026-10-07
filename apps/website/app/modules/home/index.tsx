import { useState } from 'react'
import { Access } from './access'
import { type DemoTab } from './content'
import { Features } from './features'
import { Hero } from './hero'
import { ProductDemo } from './product-demo'
import { Security } from './security'
import { Steps } from './steps'
import { Page } from '~/components/layout/page'

export function Home() {
	const [tab, setTab] = useState<DemoTab>('ask')

	function tryInProduct(next: DemoTab) {
		setTab(next)
		document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
	}

	return (
		<Page>
			<Hero />
			<ProductDemo tab={tab} onTabChange={setTab} />
			<Features onTry={tryInProduct} />
			<Steps />
			<Security />
			<Access />
		</Page>
	)
}
