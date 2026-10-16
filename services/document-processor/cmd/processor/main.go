package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"dossier/services/document-processor/internal/blob"
	"dossier/services/document-processor/internal/config"
	"dossier/services/document-processor/internal/embed"
	"dossier/services/document-processor/internal/failure"
	"dossier/services/document-processor/internal/gemini"
	"dossier/services/document-processor/internal/jobs"
	"dossier/services/document-processor/internal/ocr"
	"dossier/services/document-processor/internal/store"
)

func main() {
	_ = godotenv.Load()
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		log.Error("configuration", "error", err)
		os.Exit(1)
	}
	ctx := context.Background()
	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("database", "error", err)
		os.Exit(1)
	}
	defer st.Close()
	embedder := embed.New(gemini.New(cfg.Gemini, 60*time.Second, cfg.EmbedRequestsPerMinute), cfg.EmbeddingModel)
	reader := ocr.NewReader(gemini.New(cfg.Gemini, 2*time.Minute, 0), cfg.OCRModel)
	runner := jobs.NewRunner(cfg, st, blob.New(cfg.R2), embedder, reader, log)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/jobs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var m store.Message
		if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&m); err != nil {
			writeJSON(w, jobs.Outcome{Status: http.StatusUnprocessableEntity, Result: "invalid", Code: failure.InvalidMessage})
			return
		}
		if !runner.TryAcquire() {
			writeJSON(w, jobs.Outcome{Status: http.StatusTooManyRequests, Result: "busy"})
			return
		}
		defer runner.Release()
		// The caller may give up on this request; the job keeps running so its
		// claim and writes stay consistent.
		writeJSON(w, runner.Handle(context.WithoutCancel(r.Context()), m))
	})

	server := &http.Server{Addr: ":" + cfg.Port, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	drained := make(chan struct{})
	go func() {
		defer close(drained)
		signals := make(chan os.Signal, 1)
		signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
		<-signals
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Info("processor listening", "port", cfg.Port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("server", "error", err)
		os.Exit(1)
	}
	<-drained
}

func writeJSON(w http.ResponseWriter, outcome jobs.Outcome) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(outcome.Status)
	_ = json.NewEncoder(w).Encode(outcome)
}
