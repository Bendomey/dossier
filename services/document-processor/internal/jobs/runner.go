package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"dossier/services/document-processor/internal/blob"
	"dossier/services/document-processor/internal/chunk"
	"dossier/services/document-processor/internal/config"
	"dossier/services/document-processor/internal/embed"
	"dossier/services/document-processor/internal/extract"
	"dossier/services/document-processor/internal/failure"
	"dossier/services/document-processor/internal/lang"
	"dossier/services/document-processor/internal/ocr"
	"dossier/services/document-processor/internal/store"
)

const (
	maxSourceBytes    = 25 << 20
	heartbeatInterval = 30 * time.Second
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Outcome struct {
	Status int    `json:"-"`
	Result string `json:"result"`
	Code   string `json:"code,omitempty"`
}

type Runner struct {
	cfg      config.Config
	store    *store.Store
	objects  *blob.Store
	embedder *embed.Embedder
	reader   *ocr.Reader
	log      *slog.Logger
	busy     atomic.Bool
}

func NewRunner(cfg config.Config, st *store.Store, objects *blob.Store, embedder *embed.Embedder, reader *ocr.Reader, log *slog.Logger) *Runner {
	return &Runner{cfg: cfg, store: st, objects: objects, embedder: embedder, reader: reader, log: log}
}

// TryAcquire keeps one job per process; the queue retries busy deliveries.
func (r *Runner) TryAcquire() bool { return r.busy.CompareAndSwap(false, true) }

func (r *Runner) Release() { r.busy.Store(false) }

// jobFiles holds the job's temp directory; the source is downloaded at most
// once, and only when extraction or OCR needs it.
type jobFiles struct {
	dir    string
	source string
}

func (r *Runner) fetchSource(ctx context.Context, c *store.Claim, t *store.Target, files *jobFiles) (string, error) {
	if files.source != "" {
		return files.source, nil
	}
	format, _ := extract.FormatOf(t.FileName)
	path := filepath.Join(files.dir, "source."+format)
	checksum, _, err := r.objects.Download(ctx, t.FileKey, path, maxSourceBytes)
	switch {
	case errors.Is(err, blob.ErrNotFound):
		return "", failure.Permanent(failure.SourceMissing, err)
	case errors.Is(err, blob.ErrTooLarge):
		return "", failure.Permanent(failure.CorruptFile, err)
	case err != nil:
		return "", failure.Transient(failure.StorageUnavailable, err)
	}
	if err := r.store.SetChecksum(ctx, c, t, checksum); err != nil {
		return "", dbError(err)
	}
	files.source = path
	return path, nil
}

func (r *Runner) Handle(ctx context.Context, m store.Message) Outcome {
	log := r.log.With("job_id", m.IndexingJobID, "organization_id", m.OrganizationID, "event_id", m.EventID)
	for _, id := range []string{m.EventID, m.OrganizationID, m.DocumentID, m.DocumentVersionID, m.IndexingJobID} {
		if !uuidPattern.MatchString(id) {
			log.Warn("invalid message")
			return Outcome{http.StatusUnprocessableEntity, "invalid", failure.InvalidMessage}
		}
	}
	preCtx, preCancel := context.WithTimeout(ctx, 30*time.Second)
	defer preCancel()
	target, err := r.store.LoadTarget(preCtx, m)
	if errors.Is(err, store.ErrNotFound) {
		log.Warn("message does not match a job")
		return Outcome{http.StatusUnprocessableEntity, "invalid", failure.InvalidMessage}
	}
	if err != nil {
		log.Error("load job failed", "error", err)
		return Outcome{http.StatusServiceUnavailable, "retry", failure.DatabaseUnavailable}
	}
	claim, err := r.store.Claim(preCtx, target)
	if err != nil {
		log.Error("claim failed", "error", err)
		return Outcome{http.StatusServiceUnavailable, "retry", failure.DatabaseUnavailable}
	}
	if claim == nil {
		log.Info("job not claimable")
		return Outcome{http.StatusOK, "skipped", ""}
	}
	log = log.With("attempt", claim.Attempt)
	if claim.Attempt > r.cfg.MaxAttempts {
		return r.fail(ctx, log, claim, target, "", failure.Permanent(failure.RetriesExhausted, errors.New("no attempts left")), false)
	}

	jobCtx, cancel := context.WithTimeout(ctx, r.cfg.JobTimeout)
	defer cancel()
	stopHeartbeat := r.heartbeat(jobCtx, cancel, claim, log)
	started := time.Now()
	stage, err := r.process(jobCtx, log, claim, target)
	stopHeartbeat()
	if err == nil {
		log.Info("job completed", "duration_ms", time.Since(started).Milliseconds())
		return Outcome{http.StatusOK, "completed", ""}
	}
	return r.fail(ctx, log, claim, target, stage, err, errors.Is(jobCtx.Err(), context.DeadlineExceeded))
}

func (r *Runner) process(ctx context.Context, log *slog.Logger, c *store.Claim, t *store.Target) (string, error) {
	superseded, err := r.store.Superseded(ctx, t)
	if err != nil {
		return "", dbError(err)
	}
	if superseded {
		return "", store.ErrSuperseded
	}
	storedPipeline, storedModel, err := r.store.JobConfig(ctx, c)
	if err != nil {
		return "", dbError(err)
	}
	ready, err := r.store.ChunksReady(ctx, c)
	if err != nil {
		return "", dbError(err)
	}
	if ready && (storedPipeline != r.cfg.PipelineSignature() || storedModel != r.embedder.Model()) {
		log.Info("settings changed, re-chunking")
		ready = false
	}
	if err := r.store.SetConfig(ctx, c, r.cfg.PipelineSignature(), r.embedder.Model()); err != nil {
		return "", dbError(err)
	}
	work, err := os.MkdirTemp("", "job-")
	if err != nil {
		return "", failure.Transient(failure.Internal, err)
	}
	defer os.RemoveAll(work)
	files := &jobFiles{dir: work}
	// On a resumed job this reads the cached extraction, which activation
	// needs for the page count.
	doc, err := r.extract(ctx, log, c, t, files, !ready)
	if err != nil {
		return "EXTRACTING", err
	}
	var language string
	if !ready {
		if doc, err = r.readScannedPages(ctx, log, c, t, files, doc); err != nil {
			return "EXTRACTING", err
		}
		if err := checkText(doc); err != nil {
			return "EXTRACTING", err
		}
		if err := r.store.SetStage(ctx, c, "CHUNKING", 30); err != nil {
			return "CHUNKING", dbError(err)
		}
		chunks := chunk.Split(doc, r.cfg.Chunk)
		if len(chunks) == 0 {
			return "CHUNKING", failure.Permanent(failure.NoTextFound, errors.New("no chunks"))
		}
		for i := range chunks {
			chunks[i].Language = lang.Detect(chunks[i].Content)
		}
		if err := r.store.ReplaceChunks(ctx, c, t, chunks); err != nil {
			return "CHUNKING", dbError(err)
		}
		language = lang.Majority(chunks)
		log.Info("chunks written", "chunks", len(chunks))
	} else {
		log.Info("chunks already written, resuming embedding")
		if language, err = r.store.ChunkLanguage(ctx, c); err != nil {
			return "EMBEDDING", dbError(err)
		}
	}

	if err := r.embedAll(ctx, log, c, t); err != nil {
		return "EMBEDDING", err
	}

	if err := r.store.SetStage(ctx, c, "ACTIVATING", 95); err != nil {
		return "ACTIVATING", dbError(err)
	}
	if err := r.store.Activate(ctx, c, t, doc.PageCount, language); err != nil {
		return "ACTIVATING", dbError(err)
	}
	return "", nil
}

func (r *Runner) extract(ctx context.Context, log *slog.Logger, c *store.Claim, t *store.Target, files *jobFiles, setStage bool) (*extract.Document, error) {
	if setStage {
		if err := r.store.SetStage(ctx, c, "EXTRACTING", 0); err != nil {
			return nil, dbError(err)
		}
	}
	format, ok := extract.FormatOf(t.FileName)
	if !ok {
		return nil, failure.Permanent(failure.UnsupportedFormat, fmt.Errorf("file %q", filepath.Ext(t.FileName)))
	}
	key := fmt.Sprintf("org/%s/versions/%s/extraction-%s.json", t.OrganizationID, t.VersionID, extract.Version)
	var cached extract.Document
	found, err := r.objects.GetJSON(ctx, key, &cached)
	if err != nil {
		log.Warn("extraction cache read failed", "error", err)
	}
	if found {
		log.Info("extraction cache hit")
		return &cached, nil
	}
	source, err := r.fetchSource(ctx, c, t, files)
	if err != nil {
		return nil, err
	}
	if setStage {
		if err := r.store.SetStage(ctx, c, "EXTRACTING", 5); err != nil {
			return nil, dbError(err)
		}
	}
	doc, err := extract.Extract(ctx, source, format)
	if err != nil {
		var f *failure.Error
		if errors.As(err, &f) {
			return nil, f
		}
		return nil, failure.Permanent(failure.CorruptFile, err)
	}
	if err := r.objects.PutJSON(ctx, key, doc); err != nil {
		log.Warn("extraction cache write failed", "error", err)
	}
	return doc, nil
}

// checkText runs after OCR. Pages OCR could not read stay flagged, and a
// document that is mostly unread fails rather than going Ready on its cover.
func checkText(doc *extract.Document) error {
	if !doc.HasText() || (doc.PageCount > 0 && 2*len(doc.FlaggedPages) >= doc.PageCount) {
		return failure.Permanent(failure.NoTextFound, fmt.Errorf("%d of %d pages without readable text", len(doc.FlaggedPages), doc.PageCount))
	}
	return nil
}

// readScannedPages runs OCR on the flagged pages, reusing every page cached by
// an earlier attempt; only uncached pages are reserved and sent.
func (r *Runner) readScannedPages(ctx context.Context, log *slog.Logger, c *store.Claim, t *store.Target, files *jobFiles, doc *extract.Document) (*extract.Document, error) {
	if len(doc.FlaggedPages) == 0 {
		return doc, nil
	}
	if len(doc.FlaggedPages) > ocr.MaxPages {
		return nil, failure.Permanent(failure.OCRLimitReached, fmt.Errorf("%d scanned pages", len(doc.FlaggedPages)))
	}
	pages := make(map[int]ocr.Page, len(doc.FlaggedPages))
	var missing []int
	for _, n := range doc.FlaggedPages {
		var page ocr.Page
		found, err := r.objects.GetJSON(ctx, ocr.CacheKey(t.OrganizationID, t.VersionID, n), &page)
		if err != nil {
			log.Warn("ocr cache read failed", "page", n, "error", err)
		}
		if found {
			pages[n] = page
		} else {
			missing = append(missing, n)
		}
	}
	if len(missing) > 0 {
		source, err := r.fetchSource(ctx, c, t, files)
		if err != nil {
			return nil, err
		}
		superseded, err := r.store.Superseded(ctx, t)
		if err != nil {
			return nil, dbError(err)
		}
		if superseded {
			return nil, store.ErrSuperseded
		}
		reserved, err := r.store.ReserveOCR(ctx, c, r.reader.Model(), len(missing), r.cfg.OCRMonthlyPageLimit)
		if err != nil {
			return nil, dbError(err)
		}
		if !reserved {
			return nil, failure.Permanent(failure.OCRLimitReached, fmt.Errorf("monthly quota: %d pages needed", len(missing)))
		}
		for i, n := range missing {
			page, err := r.readPage(ctx, log, c, t, files, source, n)
			if err != nil {
				return nil, err
			}
			pages[n] = page
			if err := r.store.SetStage(ctx, c, "EXTRACTING", 5+25*(i+1)/len(missing)); err != nil {
				return nil, dbError(err)
			}
		}
	}
	texts := make(map[int]string, len(pages))
	for n, page := range pages {
		if !page.Unreadable && strings.TrimSpace(page.Text) != "" {
			texts[n] = page.Text
		}
	}
	log.Info("scanned pages read", "flagged", len(doc.FlaggedPages), "sent", len(missing), "unreadable", len(doc.FlaggedPages)-len(texts))
	return extract.MergeOCR(doc, texts), nil
}

func (r *Runner) readPage(ctx context.Context, log *slog.Logger, c *store.Claim, t *store.Target, files *jobFiles, source string, n int) (ocr.Page, error) {
	image, err := extract.RenderPage(ctx, source, n, files.dir)
	if err != nil {
		var f *failure.Error
		if errors.As(err, &f) && f.Code == failure.CorruptFile {
			log.Warn("page could not be rendered", "page", n)
			page := ocr.Page{Number: n, Model: r.reader.Model(), Unreadable: true}
			if err := r.objects.PutJSON(ctx, ocr.CacheKey(t.OrganizationID, t.VersionID, n), page); err != nil {
				log.Warn("ocr cache write failed", "page", n, "error", err)
			}
			return page, nil
		}
		return ocr.Page{}, err
	}
	defer os.Remove(image)
	started := time.Now()
	page, sent, err := r.reader.Read(ctx, image, n)
	if err != nil {
		return ocr.Page{}, err
	}
	if err := r.objects.PutJSON(ctx, ocr.CacheKey(t.OrganizationID, t.VersionID, n), page); err != nil {
		log.Warn("ocr cache write failed", "page", n, "error", err)
	}
	if !sent {
		return page, nil
	}
	if err := r.store.AddOCRPage(ctx, c); err != nil {
		return ocr.Page{}, dbError(err)
	}
	if err := r.store.RecordAIRun(ctx, store.AIRun{
		OrganizationID: t.OrganizationID, JobID: t.JobID, Model: page.Model, Operation: "OCR",
		InputTokens: page.InputTokens, OutputTokens: page.OutputTokens, Latency: time.Since(started), Page: n,
	}); err != nil {
		log.Warn("ai run not recorded", "error", err)
	}
	return page, nil
}

func (r *Runner) embedAll(ctx context.Context, log *slog.Logger, c *store.Claim, t *store.Target) error {
	total, completed, err := r.store.ExpectedChunks(ctx, c)
	if err != nil {
		return dbError(err)
	}
	for {
		pending, err := r.store.PendingChunks(ctx, c, embed.BatchSize)
		if err != nil {
			return dbError(err)
		}
		if len(pending) == 0 {
			return nil
		}
		inputs := make([]string, len(pending))
		ids := make([]string, len(pending))
		tokens := 0
		for i, p := range pending {
			inputs[i] = chunk.EmbeddingInput(t.DocumentName, p.HeadingPath, p.Content)
			ids[i] = p.ID
			tokens += r.cfg.Chunk.Tokens(inputs[i])
		}
		started := time.Now()
		vectors, err := r.embedder.Embed(ctx, inputs)
		if err != nil {
			return err
		}
		completed, err = r.store.SaveEmbeddings(ctx, c, ids, vectors)
		if err != nil {
			return dbError(err)
		}
		if err := r.store.RecordAIRun(ctx, store.AIRun{
			OrganizationID: t.OrganizationID, JobID: t.JobID, Model: r.embedder.Model(), Operation: "EMBEDDING",
			InputTokens: tokens, Estimated: true, Latency: time.Since(started),
		}); err != nil {
			log.Warn("ai run not recorded", "error", err)
		}
		if err := r.store.SetStage(ctx, c, "EMBEDDING", 40+55*completed/max(total, 1)); err != nil {
			return dbError(err)
		}
	}
}

func (r *Runner) heartbeat(ctx context.Context, cancel context.CancelFunc, c *store.Claim, log *slog.Logger) func() {
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(heartbeatInterval)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
				err := r.store.Heartbeat(ctx, c)
				if errors.Is(err, store.ErrClaimLost) {
					log.Warn("claim lost, stopping")
					cancel()
					return
				}
				if err != nil {
					log.Warn("heartbeat failed", "error", err)
				}
			}
		}
	}()
	return func() { close(done) }
}

func (r *Runner) fail(ctx context.Context, log *slog.Logger, c *store.Claim, t *store.Target, stage string, err error, timedOut bool) Outcome {
	if errors.Is(err, store.ErrClaimLost) || errors.Is(err, context.Canceled) {
		log.Warn("claim lost, leaving the job to its new owner")
		return Outcome{http.StatusOK, "claim_lost", ""}
	}
	var f *failure.Error
	switch {
	case errors.Is(err, store.ErrSuperseded):
		f = failure.Permanent(failure.Superseded, err)
	case timedOut:
		f = failure.Transient(failure.Timeout, err)
	case !errors.As(err, &f):
		f = failure.Transient(failure.Internal, err)
	}
	if !f.Permanent && c.Attempt >= r.cfg.MaxAttempts {
		f = failure.Permanent(failure.RetriesExhausted, f)
	}

	writeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	if err := r.store.Fail(writeCtx, c, stage, f.Code, f.Error(), f.Permanent); err != nil {
		if errors.Is(err, store.ErrClaimLost) {
			return Outcome{http.StatusOK, "claim_lost", ""}
		}
		log.Error("recording the failure failed", "error", err)
		return Outcome{http.StatusServiceUnavailable, "retry", failure.DatabaseUnavailable}
	}
	log.Warn("job failed", "code", f.Code, "permanent", f.Permanent, "stage", stage, "error", f.Err)
	if f.Code == failure.Superseded {
		return Outcome{http.StatusOK, "superseded", f.Code}
	}
	if f.Permanent {
		if err := r.store.AuditFailure(writeCtx, t, f.Code); err != nil {
			log.Warn("failure not audited", "error", err)
		}
		return Outcome{http.StatusUnprocessableEntity, "failed", f.Code}
	}
	return Outcome{http.StatusServiceUnavailable, "retry", f.Code}
}

func dbError(err error) error {
	var f *failure.Error
	if errors.Is(err, store.ErrClaimLost) || errors.Is(err, store.ErrSuperseded) ||
		errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || errors.As(err, &f) {
		return err
	}
	return failure.Transient(failure.DatabaseUnavailable, err)
}
