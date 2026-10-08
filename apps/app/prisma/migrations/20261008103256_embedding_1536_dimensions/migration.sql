-- 1536 dimensions is the common default: OpenAI's embedding size, Supabase's
-- pgvector examples, and one of Gemini's recommended output sizes. It stays
-- under pgvector's 2,000-dimension limit for HNSW indexes.
--
-- Prisma does not detect size changes inside Unsupported("vector(...)"), so
-- this is written by hand. No embeddings existed when it was written; a
-- later size change would need re-embedding, as vectors cannot be resized.

ALTER TABLE "document_chunks" ALTER COLUMN "embedding" TYPE vector(1536);
