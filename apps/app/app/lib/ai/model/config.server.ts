import { environmentVariables } from '~/lib/actions/env.server'

export function aiEnabled() {
	const env = environmentVariables()
	return env.AI_ENABLED && Boolean(env.GEMINI_API_KEY)
}

export function aiModels() {
	const env = environmentVariables()
	return {
		ask: env.ASK_MODEL,
		intent: env.INTENT_MODEL,
		embedding: env.EMBEDDING_MODEL,
	}
}

export const retrievalMinSimilarity = () =>
	environmentVariables().RETRIEVAL_MIN_SIMILARITY
