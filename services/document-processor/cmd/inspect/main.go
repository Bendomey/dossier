package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"dossier/services/document-processor/internal/chunk"
	"dossier/services/document-processor/internal/config"
	"dossier/services/document-processor/internal/extract"
	"dossier/services/document-processor/internal/failure"
	"dossier/services/document-processor/internal/gemini"
	"dossier/services/document-processor/internal/lang"
	"dossier/services/document-processor/internal/ocr"
)

func main() {
	showChunks := flag.Bool("chunks", false, "print chunks instead of blocks")
	useOCR := flag.Bool("ocr", false, "read flagged PDF pages with Gemini (sends them to Google; costs money)")
	ocrFrom := flag.String("ocr-from", "", "read flagged pages from <dir>/page-<n>.md instead of Gemini")
	flag.Parse()
	path := flag.Arg(0)
	if path == "" {
		fmt.Fprintln(os.Stderr, "usage: inspect [-chunks] [-ocr | -ocr-from dir] <file>")
		os.Exit(2)
	}
	format, ok := extract.FormatOf(path)
	if !ok {
		fmt.Fprintln(os.Stderr, "unsupported file type")
		os.Exit(1)
	}
	doc, err := extract.Extract(context.Background(), path, format)
	if err != nil {
		fmt.Fprintln(os.Stderr, "extract:", err)
		os.Exit(1)
	}
	if len(doc.FlaggedPages) > 0 && (*useOCR || *ocrFrom != "") {
		if doc, err = readScannedPages(context.Background(), path, doc, *ocrFrom); err != nil {
			fmt.Fprintln(os.Stderr, "ocr:", err)
			os.Exit(1)
		}
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)

	if !*showChunks {
		kinds := map[extract.BlockKind]int{}
		for _, b := range doc.Blocks {
			kinds[b.Kind]++
		}
		fmt.Fprintf(os.Stderr, "format %s, pages %d, blocks %v, flagged pages %v, has text %t\n",
			doc.Format, doc.PageCount, kinds, doc.FlaggedPages, doc.HasText())
		_ = encoder.Encode(doc)
		return
	}

	options, err := config.ChunkOptions()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	chunks := chunk.Split(doc, options)
	smallest, largest, total := 0, 0, 0
	for i := range chunks {
		chunks[i].Language = lang.Detect(chunks[i].Content)
		t := chunks[i].TokenCount
		total += t
		if i == 0 || t < smallest {
			smallest = t
		}
		largest = max(largest, t)
	}
	average := 0
	if len(chunks) > 0 {
		average = total / len(chunks)
	}
	fmt.Fprintf(os.Stderr, "chunks %d, tokens min %d / avg %d / max %d, language %q\n",
		len(chunks), smallest, average, largest, lang.Majority(chunks))
	_ = encoder.Encode(chunks)
}

func readScannedPages(ctx context.Context, path string, doc *extract.Document, from string) (*extract.Document, error) {
	if len(doc.FlaggedPages) > ocr.MaxPages {
		return nil, fmt.Errorf("%d scanned pages, more than the %d allowed", len(doc.FlaggedPages), ocr.MaxPages)
	}
	texts := map[int]string{}
	if from != "" {
		for _, n := range doc.FlaggedPages {
			data, err := os.ReadFile(filepath.Join(from, fmt.Sprintf("page-%d.md", n)))
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			if err != nil {
				return nil, err
			}
			texts[n] = ocr.Clean(string(data))
		}
		return extract.MergeOCR(doc, texts), nil
	}

	_ = godotenv.Load()
	settings := config.GeminiSettings()
	if settings.APIKey == "" {
		return nil, errors.New("GEMINI_API_KEY is not set (put it in .env)")
	}
	reader := ocr.NewReader(gemini.New(settings, 2*time.Minute, 0), config.OCRModel())
	dir, err := os.MkdirTemp("", "inspect-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	for _, n := range doc.FlaggedPages {
		image, err := extract.RenderPage(ctx, path, n, dir)
		var f *failure.Error
		if errors.As(err, &f) && f.Code == failure.CorruptFile {
			fmt.Fprintf(os.Stderr, "page %d: could not be rendered, unreadable\n", n)
			continue
		}
		if err != nil {
			return nil, err
		}
		started := time.Now()
		page, sent, err := reader.Read(ctx, image, n)
		if err != nil {
			return nil, err
		}
		fmt.Fprintf(os.Stderr, "page %d: model %s, sent %t, unreadable %t, tokens in %d / out %d, %d ms\n",
			n, reader.Model(), sent, page.Unreadable, page.InputTokens, page.OutputTokens, time.Since(started).Milliseconds())
		if !page.Unreadable && strings.TrimSpace(page.Text) != "" {
			texts[n] = page.Text
		}
	}
	return extract.MergeOCR(doc, texts), nil
}
