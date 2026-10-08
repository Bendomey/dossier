import { data } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/_auth.settings.groups'
import {
	createGroup,
	deleteGroup,
	getGroupsOverview,
	renameGroup,
	setCollectionAccess,
	setGroupMember,
} from '~/api/groups/server'
import { MemberError } from '~/api/members/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { pageTitle } from '~/lib/seo'
import { GroupsSettingsModule } from '~/modules'

const uuid = z.uuid()
const flag = z.enum(['true', 'false']).transform((value) => value === 'true')

const actionSchema = z.discriminatedUnion('intent', [
	z.object({
		intent: z.literal('create'),
		name: z
			.string()
			.trim()
			.min(1, 'Give the group a name.')
			.max(80, 'Keep the name under 80 characters.'),
		membership_ids: z.array(uuid),
		collection_ids: z.array(uuid),
	}),
	z.object({
		intent: z.literal('rename'),
		group_id: uuid,
		name: z
			.string()
			.trim()
			.min(1, 'Give the group a name.')
			.max(80, 'Keep the name under 80 characters.'),
	}),
	z.object({ intent: z.literal('delete'), group_id: uuid }),
	z.object({
		intent: z.literal('member'),
		group_id: uuid,
		membership_id: uuid,
		included: flag,
	}),
	z.object({
		intent: z.literal('collection'),
		group_id: uuid,
		collection_id: uuid,
		visible: flag,
	}),
])

export type GroupsActionResult = {
	ok: boolean
	error?: string
	group_id?: string
}

export async function loader({ context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'members.read')
	return getGroupsOverview(session.organization.id)
}

export async function action({ request, context }: Route.ActionArgs) {
	const session = requireSession(context)
	const form = await request.formData()
	const parsed = actionSchema.safeParse({
		...Object.fromEntries(form),
		membership_ids: form.getAll('membership_ids'),
		collection_ids: form.getAll('collection_ids'),
	})
	if (!parsed.success) {
		return data<GroupsActionResult>(
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
				requirePermission(session, 'groups.manage')
				if (input.collection_ids.length) {
					requirePermission(session, 'collections.manage')
				}
				const group = await createGroup(organizationId, actorId, {
					name: input.name,
					membershipIds: input.membership_ids,
					collectionIds: input.collection_ids,
				})
				return { ok: true, group_id: group.id }
			}
			case 'rename':
				requirePermission(session, 'groups.manage')
				await renameGroup(organizationId, actorId, input.group_id, input.name)
				return { ok: true }
			case 'delete':
				requirePermission(session, 'groups.manage')
				await deleteGroup(organizationId, actorId, input.group_id)
				return { ok: true }
			case 'member':
				requirePermission(session, 'groups.manage')
				await setGroupMember(organizationId, actorId, {
					groupId: input.group_id,
					membershipId: input.membership_id,
					included: input.included,
				})
				return { ok: true }
			case 'collection':
				requirePermission(session, 'collections.manage')
				await setCollectionAccess(organizationId, actorId, {
					groupId: input.group_id,
					collectionId: input.collection_id,
					visible: input.visible,
				})
				return { ok: true }
		}
	} catch (error) {
		if (error instanceof MemberError) {
			return data<GroupsActionResult>(
				{ ok: false, error: error.message },
				{ status: 400 },
			)
		}
		throw error
	}
}

export const meta = () => pageTitle('Groups')

export default GroupsSettingsModule
