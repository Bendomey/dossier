import { withClient } from './db'
import type { WorkerEnv } from './env'
import { log } from './message'

const MIN_AGE_MS = 24 * 60 * 60 * 1000
const OWNED_KEY =
	/^org\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(uploads|versions)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//

interface Candidate {
	key: string
	owner: string
	kind: 'uploads' | 'versions'
}

const OWNERS = `
	SELECT organization_id::text AS org, upload_id::text AS upload_id, id::text AS id
	FROM document_versions
	WHERE upload_id = ANY($1::uuid[]) OR id = ANY($2::uuid[])`

// Removes objects under org/ that no version owns: an upload copied before its
// transaction failed, or files of a version that no longer exists. Deletion
// stays off until ORPHAN_SWEEP_DELETE is "true"; before that it only logs.
export async function sweepOrphans(env: WorkerEnv) {
	const deleting = env.ORPHAN_SWEEP_DELETE === 'true'
	const cutoff = Date.now() - MIN_AGE_MS
	let scanned = 0
	let orphaned = 0
	await withClient(env, async (client) => {
		const visible = await client.query<{ count: string }>(
			'SELECT count(*) FROM document_versions',
		)
		if (Number(visible.rows[0]?.count ?? 0) === 0) {
			log('orphan_sweep_refused', { reason: 'no document versions visible' })
			return
		}
		let cursor: string | undefined
		do {
			const page = await env.DOCUMENTS.list({ prefix: 'org/', cursor, limit: 1000 })
			cursor = page.truncated ? page.cursor : undefined
			scanned += page.objects.length
			const candidates: Candidate[] = []
			for (const object of page.objects) {
				if (object.uploaded.getTime() >= cutoff) continue
				const match = OWNED_KEY.exec(object.key)
				if (!match) continue
				const [, org, kind, id] = match
				candidates.push({ key: object.key, owner: `${org}/${id}`, kind: kind as Candidate['kind'] })
			}
			if (candidates.length === 0) continue
			const ids = (kind: Candidate['kind']) => [
				...new Set(candidates.filter((c) => c.kind === kind).map((c) => c.owner.split('/')[1])),
			]
			const owners = await client.query<{ org: string; upload_id: string | null; id: string }>(
				OWNERS,
				[ids('uploads'), ids('versions')],
			)
			const uploads = new Set(
				owners.rows.filter((r) => r.upload_id).map((r) => `${r.org}/${r.upload_id}`),
			)
			const versions = new Set(owners.rows.map((r) => `${r.org}/${r.id}`))
			const orphans = candidates
				.filter((c) => !(c.kind === 'uploads' ? uploads : versions).has(c.owner))
				.map((c) => c.key)
			if (orphans.length === 0) continue
			orphaned += orphans.length
			log(deleting ? 'orphans_deleted' : 'orphans_found', { keys: orphans })
			if (deleting) await env.DOCUMENTS.delete(orphans)
		} while (cursor)
	})
	log('orphan_sweep_done', { scanned, orphaned, deleting })
}
