import { data } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/_auth.knowledge'
import {
	COLLECTION_ICONS,
	createCollection,
	deleteCollection,
	getKnowledgeOverview,
	updateCollection,
} from '~/api/collections/server'
import { MemberError } from '~/api/members/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { pageTitle } from '~/lib/seo'
import { KnowledgeModule } from '~/modules'

export const handle = { title: 'Knowledge' }

const uuid = z.uuid()
const fields = {
	name: z
		.string()
		.trim()
		.min(1, 'Give the collection a name.')
		.max(80, 'Keep the name under 80 characters.'),
	description: z
		.string()
		.trim()
		.max(280, 'Keep the description under 280 characters.')
		.transform((value) => value || null),
	icon: z.enum(COLLECTION_ICONS),
	group_ids: z.array(uuid),
}

const actionSchema = z.discriminatedUnion('intent', [
	z.object({ intent: z.literal('create'), ...fields }),
	z.object({ intent: z.literal('update'), collection_id: uuid, ...fields }),
	z.object({ intent: z.literal('delete'), collection_id: uuid }),
])

export type KnowledgeActionResult = {
	ok: boolean
	error?: string
	collection_id?: string
}

export function loader({ request, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'documents.read')
	const params = new URL(request.url).searchParams
	return getKnowledgeOverview(session, {
		collectionId: params.get('collection') ?? undefined,
		templatesOnly: params.get('view') === 'templates',
		query: params.get('q')?.trim() || undefined,
	})
}

export async function action({ request, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'collections.manage')
	const form = await request.formData()
	const parsed = actionSchema.safeParse({
		...Object.fromEntries(form),
		group_ids: form.getAll('group_ids'),
	})
	if (!parsed.success) {
		return data<KnowledgeActionResult>(
			{
				ok: false,
				error:
					parsed.error.issues[0]?.message ?? 'Check the details and try again.',
			},
			{ status: 400 },
		)
	}

	const input = parsed.data
	const organizationId = session.organization.id
	const actorId = session.user.id
	try {
		switch (input.intent) {
			case 'create': {
				const collection = await createCollection(organizationId, actorId, {
					name: input.name,
					description: input.description,
					icon: input.icon,
					groupIds: input.group_ids,
				})
				return { ok: true, collection_id: collection.id }
			}
			case 'update':
				await updateCollection(organizationId, actorId, input.collection_id, {
					name: input.name,
					description: input.description,
					icon: input.icon,
					groupIds: input.group_ids,
				})
				return { ok: true, collection_id: input.collection_id }
			case 'delete':
				await deleteCollection(organizationId, actorId, input.collection_id)
				return { ok: true }
		}
	} catch (error) {
		if (error instanceof MemberError) {
			return data<KnowledgeActionResult>(
				{ ok: false, error: error.message },
				{ status: 400 },
			)
		}
		throw error
	}
}

export const meta = () => pageTitle('Knowledge')

export default KnowledgeModule
