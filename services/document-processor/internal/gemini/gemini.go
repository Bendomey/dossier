package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/time/rate"

	"dossier/services/document-processor/internal/failure"
)

const DefaultBaseURL = "https://generativelanguage.googleapis.com"

// Settings says where requests go: Google directly, or a Cloudflare AI Gateway
// whose base URL ends in /google-ai-studio and which needs GatewayToken.
type Settings struct {
	BaseURL      string
	APIKey       string
	GatewayToken string
}

type Client struct {
	settings Settings
	http     *http.Client
	limiter  *rate.Limiter
}

// New limits requests to requestsPerMinute; 0 means no limit.
func New(settings Settings, timeout time.Duration, requestsPerMinute int) *Client {
	settings.BaseURL = strings.TrimRight(settings.BaseURL, "/")
	limiter := rate.NewLimiter(rate.Inf, 1)
	if requestsPerMinute > 0 {
		limiter = rate.NewLimiter(rate.Every(time.Minute/time.Duration(requestsPerMinute)), 1)
	}
	return &Client{settings: settings, http: &http.Client{Timeout: timeout}, limiter: limiter}
}

// StatusError is a reply the provider will not change on retry, such as a
// request it rejects as invalid.
type StatusError struct {
	Code   int
	Detail string
}

func (e *StatusError) Error() string { return fmt.Sprintf("gemini %d: %s", e.Code, e.Detail) }

// RejectsContent reports a 400 about the request's content. Gemini also
// answers 400 for a bad or expired key and an unsupported region; those are
// outages to retry once fixed, not a verdict on the page.
func (e *StatusError) RejectsContent() bool {
	return e.Code == http.StatusBadRequest &&
		!strings.Contains(e.Detail, "API_KEY_") && !strings.Contains(e.Detail, "FAILED_PRECONDITION")
}

// Call posts payload to models/{model}:{method} and decodes a 200 reply into
// out. 429s, 5xx and network errors are retried up to 3 times; any failure
// comes back as PROVIDER_UNAVAILABLE so the job is retried later.
func (c *Client) Call(ctx context.Context, model, method string, payload, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Duration(1<<(attempt-1)) * time.Second):
			}
		}
		if err := c.limiter.Wait(ctx); err != nil {
			return err
		}
		retry, err := c.post(ctx, model, method, body, out)
		if err == nil {
			return nil
		}
		lastErr = err
		if !retry || ctx.Err() != nil {
			break
		}
	}
	return failure.Transient(failure.ProviderUnavailable, lastErr)
}

func (c *Client) post(ctx context.Context, model, method string, body []byte, out any) (bool, error) {
	url := fmt.Sprintf("%s/v1beta/models/%s:%s", c.settings.BaseURL, model, method)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-goog-api-key", c.settings.APIKey)
	if c.settings.GatewayToken != "" {
		request.Header.Set("cf-aig-authorization", "Bearer "+c.settings.GatewayToken)
	}
	res, err := c.http.Do(request)
	if err != nil {
		return true, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusTooManyRequests || res.StatusCode >= 500 {
		return true, fmt.Errorf("gemini %d", res.StatusCode)
	}
	if res.StatusCode != http.StatusOK {
		detail, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		return false, &StatusError{Code: res.StatusCode, Detail: string(detail)}
	}
	if err := json.NewDecoder(res.Body).Decode(out); err != nil {
		return true, err
	}
	return false, nil
}
