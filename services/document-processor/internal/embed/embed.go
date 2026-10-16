package embed

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"golang.org/x/time/rate"

	"dossier/services/document-processor/internal/failure"
)

const (
	Dimensions     = 1536
	BatchSize      = 100
	DefaultBaseURL = "https://generativelanguage.googleapis.com"
)

// Gemini says where requests go: Google directly, or a Cloudflare AI Gateway
// whose base URL ends in /google-ai-studio and which needs GatewayToken.
type Gemini struct {
	BaseURL      string
	APIKey       string
	GatewayToken string
}

type Embedder struct {
	gemini  Gemini
	model   string
	client  *http.Client
	limiter *rate.Limiter
}

func New(gemini Gemini, model string, requestsPerMinute int) *Embedder {
	gemini.BaseURL = strings.TrimRight(gemini.BaseURL, "/")
	return &Embedder{
		gemini:  gemini,
		model:   model,
		client:  &http.Client{Timeout: 60 * time.Second},
		limiter: rate.NewLimiter(rate.Every(time.Minute/time.Duration(requestsPerMinute)), 1),
	}
}

func (e *Embedder) Model() string { return e.model }

type part struct {
	Text string `json:"text"`
}

type content struct {
	Parts []part `json:"parts"`
}

type item struct {
	Model                string  `json:"model"`
	Content              content `json:"content"`
	TaskType             string  `json:"taskType"`
	OutputDimensionality int     `json:"outputDimensionality"`
}

type response struct {
	Embeddings []struct {
		Values []float32 `json:"values"`
	} `json:"embeddings"`
}

func (e *Embedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	requests := make([]item, len(texts))
	for i, text := range texts {
		requests[i] = item{
			Model:                "models/" + e.model,
			Content:              content{Parts: []part{{Text: text}}},
			TaskType:             "RETRIEVAL_DOCUMENT",
			OutputDimensionality: Dimensions,
		}
	}
	payload, err := json.Marshal(map[string]any{"requests": requests})
	if err != nil {
		return nil, err
	}
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(1<<(attempt-1)) * time.Second):
			}
		}
		if err := e.limiter.Wait(ctx); err != nil {
			return nil, err
		}
		vectors, retry, err := e.call(ctx, payload, len(texts))
		if err == nil {
			return vectors, nil
		}
		lastErr = err
		if !retry || ctx.Err() != nil {
			break
		}
	}
	return nil, failure.Transient(failure.ProviderUnavailable, lastErr)
}

func (e *Embedder) call(ctx context.Context, payload []byte, count int) ([][]float32, bool, error) {
	url := fmt.Sprintf("%s/v1beta/models/%s:batchEmbedContents", e.gemini.BaseURL, e.model)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, false, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-goog-api-key", e.gemini.APIKey)
	if e.gemini.GatewayToken != "" {
		request.Header.Set("cf-aig-authorization", "Bearer "+e.gemini.GatewayToken)
	}
	res, err := e.client.Do(request)
	if err != nil {
		return nil, true, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusTooManyRequests || res.StatusCode >= 500 {
		return nil, true, fmt.Errorf("gemini %d", res.StatusCode)
	}
	if res.StatusCode != http.StatusOK {
		detail, _ := io.ReadAll(io.LimitReader(res.Body, 300))
		return nil, false, fmt.Errorf("gemini %d: %s", res.StatusCode, detail)
	}
	var parsed response
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, true, err
	}
	if len(parsed.Embeddings) != count {
		return nil, false, fmt.Errorf("gemini returned %d embeddings for %d inputs", len(parsed.Embeddings), count)
	}
	vectors := make([][]float32, count)
	for i, embedding := range parsed.Embeddings {
		if len(embedding.Values) != Dimensions {
			return nil, false, errors.New("gemini returned the wrong vector size")
		}
		for _, x := range embedding.Values {
			if math.IsNaN(float64(x)) || math.IsInf(float64(x), 0) {
				return nil, false, errors.New("gemini returned a non-finite vector value")
			}
		}
		vectors[i] = normalize(embedding.Values)
	}
	return vectors, false, nil
}

// normalize scales to unit length, which Google recommends for outputs below 3,072 dimensions.
func normalize(v []float32) []float32 {
	var sum float64
	for _, x := range v {
		sum += float64(x) * float64(x)
	}
	if sum == 0 {
		return v
	}
	norm := float32(math.Sqrt(sum))
	out := make([]float32, len(v))
	for i, x := range v {
		out[i] = x / norm
	}
	return out
}
