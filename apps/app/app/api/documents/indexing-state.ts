import { canRetryCode, indexingErrorMessage } from './indexing-errors'

export interface JobSnapshot {
	status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
	stage: IndexingStage | null
	progress: number
	attempts: number
	errorCode: string | null
}

export interface VersionSnapshot {
	id: string
	versionNumber: number
	createdById: string | null
	/** Has an indexed job whose chunks are live. */
	indexed: boolean
	job: JobSnapshot | null
}

export interface Viewer {
	id: string
	canUpdate: boolean
}

export function versionIndexingState(version: VersionSnapshot, viewer: Viewer) {
	const job = version.job
	if (version.indexed || job?.status === 'COMPLETED') {
		return {
			status: 'READY' as const,
			stage: null,
			progress: 100,
			error: null,
			retrying: false,
			can_retry: false,
		}
	}
	if (job?.status === 'FAILED') {
		return {
			status: 'FAILED' as const,
			stage: null,
			progress: job.progress,
			error: indexingErrorMessage(job.errorCode),
			retrying: false,
			can_retry:
				canRetryCode(job.errorCode) &&
				(viewer.canUpdate || version.createdById === viewer.id),
		}
	}
	return {
		status: (job?.status ?? 'QUEUED') as 'QUEUED' | 'PROCESSING',
		stage: job?.stage ?? null,
		progress: job?.progress ?? 0,
		error: null,
		retrying: job?.status === 'QUEUED' && (job.attempts ?? 0) > 0,
		can_retry: false,
	}
}

export function documentIndexingState(input: {
	current: VersionSnapshot | null
	latest: VersionSnapshot
	viewer: Viewer
}): Pick<
	DossierDocument,
	| 'status'
	| 'stage'
	| 'progress'
	| 'error'
	| 'retrying'
	| 'can_retry'
	| 'latest_version_id'
	| 'pending_version'
> {
	const { current, latest, viewer } = input
	const latestState = versionIndexingState(latest, viewer)
	if (!current) {
		return {
			...latestState,
			latest_version_id: latest.id,
			pending_version: null,
		}
	}
	const pending =
		latest.versionNumber > current.versionNumber &&
		latestState.status !== 'READY'
			? {
					version_number: latest.versionNumber,
					status: latestState.status,
					progress: latestState.progress,
					error: latestState.error,
				}
			: null
	return {
		status: 'READY',
		stage: null,
		progress: 100,
		error: null,
		retrying: false,
		can_retry: pending ? latestState.can_retry : false,
		latest_version_id: latest.id,
		pending_version: pending,
	}
}
