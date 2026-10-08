import { GROUPS, MEMBERS } from '~/lib/mock/seed'
import { pageTitle } from '~/lib/seo'
import { PeopleSettingsModule } from '~/modules'

export function loader(): PeopleOverview {
	const members = MEMBERS.filter((member) => !member.invited)
	return {
		next_cursor: null,
		total_members: members.length,
		role_counts: {
			OWNER: members.filter((member) => member.role === 'OWNER').length,
			ADMIN: members.filter((member) => member.role === 'ADMIN').length,
			MEMBER: members.filter((member) => member.role === 'MEMBER').length,
		},
		members: MEMBERS.filter((member) => !member.invited).map((member) => ({
			membership_id: member.id,
			user_id: member.id,
			name: member.name,
			email: member.email,
			avatar_url: null,
			role: member.role,
			group_ids: member.group_ids,
		})),
		invitations: MEMBERS.filter((member) => member.invited).map((member) => ({
			id: member.id,
			email: member.email,
			role: member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
			group_ids: member.group_ids,
			expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
			expired: false,
		})),
		groups: GROUPS.map((group) => ({
			id: group.id,
			name: group.name,
			is_system: group.is_builtin,
		})),
	}
}

export function action() {
	return {
		ok: false,
		error:
			'The demo doesn’t save changes. Create a workspace to invite your team.',
	}
}

export const meta = () => pageTitle('People')

export default PeopleSettingsModule
