import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

const PROCESSING_POLL_MS = 1500

const pollWhileProcessing = (documents?: DossierDocument[]) =>
	documents?.some((document) => document.status === 'PROCESSING')
		? PROCESSING_POLL_MS
		: false

export const useGetDocuments = (filter: FetchDocumentsFilter) =>
	useQuery({
		queryKey: [QUERY_KEYS.DOCUMENTS, filter],
		queryFn: () => api.listDocuments(filter),
		placeholderData: (previous) => previous,
		refetchInterval: (query) => pollWhileProcessing(query.state.data),
	})

export const useGetDocument = (documentId: string) =>
	useQuery({
		queryKey: [QUERY_KEYS.DOCUMENTS, documentId],
		queryFn: () => api.getDocument(documentId),
		refetchInterval: (query) =>
			query.state.data?.status === 'PROCESSING' ? PROCESSING_POLL_MS : false,
	})

export const useGetDocumentVersions = (documentId: string) =>
	useQuery({
		queryKey: [QUERY_KEYS.DOCUMENT_VERSIONS, documentId],
		queryFn: () => api.getDocumentVersions(documentId),
	})

export const useGetKnowledgeStats = () =>
	useQuery({
		queryKey: [QUERY_KEYS.KNOWLEDGE_STATS],
		queryFn: api.getKnowledgeStats,
		refetchInterval: (query) =>
			query.state.data?.processing ? PROCESSING_POLL_MS : false,
	})

function useInvalidateDocuments() {
	const queryClient = useQueryClient()
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENTS] }),
			queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.KNOWLEDGE_STATS] }),
		])
}

export const useSetDocumentAccess = () => {
	const invalidate = useInvalidateDocuments()
	return useMutation({
		mutationFn: ({
			documentId,
			groupIds,
		}: {
			documentId: string
			groupIds: string[] | null
		}) => api.setDocumentAccess(documentId, groupIds),
		onSuccess: invalidate,
	})
}

export const useUploadDocument = (uploadedBy: string) => {
	const invalidate = useInvalidateDocuments()
	return useMutation({
		mutationFn: (input: UploadDocumentInput) =>
			api.uploadDocument(input, uploadedBy),
		onSuccess: invalidate,
	})
}

export const useRemoveDocument = () => {
	const invalidate = useInvalidateDocuments()
	return useMutation({
		mutationFn: (documentId: string) => api.removeDocument(documentId),
		onSuccess: invalidate,
	})
}
