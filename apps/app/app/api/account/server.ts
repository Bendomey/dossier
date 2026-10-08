import { db } from '~/lib/db.server'

export async function updateProfileName(userId: string, displayName: string) {
	const [firstName, ...rest] = displayName.split(/\s+/)
	await db().profile.update({
		where: { id: userId },
		data: { displayName, firstName, lastName: rest.join(' ') || null },
	})
}
