package ocr

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"

	"dossier/services/document-processor/internal/gemini"
)

const (
	MaxPages = 50
	// MaxImageBytes keeps a request well inside Gemini's 20 MB inline limit.
	MaxImageBytes = 15 << 20
	prompt        = "Transcribe verbatim. Keep headings, numbering and tables as Markdown. Do not correct, summarize or translate. Write [illegible] where unreadable."
)

// Page is cached in R2 as soon as it returns, so a retry never pays for it again.
type Page struct {
	Number       int    `json:"page"`
	Model        string `json:"model"`
	Text         string `json:"text"`
	InputTokens  int    `json:"input_tokens,omitempty"`
	OutputTokens int    `json:"output_tokens,omitempty"`
	// Unreadable pages (declined by the model, or too large to send) keep
	// their native text; asking again would get the same answer.
	Unreadable bool `json:"unreadable,omitempty"`
}

func CacheKey(organizationID, versionID string, page int) string {
	return fmt.Sprintf("org/%s/versions/%s/ocr/page-%d.json", organizationID, versionID, page)
}

type Reader struct {
	client *gemini.Client
	model  string
}

func NewReader(client *gemini.Client, model string) *Reader {
	return &Reader{client: client, model: model}
}

func (r *Reader) Model() string { return r.model }

type generateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text    string `json:"text"`
				Thought bool   `json:"thought"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	PromptFeedback struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
	} `json:"usageMetadata"`
}

func (r *Reader) Read(ctx context.Context, imagePath string, page int) (Page, bool, error) {
	result := Page{Number: page, Model: r.model}
	image, err := os.ReadFile(imagePath)
	if err != nil {
		return Page{}, false, err
	}
	if len(image) > MaxImageBytes {
		result.Unreadable = true
		return result, false, nil
	}
	payload := map[string]any{
		"contents": []any{map[string]any{
			"role": "user",
			"parts": []any{
				map[string]any{"inlineData": map[string]any{"mimeType": "image/png", "data": base64.StdEncoding.EncodeToString(image)}},
				map[string]any{"text": prompt},
			},
		}},
		"generationConfig": map[string]any{
			"temperature":     0,
			"maxOutputTokens": 8192,
			"thinkingConfig":  map[string]any{"thinkingBudget": 0},
		},
	}
	var res generateResponse
	if err := r.client.Call(ctx, r.model, "generateContent", payload, &res); err != nil {
		var rejected *gemini.StatusError
		if errors.As(err, &rejected) && rejected.RejectsContent() {
			result.Unreadable = true
			return result, true, nil
		}
		return Page{}, true, err
	}
	result.InputTokens = res.UsageMetadata.PromptTokenCount
	result.OutputTokens = res.UsageMetadata.CandidatesTokenCount
	if res.PromptFeedback.BlockReason != "" || len(res.Candidates) == 0 {
		result.Unreadable = true
		return result, true, nil
	}
	candidate := res.Candidates[0]
	if candidate.FinishReason != "STOP" && candidate.FinishReason != "MAX_TOKENS" {
		result.Unreadable = true
		return result, true, nil
	}
	var text strings.Builder
	for _, p := range candidate.Content.Parts {
		if !p.Thought {
			text.WriteString(p.Text)
		}
	}
	result.Text = Clean(text.String())
	return result, true, nil
}

// Clean removes the ```markdown wrapper models often add: inside a fence the
// Markdown parser would read the whole page as one paragraph.
func Clean(text string) string {
	text = strings.TrimSpace(text)
	if !strings.HasPrefix(text, "```") {
		return text
	}
	newline := strings.IndexByte(text, '\n')
	if newline < 0 {
		return ""
	}
	text = strings.TrimSpace(text[newline+1:])
	return strings.TrimSpace(strings.TrimSuffix(text, "```"))
}
