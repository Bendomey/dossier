package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"

	"dossier/services/document-processor/internal/store"
)

// enqueue posts a queued job to the local processor, for when the app's
// direct dispatch didn't reach it (the processor wasn't running).
func main() {
	_ = godotenv.Load()
	jobID := flag.String("job", "", "indexing job id")
	url := flag.String("url", "http://localhost:8080/jobs", "processor endpoint")
	flag.Parse()
	if *jobID == "" {
		fmt.Fprintln(os.Stderr, "usage: enqueue -job <indexing job id>")
		os.Exit(2)
	}
	ctx := context.Background()
	st, err := store.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer st.Close()
	m, err := st.MessageForJob(ctx, *jobID)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	m.EventID = newUUID()
	body, _ := json.Marshal(m)
	client := &http.Client{Timeout: 15 * time.Minute}
	res, err := client.Post(*url, "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer res.Body.Close()
	reply, _ := io.ReadAll(res.Body)
	fmt.Printf("%d %s", res.StatusCode, reply)
}

func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
