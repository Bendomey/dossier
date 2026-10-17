import { detectIntent, rewriteFollowUp } from './intent.server'
import { aiEnabled } from './model/config.server'
import { answerQuestion } from './operations/ask.server'
import type { ReplyOutcome } from './operations/types'
import { ensureStallSweep, openReply, type OpenReply } from './replies.server'
import { readableCollectionIds } from './retrieval.server'
import { errorCodeOf, type RunScope } from './runs.server'
import {
	citationFromPassage,
	completeReply,
	failReply,
	loadReplyInputs,
	markReplyStreaming,
	RETRYABLE_ERRORS,
	type ReplyInputs,
} from '~/api/chats/server'

const REPLY_TIMEOUT_MS = 180_000
const MIN_INTENT_CONFIDENCE = 0.6

const UNAVAILABLE_TEXT =
	'Reviews, drafts and comparisons are coming soon. For now I can answer questions about your documents.'
const NO_COLLECTIONS_TEXT =
	'The collections this chat was limited to are no longer available to you. Start a new chat to search your other documents.'
const CLARIFY_FALLBACK =
	'Should I answer a question from your documents, review a document, draft one or compare two?'

type Resolution =
	| { kind: 'run'; operation: ChatMode; query: string }
	| { kind: 'clarify'; question: string }

/** Runs the reply detached from the request: the browser leaving never stops it, only cancel does. */
export function startReply(
	session: Session,
	chatId: string,
	messageId: string,
) {
	ensureStallSweep()
	const reply = openReply(messageId)
	void runReply(session, chatId, messageId, reply)
}

async function resolveOperation(
	inputs: ReplyInputs,
	runs: RunScope,
	signal: AbortSignal,
): Promise<Resolution> {
	const chosen = inputs.mode ?? inputs.lastOperation
	if (chosen) {
		const query =
			chosen === 'ASK' && inputs.history.length
				? await rewriteFollowUp(inputs, runs, signal)
				: inputs.question
		return { kind: 'run', operation: chosen, query }
	}
	const intent = await detectIntent(inputs, runs, signal)
	if (intent.clarifying_question || intent.confidence < MIN_INTENT_CONFIDENCE) {
		return {
			kind: 'clarify',
			question: intent.clarifying_question ?? CLARIFY_FALLBACK,
		}
	}
	return {
		kind: 'run',
		operation: intent.operation,
		query: intent.standalone_query.trim() || inputs.question,
	}
}

const fixedReply = (
	content: string,
	operation: ChatMode,
	metadata: ReplyOutcome['metadata'],
): ReplyOutcome => ({
	content,
	operation,
	metadata,
	citations: [],
	audit: false,
})

async function runReply(
	session: Session,
	chatId: string,
	messageId: string,
	reply: OpenReply,
) {
	const signal = AbortSignal.any([
		reply.signal,
		AbortSignal.timeout(REPLY_TIMEOUT_MS),
	])
	const runs: RunScope = {
		organizationId: session.organization.id,
		userId: session.user.id,
		chatId,
		messageId,
	}
	try {
		const inputs = await loadReplyInputs(session, chatId, messageId)
		await markReplyStreaming(messageId)
		reply.status('Reading your question')
		if (!aiEnabled()) {
			await fail(messageId, reply, 'AI_DISABLED')
			return
		}

		const resolution = await resolveOperation(inputs, runs, signal)
		let outcome: ReplyOutcome
		if (resolution.kind === 'clarify') {
			outcome = fixedReply(resolution.question, 'ASK', { clarifying: true })
		} else if (resolution.operation !== 'ASK') {
			outcome = fixedReply(UNAVAILABLE_TEXT, resolution.operation, {
				unavailable: true,
			})
		} else {
			const scope = await readableCollectionIds(session, chatId)
			outcome =
				scope.narrowed && !scope.ids.length
					? fixedReply(NO_COLLECTIONS_TEXT, 'ASK', { no_sources: true })
					: await answerQuestion(
							{
								organization: inputs.organization,
								question: inputs.question,
								query: resolution.query,
								history: inputs.history,
								collectionIds: scope.ids,
								runs,
							},
							{ status: reply.status, delta: reply.delta, signal },
						)
		}
		await finish(session, chatId, messageId, reply, outcome)
	} catch (error) {
		const code = errorCodeOf(error)
		if (code !== 'CANCELLED') {
			console.error(`Reply ${messageId} failed (${code})`, error)
		}
		await fail(messageId, reply, code)
	} finally {
		reply.close()
	}
}

async function finish(
	session: Session,
	chatId: string,
	messageId: string,
	reply: OpenReply,
	outcome: ReplyOutcome,
) {
	if (!reply.text) reply.delta(outcome.content)
	const saved = await completeReply({
		...outcome,
		organizationId: session.organization.id,
		actorUserId: session.user.id,
		chatId,
		messageId,
	})
	if (!saved) {
		reply.emit({ type: 'error', code: 'CANCELLED', retryable: true })
		return
	}
	reply.emit({
		type: 'citations',
		citations: outcome.citations.map(citationFromPassage),
	})
	reply.emit({
		type: 'done',
		unsupported: outcome.metadata.unsupported === true,
		clarifying: outcome.metadata.clarifying === true,
	})
}

async function fail(messageId: string, reply: OpenReply, code: string) {
	await failReply(messageId, code, reply.text).catch((error: unknown) =>
		console.error('Could not record the failed reply', error),
	)
	reply.emit({
		type: 'error',
		code,
		retryable: code === 'CANCELLED' || RETRYABLE_ERRORS.has(code),
	})
}
