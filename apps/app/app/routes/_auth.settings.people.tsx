import { data } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/_auth.settings.people'
import { sendInvitationEmail } from '~/api/auth/server'
import {
	MemberError,
	changeMemberRole,
	createInvitation,
	removeMember,
	renewInvitation,
	getPeopleOverview,
	revokeInvitation,
	setMemberGroups,
} from '~/api/members/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { pageTitle } from '~/lib/seo'
import { getRequestOrigin } from '~/lib/supabase.server'
import { PeopleSettingsModule } from '~/modules'

const role = z.enum(['ADMIN', 'MEMBER'])
const uuid = z.uuid()

const actionSchema = z.discriminatedUnion('intent', [
	z.object({
		intent: z.literal('invite'),
		email: z
			.email('Enter a valid email address.')
			.transform((value) => value.toLowerCase()),
		role,
		group_id: z.union([uuid, z.literal('')]).optional(),
	}),
	z.object({ intent: z.literal('change-role'), membership_id: uuid, role }),
	z.object({
		intent: z.literal('set-groups'),
		membership_id: uuid,
		group_ids: z.array(uuid),
	}),
	z.object({ intent: z.literal('revoke'), invitation_id: uuid }),
	z.object({ intent: z.literal('remove'), membership_id: uuid }),
	z.object({ intent: z.literal('resend'), invitation_id: uuid }),
])

export type PeopleActionResult = {
	ok: boolean
	message?: string
	error?: string
}

const INVITE_MESSAGES = {
	sent: (email: string) => `Invitation sent to ${email}.`,
	'existing-account': (email: string) =>
		`Invitation saved. ${email} already has a Dossier account, so they’ll see it in their workspace switcher next time they open Dossier.`,
	'not-configured': (email: string) =>
		`Invitation saved for ${email}, but no email was sent because invitation emails aren’t set up yet.`,
	failed: (email: string) =>
		`Invitation saved for ${email}, but the email couldn’t be sent. Try again later.`,
}

const RESEND_MESSAGES = {
	sent: (email: string) =>
		`Sent a new link to ${email}. The invitation is good for another 7 days.`,
	'existing-account': (email: string) =>
		`Extended for 7 days. ${email} already uses Dossier, so they’ll see it in their workspace switcher.`,
	'not-configured': () =>
		'Extended for 7 days, but no email was sent because invitation emails aren’t set up yet.',
	failed: () =>
		'Extended for 7 days, but the email couldn’t be sent. Try again later.',
}

export async function loader({ context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'members.read')
	return getPeopleOverview(session.organization.id)
}

export async function action({ request, context }: Route.ActionArgs) {
	const session = requireSession(context)
	const form = await request.formData()
	const parsed = actionSchema.safeParse({
		...Object.fromEntries(form),
		group_ids: form.getAll('group_ids'),
	})
	if (!parsed.success) {
		return data<PeopleActionResult>(
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
			case 'invite': {
				requirePermission(session, 'members.invite')
				await createInvitation(organizationId, actorId, {
					email: input.email,
					role: input.role,
					groupIds: input.group_id ? [input.group_id] : [],
				})
				const delivery = await sendInvitationEmail(
					input.email,
					`${getRequestOrigin(request)}/auth/callback?next=/`,
				)
				return {
					ok: delivery !== 'failed',
					message: INVITE_MESSAGES[delivery](input.email),
				}
			}
			case 'change-role':
				requirePermission(session, 'roles.manage')
				await changeMemberRole(
					organizationId,
					actorId,
					input.membership_id,
					input.role,
				)
				return { ok: true }
			case 'set-groups':
				requirePermission(session, 'groups.manage')
				await setMemberGroups(
					organizationId,
					actorId,
					input.membership_id,
					input.group_ids,
				)
				return { ok: true }
			case 'resend': {
				requirePermission(session, 'members.invite')
				const email = await renewInvitation(
					organizationId,
					actorId,
					input.invitation_id,
				)
				const delivery = await sendInvitationEmail(
					email,
					`${getRequestOrigin(request)}/auth/callback?next=/`,
				)
				return {
					ok: delivery !== 'failed',
					message: RESEND_MESSAGES[delivery](email),
				}
			}
			case 'remove':
				requirePermission(session, 'members.remove')
				await removeMember(organizationId, actorId, input.membership_id)
				return { ok: true }
			case 'revoke':
				requirePermission(session, 'members.invite')
				await revokeInvitation(organizationId, actorId, input.invitation_id)
				return { ok: true }
		}
	} catch (error) {
		if (error instanceof MemberError)
			return data<PeopleActionResult>(
				{ ok: false, error: error.message },
				{ status: 400 },
			)
		throw error
	}
}

export const meta = () => pageTitle('People')

export default PeopleSettingsModule
