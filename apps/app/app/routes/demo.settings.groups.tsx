import { COLLECTIONS, GROUPS, MEMBERS } from '~/lib/mock/seed'
import { pageTitle } from '~/lib/seo'
import { GroupsSettingsModule } from '~/modules'

export function loader(): GroupsOverview {
	const members = MEMBERS.filter((member) => !member.invited)
	return {
		groups: GROUPS.map((group) => ({
			id: group.id,
			name: group.name,
			is_system: group.is_builtin,
			membership_ids: group.is_builtin
				? members.map((member) => member.id)
				: members
						.filter((member) => member.group_ids.includes(group.id))
						.map((member) => member.id),
			collection_ids: COLLECTIONS.filter((collection) =>
				collection.group_ids.includes(group.id),
			).map((collection) => collection.id),
		})),
		members: members.map((member) => ({
			membership_id: member.id,
			name: member.name,
			role: member.role,
		})),
		collections: COLLECTIONS.map((collection) => ({
			id: collection.id,
			name: collection.name,
		})),
	}
}

export function action() {
	return {
		ok: false,
		error:
			'The demo doesn’t save changes. Create a workspace to set up your groups.',
	}
}

export const meta = () => pageTitle('Groups')

export default GroupsSettingsModule
