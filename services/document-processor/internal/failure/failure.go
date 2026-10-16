package failure

import "fmt"

const (
	UnsupportedFormat   = "UNSUPPORTED_FORMAT"
	CorruptFile         = "CORRUPT_FILE"
	Encrypted           = "ENCRYPTED"
	NoTextFound         = "NO_TEXT_FOUND"
	TooManyPages        = "TOO_MANY_PAGES"
	SourceMissing       = "SOURCE_MISSING"
	InvalidMessage      = "INVALID_MESSAGE"
	Superseded          = "SUPERSEDED"
	RetriesExhausted    = "RETRIES_EXHAUSTED"
	ProviderUnavailable = "PROVIDER_UNAVAILABLE"
	StorageUnavailable  = "STORAGE_UNAVAILABLE"
	DatabaseUnavailable = "DATABASE_UNAVAILABLE"
	Timeout             = "TIMEOUT"
	Internal            = "PROCESSING_ERROR"
)

// Error carries the code the app turns into wording. Permanent failures end
// the job; transient ones put it back in the queue.
type Error struct {
	Code      string
	Permanent bool
	Err       error
}

func (e *Error) Error() string { return fmt.Sprintf("%s: %v", e.Code, e.Err) }

func (e *Error) Unwrap() error { return e.Err }

func Permanent(code string, err error) *Error {
	return &Error{Code: code, Permanent: true, Err: err}
}

func Transient(code string, err error) *Error {
	return &Error{Code: code, Err: err}
}
