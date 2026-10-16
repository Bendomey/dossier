package blob

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"

	"dossier/services/document-processor/internal/config"
)

var (
	ErrNotFound = errors.New("object not found")
	ErrTooLarge = errors.New("object too large")
)

const maxArtifactBytes = 64 << 20

type Store struct {
	client *s3.Client
	bucket string
}

func New(cfg config.R2) *Store {
	client := s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)),
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		// R2 rejects the SDK's default request checksums.
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
		ResponseChecksumValidation: aws.ResponseChecksumValidationWhenRequired,
	})
	return &Store{client: client, bucket: cfg.Bucket}
}

func (b *Store) get(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := b.client.GetObject(ctx, &s3.GetObjectInput{Bucket: &b.bucket, Key: &key})
	if err != nil {
		var noSuchKey *types.NoSuchKey
		var apiErr smithy.APIError
		if errors.As(err, &noSuchKey) || (errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchKey") {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return out.Body, nil
}

// Download streams the object to a file, never holding it in memory, and
// returns its SHA-256.
func (b *Store) Download(ctx context.Context, key, destination string, maxBytes int64) (string, int64, error) {
	body, err := b.get(ctx, key)
	if err != nil {
		return "", 0, err
	}
	defer body.Close()
	f, err := os.Create(destination)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	hash := sha256.New()
	n, err := io.Copy(io.MultiWriter(f, hash), io.LimitReader(body, maxBytes+1))
	if err != nil {
		return "", 0, err
	}
	if n > maxBytes {
		return "", 0, ErrTooLarge
	}
	return hex.EncodeToString(hash.Sum(nil)), n, nil
}

func (b *Store) GetJSON(ctx context.Context, key string, v any) (bool, error) {
	body, err := b.get(ctx, key)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer body.Close()
	if err := json.NewDecoder(io.LimitReader(body, maxArtifactBytes)).Decode(v); err != nil {
		return false, err
	}
	return true, nil
}

func (b *Store) PutJSON(ctx context.Context, key string, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = b.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      &b.bucket,
		Key:         &key,
		Body:        bytes.NewReader(data),
		ContentType: aws.String("application/json"),
	})
	return err
}
