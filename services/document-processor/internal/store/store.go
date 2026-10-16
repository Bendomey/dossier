package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"dossier/services/document-processor/internal/chunk"
	"dossier/services/document-processor/internal/failure"
)

var (
	ErrNotFound   = errors.New("job not found for this message")
	ErrClaimLost  = errors.New("claim lost")
	ErrSuperseded = errors.New("superseded")
)

type Store struct {
	pool *pgxpool.Pool
}

type Message struct {
	EventID           string `json:"event_id"`
	OrganizationID    string `json:"organization_id"`
	DocumentID        string `json:"document_id"`
	DocumentVersionID string `json:"document_version_id"`
	IndexingJobID     string `json:"indexing_job_id"`
}

type Target struct {
	OrganizationID string
	DocumentID     string
	VersionID      string
	JobID          string
	DocumentName   string
	VersionNumber  int
	FileKey        string
	FileName       string
}

// Claim is the fencing token: every write after claiming checks that the
// job still carries this attempt number.
type Claim struct {
	OrganizationID string
	JobID          string
	Attempt        int
}

type Pending struct {
	ID          string
	Content     string
	HeadingPath []string
}

func Open(ctx context.Context, url string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, errors.New("invalid DATABASE_URL")
	}
	cfg.MaxConns = 4
	// pgvector lives in the extensions schema on Supabase and in public locally.
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path = public, extensions")
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database unreachable: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) LoadTarget(ctx context.Context, m Message) (*Target, error) {
	t := &Target{OrganizationID: m.OrganizationID, DocumentID: m.DocumentID, VersionID: m.DocumentVersionID, JobID: m.IndexingJobID}
	err := s.pool.QueryRow(ctx, `
		SELECT d.name, v.version_number, v.file_key, v.file_name
		FROM indexing_jobs j
		JOIN document_versions v ON v.organization_id = j.organization_id AND v.id = j.document_version_id
		JOIN documents d ON d.organization_id = v.organization_id AND d.id = v.document_id
		WHERE j.id = $1 AND j.organization_id = $2 AND v.id = $3 AND d.id = $4`,
		m.IndexingJobID, m.OrganizationID, m.DocumentVersionID, m.DocumentID,
	).Scan(&t.DocumentName, &t.VersionNumber, &t.FileKey, &t.FileName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Store) MessageForJob(ctx context.Context, jobID string) (Message, error) {
	m := Message{IndexingJobID: jobID}
	err := s.pool.QueryRow(ctx, `
		SELECT j.organization_id::text, v.document_id::text, j.document_version_id::text
		FROM indexing_jobs j
		JOIN document_versions v ON v.organization_id = j.organization_id AND v.id = j.document_version_id
		WHERE j.id = $1`, jobID,
	).Scan(&m.OrganizationID, &m.DocumentID, &m.DocumentVersionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	return m, err
}

func (s *Store) Claim(ctx context.Context, t *Target) (*Claim, error) {
	c := &Claim{OrganizationID: t.OrganizationID, JobID: t.JobID}
	err := s.pool.QueryRow(ctx, `
		UPDATE indexing_jobs
		SET status = 'PROCESSING', attempts = attempts + 1,
		    started_at = coalesce(started_at, now()), heartbeat_at = now()
		WHERE id = $1 AND organization_id = $2 AND (status = 'QUEUED'
		   OR (status = 'PROCESSING' AND (heartbeat_at IS NULL OR heartbeat_at < now() - interval '2 minutes')))
		RETURNING attempts`, t.JobID, t.OrganizationID,
	).Scan(&c.Attempt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func fence(ctx context.Context, tx pgx.Tx, c *Claim) error {
	tag, err := tx.Exec(ctx, `
		UPDATE indexing_jobs SET heartbeat_at = now()
		WHERE id = $1 AND organization_id = $2 AND attempts = $3 AND status = 'PROCESSING'`,
		c.JobID, c.OrganizationID, c.Attempt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrClaimLost
	}
	return nil
}

func (s *Store) withClaim(ctx context.Context, c *Claim, fn func(pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := fence(ctx, tx, c); err != nil {
			return err
		}
		return fn(tx)
	})
}

func (s *Store) Heartbeat(ctx context.Context, c *Claim) error {
	return s.withClaim(ctx, c, func(pgx.Tx) error { return nil })
}

func (s *Store) Superseded(ctx context.Context, t *Target) (bool, error) {
	var superseded bool
	err := s.pool.QueryRow(ctx, `
		SELECT d.deleted_at IS NOT NULL OR d.status <> 'ACTIVE'
		    OR EXISTS (SELECT 1 FROM indexing_jobs n
		               WHERE n.document_version_id = j.document_version_id AND (n.created_at, n.id) > (j.created_at, j.id))
		FROM indexing_jobs j
		JOIN document_versions v ON v.id = j.document_version_id
		JOIN documents d ON d.id = v.document_id
		WHERE j.id = $1 AND j.organization_id = $2`, t.JobID, t.OrganizationID,
	).Scan(&superseded)
	return superseded, err
}

func (s *Store) SetConfig(ctx context.Context, c *Claim, pipelineVersion, embeddingModel string) error {
	return s.withClaim(ctx, c, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE indexing_jobs SET pipeline_version = $3, embedding_model = $4 WHERE id = $1 AND organization_id = $2`,
			c.JobID, c.OrganizationID, pipelineVersion, embeddingModel)
		return err
	})
}

func (s *Store) JobConfig(ctx context.Context, c *Claim) (pipelineVersion, embeddingModel string, err error) {
	var pv, em *string
	err = s.pool.QueryRow(ctx, `SELECT pipeline_version, embedding_model FROM indexing_jobs WHERE id = $1 AND organization_id = $2`,
		c.JobID, c.OrganizationID).Scan(&pv, &em)
	if pv != nil {
		pipelineVersion = *pv
	}
	if em != nil {
		embeddingModel = *em
	}
	return pipelineVersion, embeddingModel, err
}

func (s *Store) ChunkLanguage(ctx context.Context, c *Claim) (string, error) {
	var language string
	err := s.pool.QueryRow(ctx, `
		SELECT language FROM document_chunks WHERE indexing_job_id = $1 AND language IS NOT NULL
		GROUP BY language ORDER BY sum(token_count) DESC, language LIMIT 1`, c.JobID).Scan(&language)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return language, err
}

func (s *Store) SetStage(ctx context.Context, c *Claim, stage string, progress int) error {
	return s.withClaim(ctx, c, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE indexing_jobs SET stage = $3::"IndexingStage", progress = $4 WHERE id = $1 AND organization_id = $2`,
			c.JobID, c.OrganizationID, stage, min(max(progress, 0), 100))
		return err
	})
}

func (s *Store) SetChecksum(ctx context.Context, c *Claim, t *Target, checksum string) error {
	return s.withClaim(ctx, c, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE document_versions SET checksum = $3 WHERE id = $1 AND organization_id = $2`,
			t.VersionID, t.OrganizationID, checksum)
		return err
	})
}

// ChunksReady reports whether this job already wrote all its chunks, so a
// redelivery can go straight to embedding the rest.
func (s *Store) ChunksReady(ctx context.Context, c *Claim) (bool, error) {
	var ready bool
	err := s.pool.QueryRow(ctx, `
		SELECT j.expected_chunk_count IS NOT NULL AND j.expected_chunk_count > 0
		   AND j.expected_chunk_count = (SELECT count(*) FROM document_chunks ch WHERE ch.indexing_job_id = j.id)
		FROM indexing_jobs j WHERE j.id = $1 AND j.organization_id = $2`, c.JobID, c.OrganizationID,
	).Scan(&ready)
	return ready, err
}

func (s *Store) ExpectedChunks(ctx context.Context, c *Claim) (expected, completed int, err error) {
	var e *int
	err = s.pool.QueryRow(ctx, `SELECT expected_chunk_count, completed_chunk_count FROM indexing_jobs WHERE id = $1 AND organization_id = $2`,
		c.JobID, c.OrganizationID).Scan(&e, &completed)
	if err != nil || e == nil {
		return 0, 0, err
	}
	return *e, completed, nil
}

// ReserveOCR counts pages against the organization's monthly quota before any
// is sent; false means the quota would be exceeded and nothing was reserved.
func (s *Store) ReserveOCR(ctx context.Context, c *Claim, model string, pages, limit int) (bool, error) {
	if pages > limit {
		return false, nil
	}
	reserved := false
	err := s.withClaim(ctx, c, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE indexing_jobs SET ocr_model = $3 WHERE id = $1 AND organization_id = $2`,
			c.JobID, c.OrganizationID, model); err != nil {
			return err
		}
		var total int
		err := tx.QueryRow(ctx, `
			INSERT INTO ocr_usage (organization_id, period, pages_reserved)
			VALUES ($1, date_trunc('month', now() AT TIME ZONE 'utc')::date, $2)
			ON CONFLICT (organization_id, period) DO UPDATE
			  SET pages_reserved = ocr_usage.pages_reserved + excluded.pages_reserved
			  WHERE ocr_usage.pages_reserved + excluded.pages_reserved <= $3
			RETURNING pages_reserved`,
			c.OrganizationID, pages, limit).Scan(&total)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		reserved = true
		return nil
	})
	return reserved, err
}

func (s *Store) AddOCRPage(ctx context.Context, c *Claim) error {
	return s.withClaim(ctx, c, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE indexing_jobs SET ocr_page_count = ocr_page_count + 1 WHERE id = $1 AND organization_id = $2`,
			c.JobID, c.OrganizationID)
		return err
	})
}

// ReplaceChunks clears every chunk of this version that isn't live (this
// job's from an earlier attempt, and failed jobs' leftovers), then inserts the
// new set without embeddings. Inserts are batched: COPY is refused on tables
// with row-level security.
func (s *Store) ReplaceChunks(ctx context.Context, c *Claim, t *Target, chunks []chunk.Chunk) error {
	return s.withClaim(ctx, c, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			DELETE FROM document_chunks ch
			USING document_versions v
			WHERE ch.document_version_id = v.id AND v.id = $1 AND v.organization_id = $2
			  AND ch.indexing_job_id IS DISTINCT FROM v.indexed_job_id
			  AND NOT EXISTS (SELECT 1 FROM indexing_jobs n WHERE n.id = ch.indexing_job_id
			                  AND (n.created_at, n.id) > (SELECT created_at, id FROM indexing_jobs WHERE id = $3))`,
			t.VersionID, t.OrganizationID, c.JobID); err != nil {
			return err
		}
		batch := &pgx.Batch{}
		for _, ch := range chunks {
			metadata, err := json.Marshal(map[string]any{"heading_path": ch.HeadingPath, "ocr": ch.OCR})
			if err != nil {
				return err
			}
			hash := sha256.Sum256([]byte(ch.Content))
			batch.Queue(`
				INSERT INTO document_chunks (organization_id, document_id, document_version_id, indexing_job_id,
				  chunk_index, content, content_hash, page_number, page_end, section_title, section_number,
				  language, token_count, metadata)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
				t.OrganizationID, t.DocumentID, t.VersionID, c.JobID, ch.Index, ch.Content, hex.EncodeToString(hash[:]),
				nullInt(ch.PageStart), nullInt(ch.PageEnd), nullString(ch.SectionTitle), nullString(ch.SectionNumber),
				nullString(ch.Language), ch.TokenCount, metadata)
		}
		if err := tx.SendBatch(ctx, batch).Close(); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE indexing_jobs SET expected_chunk_count = $3, completed_chunk_count = 0 WHERE id = $1 AND organization_id = $2`,
			c.JobID, c.OrganizationID, len(chunks))
		return err
	})
}

func (s *Store) PendingChunks(ctx context.Context, c *Claim, limit int) ([]Pending, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, content, coalesce(metadata->'heading_path', '[]'::jsonb)
		FROM document_chunks
		WHERE indexing_job_id = $1 AND organization_id = $2 AND embedding IS NULL
		ORDER BY chunk_index LIMIT $3`, c.JobID, c.OrganizationID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Pending, error) {
		var (
			p           Pending
			headingPath []byte
		)
		if err := row.Scan(&p.ID, &p.Content, &headingPath); err != nil {
			return p, err
		}
		_ = json.Unmarshal(headingPath, &p.HeadingPath)
		return p, nil
	})
}

func (s *Store) SaveEmbeddings(ctx context.Context, c *Claim, ids []string, vectors [][]float32) (int, error) {
	if len(ids) != len(vectors) {
		return 0, fmt.Errorf("%d ids for %d vectors", len(ids), len(vectors))
	}
	completed := 0
	err := s.withClaim(ctx, c, func(tx pgx.Tx) error {
		batch := &pgx.Batch{}
		for i, id := range ids {
			batch.Queue(`UPDATE document_chunks SET embedding = $1::vector WHERE id = $2 AND indexing_job_id = $3`,
				vectorLiteral(vectors[i]), id, c.JobID)
		}
		if err := tx.SendBatch(ctx, batch).Close(); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `
			UPDATE indexing_jobs
			SET completed_chunk_count = (SELECT count(*) FROM document_chunks WHERE indexing_job_id = $1 AND embedding IS NOT NULL)
			WHERE id = $1 AND organization_id = $2
			RETURNING completed_chunk_count`, c.JobID, c.OrganizationID).Scan(&completed)
	})
	return completed, err
}

// Activate makes the job's chunks the version's live set and moves the
// document forward to this version unless a newer one is already live.
func (s *Store) Activate(ctx context.Context, c *Claim, t *Target, pageCount int, language string) error {
	return s.withClaim(ctx, c, func(tx pgx.Tx) error {
		var (
			latest, live bool
			expected     *int
			embedded     int
		)
		if _, err := tx.Exec(ctx, `
			SELECT 1 FROM document_versions v JOIN documents d ON d.id = v.document_id
			WHERE v.id = $1 AND v.organization_id = $2 FOR UPDATE OF v, d`, t.VersionID, t.OrganizationID); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `
			SELECT
			  NOT EXISTS (SELECT 1 FROM indexing_jobs n
			              WHERE n.document_version_id = j.document_version_id AND (n.created_at, n.id) > (j.created_at, j.id)),
			  d.deleted_at IS NULL AND d.status = 'ACTIVE',
			  j.expected_chunk_count,
			  (SELECT count(*) FROM document_chunks ch WHERE ch.indexing_job_id = j.id AND ch.embedding IS NOT NULL)
			FROM indexing_jobs j
			JOIN document_versions v ON v.id = j.document_version_id
			JOIN documents d ON d.id = v.document_id
			WHERE j.id = $1 AND j.organization_id = $2`, c.JobID, c.OrganizationID,
		).Scan(&latest, &live, &expected, &embedded)
		if err != nil {
			return err
		}
		if !latest || !live {
			return ErrSuperseded
		}
		if expected == nil || *expected == 0 || embedded != *expected {
			want := 0
			if expected != nil {
				want = *expected
			}
			return failure.Transient(failure.Internal, fmt.Errorf("activation check failed: %d chunks embedded, %d expected", embedded, want))
		}
		if _, err := tx.Exec(ctx, `
			UPDATE document_versions SET indexed_job_id = $3, page_count = $4, language = $5
			WHERE id = $1 AND organization_id = $2`,
			t.VersionID, t.OrganizationID, c.JobID, nullInt(pageCount), nullString(language)); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE documents d SET current_version_id = $1
			WHERE d.id = $2 AND d.organization_id = $3
			  AND (d.current_version_id IS NULL
			       OR (SELECT version_number FROM document_versions WHERE id = d.current_version_id) < $4)`,
			t.VersionID, t.DocumentID, t.OrganizationID, t.VersionNumber); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			UPDATE indexing_jobs
			SET status = 'COMPLETED', progress = 100, completed_at = now(),
			    error_code = NULL, error_stage = NULL, error_message = NULL
			WHERE id = $1 AND organization_id = $2`, c.JobID, c.OrganizationID)
		return err
	})
}

// Fail records the failure under the claim. Permanent failures end the job;
// transient ones return it to the queue for another attempt.
func (s *Store) Fail(ctx context.Context, c *Claim, stage, code, message string, permanent bool) error {
	status := "QUEUED"
	if permanent {
		status = "FAILED"
	}
	return s.withClaim(ctx, c, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE indexing_jobs
			SET status = $3::"IndexingStatus", error_stage = $4::"IndexingStage", error_code = $5, error_message = $6,
			    completed_at = CASE WHEN $7 THEN now() ELSE completed_at END
			WHERE id = $1 AND organization_id = $2`,
			c.JobID, c.OrganizationID, status, nullString(stage), code, truncate(message, 500), permanent)
		return err
	})
}

func (s *Store) AuditFailure(ctx context.Context, t *Target, code string) error {
	metadata, err := json.Marshal(map[string]any{"target": t.DocumentName, "version": t.VersionNumber, "error_code": code})
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, metadata)
		VALUES ($1, 'document.indexing_failed', 'document', $2, $3)`, t.OrganizationID, t.DocumentID, metadata)
	return err
}

type AIRun struct {
	OrganizationID string
	JobID          string
	Model          string
	Operation      string
	InputTokens    int
	OutputTokens   int
	Estimated      bool
	Latency        time.Duration
	Page           int
}

func (s *Store) RecordAIRun(ctx context.Context, run AIRun) error {
	details := map[string]any{"indexing_job_id": run.JobID, "estimated_tokens": run.Estimated}
	if run.Page > 0 {
		details["page"] = run.Page
	}
	metadata, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO ai_runs (organization_id, provider, model, operation, status, input_tokens, output_tokens, latency_ms, metadata, completed_at)
		VALUES ($1, 'google', $2, $3::"AiOperation", 'SUCCEEDED', $4, $5, $6, $7, now())`,
		run.OrganizationID, run.Model, run.Operation, run.InputTokens, nullInt(run.OutputTokens), int(run.Latency.Milliseconds()), metadata)
	return err
}

func vectorLiteral(v []float32) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, f := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(f), 'f', -1, 32))
	}
	b.WriteByte(']')
	return b.String()
}

func nullInt(n int) *int {
	if n == 0 {
		return nil
	}
	return &n
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func truncate(s string, limit int) string {
	s = strings.ReplaceAll(strings.ToValidUTF8(s, ""), "\x00", "")
	if len(s) <= limit {
		return s
	}
	for limit > 0 && !utf8.RuneStart(s[limit]) {
		limit--
	}
	return s[:limit]
}
