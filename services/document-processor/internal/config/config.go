package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"dossier/services/document-processor/internal/chunk"
	"dossier/services/document-processor/internal/extract"
	"dossier/services/document-processor/internal/gemini"
)

const DefaultOCRModel = "gemini-2.5-flash-lite"

type R2 struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
}

type Config struct {
	Port                   string
	DatabaseURL            string
	R2                     R2
	Gemini                 gemini.Settings
	OCRModel               string
	OCRMonthlyPageLimit    int
	EmbeddingModel         string
	EmbedRequestsPerMinute int
	PipelineVersion        string
	Chunk                  chunk.Options
	JobTimeout             time.Duration
	MaxAttempts            int
}

func Load() (Config, error) {
	chunkOptions, err := ChunkOptions()
	if err != nil {
		return Config{}, err
	}
	rpm, err := intEnv("EMBED_REQUESTS_PER_MINUTE", 100)
	if err != nil {
		return Config{}, err
	}
	ocrLimit, err := intEnv("OCR_MONTHLY_PAGE_LIMIT", 500)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{
		Port:        stringEnv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		R2: R2{
			AccountID:       os.Getenv("R2_ACCOUNT_ID"),
			AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
			SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
			Bucket:          os.Getenv("R2_BUCKET"),
		},
		Gemini:                 GeminiSettings(),
		OCRModel:               OCRModel(),
		OCRMonthlyPageLimit:    ocrLimit,
		EmbeddingModel:         stringEnv("EMBEDDING_MODEL", "gemini-embedding-001"),
		EmbedRequestsPerMinute: rpm,
		PipelineVersion:        stringEnv("PIPELINE_VERSION", "1"),
		Chunk:                  chunkOptions,
		JobTimeout:             12 * time.Minute,
		MaxAttempts:            3,
	}
	required := []struct{ name, value string }{
		{"DATABASE_URL", cfg.DatabaseURL},
		{"R2_ACCOUNT_ID", cfg.R2.AccountID},
		{"R2_ACCESS_KEY_ID", cfg.R2.AccessKeyID},
		{"R2_SECRET_ACCESS_KEY", cfg.R2.SecretAccessKey},
		{"R2_BUCKET", cfg.R2.Bucket},
		{"GEMINI_API_KEY", cfg.Gemini.APIKey},
	}
	for _, r := range required {
		if r.value == "" {
			return Config{}, fmt.Errorf("%s is not set", r.name)
		}
	}
	if !strings.HasPrefix(cfg.Gemini.BaseURL, "https://") {
		return Config{}, fmt.Errorf("GEMINI_BASE_URL must start with https://")
	}
	if rpm <= 0 {
		return Config{}, fmt.Errorf("EMBED_REQUESTS_PER_MINUTE must be positive")
	}
	if ocrLimit <= 0 {
		return Config{}, fmt.Errorf("OCR_MONTHLY_PAGE_LIMIT must be positive")
	}
	return cfg, nil
}

func ChunkOptions() (chunk.Options, error) {
	target, err := intEnv("CHUNK_TARGET_TOKENS", 600)
	if err != nil {
		return chunk.Options{}, err
	}
	maxTokens, err := intEnv("CHUNK_MAX_TOKENS", 1000)
	if err != nil {
		return chunk.Options{}, err
	}
	overlap, err := intEnv("CHUNK_OVERLAP_TOKENS", 60)
	if err != nil {
		return chunk.Options{}, err
	}
	charsPerToken, err := floatEnv("CHUNK_CHARS_PER_TOKEN", 3)
	if err != nil {
		return chunk.Options{}, err
	}
	if target <= 0 || maxTokens < target || overlap < 0 || overlap >= target || charsPerToken <= 0 {
		return chunk.Options{}, fmt.Errorf("invalid chunk settings: target %d, max %d, overlap %d, chars per token %g", target, maxTokens, overlap, charsPerToken)
	}
	return chunk.Options{
		TargetTokens:  target,
		MaxTokens:     maxTokens,
		OverlapTokens: overlap,
		CharsPerToken: charsPerToken,
	}, nil
}

// GeminiSettings is shared with cmd/inspect, which runs without a database.
func GeminiSettings() gemini.Settings {
	return gemini.Settings{
		BaseURL:      stringEnv("GEMINI_BASE_URL", gemini.DefaultBaseURL),
		APIKey:       os.Getenv("GEMINI_API_KEY"),
		GatewayToken: os.Getenv("AI_GATEWAY_TOKEN"),
	}
}

func OCRModel() string { return stringEnv("OCR_MODEL", DefaultOCRModel) }

// PipelineSignature is stored on each job so we know which settings produced its chunks.
func (c Config) PipelineSignature() string {
	return fmt.Sprintf("%s;chunk=%d/%d/%d;cpt=%g;extract=%s",
		c.PipelineVersion, c.Chunk.TargetTokens, c.Chunk.MaxTokens,
		c.Chunk.OverlapTokens, c.Chunk.CharsPerToken, extract.Version)
}

func stringEnv(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func intEnv(name string, fallback int) (int, error) {
	value := os.Getenv(name)
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a whole number", name)
	}
	return n, nil
}

func floatEnv(name string, fallback float64) (float64, error) {
	value := os.Getenv(name)
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be a number", name)
	}
	return n, nil
}
