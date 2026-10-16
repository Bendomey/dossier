package embed

import (
	"context"
	"errors"
	"fmt"
	"math"

	"dossier/services/document-processor/internal/failure"
	"dossier/services/document-processor/internal/gemini"
)

const (
	Dimensions = 1536
	BatchSize  = 100
)

type Embedder struct {
	client *gemini.Client
	model  string
}

func New(client *gemini.Client, model string) *Embedder {
	return &Embedder{client: client, model: model}
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
	var parsed response
	if err := e.client.Call(ctx, e.model, "batchEmbedContents", map[string]any{"requests": requests}, &parsed); err != nil {
		return nil, err
	}
	vectors, err := vectorsOf(parsed, len(texts))
	if err != nil {
		return nil, failure.Transient(failure.ProviderUnavailable, err)
	}
	return vectors, nil
}

func vectorsOf(parsed response, count int) ([][]float32, error) {
	if len(parsed.Embeddings) != count {
		return nil, fmt.Errorf("gemini returned %d embeddings for %d inputs", len(parsed.Embeddings), count)
	}
	vectors := make([][]float32, count)
	for i, embedding := range parsed.Embeddings {
		if len(embedding.Values) != Dimensions {
			return nil, errors.New("gemini returned the wrong vector size")
		}
		for _, x := range embedding.Values {
			if math.IsNaN(float64(x)) || math.IsInf(float64(x), 0) {
				return nil, errors.New("gemini returned a non-finite vector value")
			}
		}
		vectors[i] = normalize(embedding.Values)
	}
	return vectors, nil
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
