-- Prisma cannot declare HNSW indexes, so it drops any it finds on the next
-- `migrate dev`. Retrieval filters by organization_id first, and exact search
-- over one organization's chunks is fast at early volumes (HNSW with tight
-- filters also loses recall). Recreate this index outside Prisma when the
-- indexing service in services/* lands, or once Prisma supports HNSW:
--
--   CREATE INDEX CONCURRENTLY document_chunks_embedding_idx
--     ON document_chunks USING hnsw (embedding vector_cosine_ops);

DROP INDEX "document_chunks_embedding_idx";
