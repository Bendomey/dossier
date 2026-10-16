package extract

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"unicode"

	"dossier/services/document-processor/internal/failure"
)

// Version names the extraction output format; cached artifacts are keyed by it.
const Version = "x3"

const MaxPages = 300

type BlockKind string

const (
	Heading   BlockKind = "heading"
	Paragraph BlockKind = "paragraph"
	ListItem  BlockKind = "list_item"
	Table     BlockKind = "table"
)

type Source string

const (
	Native Source = "native"
	OCR    Source = "ocr"
)

type Block struct {
	Kind          BlockKind `json:"kind"`
	Level         int       `json:"level,omitempty"`
	Text          string    `json:"text"`
	PageStart     int       `json:"page_start,omitempty"`
	PageEnd       int       `json:"page_end,omitempty"`
	SectionNumber string    `json:"section_number,omitempty"`
	Source        Source    `json:"source"`
}

type Document struct {
	Format    string  `json:"format"`
	PageCount int     `json:"page_count"`
	Blocks    []Block `json:"blocks"`
	// Pages whose text layer is too thin to trust; after OCR, the ones it could not read.
	FlaggedPages []int `json:"flagged_pages,omitempty"`
}

func FormatOf(fileName string) (string, bool) {
	format := strings.TrimPrefix(strings.ToLower(filepath.Ext(fileName)), ".")
	switch format {
	case "pdf", "docx", "txt", "md":
		return format, true
	}
	return "", false
}

func Extract(ctx context.Context, path, format string) (*Document, error) {
	var (
		doc *Document
		err error
	)
	switch format {
	case "pdf":
		doc, err = extractPDF(ctx, path)
	case "docx":
		doc, err = extractDOCX(path)
	case "txt":
		doc, err = extractText(path, false)
	case "md":
		doc, err = extractText(path, true)
	default:
		return nil, failure.Permanent(failure.UnsupportedFormat, fmt.Errorf("format %q", format))
	}
	if err != nil {
		return nil, err
	}
	doc.Format = format
	doc.Blocks = sanitizeBlocks(doc.Blocks)
	assignSectionNumbers(doc.Blocks)
	return doc, nil
}

// MergeOCR swaps the native blocks of pages read by OCR for blocks parsed from
// their Markdown transcriptions, keeping page order. A native block that also
// covers an unread page is kept.
func MergeOCR(doc *Document, texts map[int]string) *Document {
	merged := *doc
	if len(texts) == 0 {
		return &merged
	}
	numbers := make([]int, 0, len(texts))
	for n := range texts {
		numbers = append(numbers, n)
	}
	slices.Sort(numbers)
	ocrBlocks := func(page int) []Block {
		blocks := sanitizeBlocks(parseText(texts[page], true))
		for i := range blocks {
			blocks[i].Source = OCR
			blocks[i].PageStart = page
			blocks[i].PageEnd = page
		}
		return blocks
	}
	replaced := func(b Block) bool {
		if b.PageStart == 0 {
			return false
		}
		for p := b.PageStart; p <= max(b.PageEnd, b.PageStart); p++ {
			if _, ok := texts[p]; !ok {
				return false
			}
		}
		return true
	}
	merged.Blocks = make([]Block, 0, len(doc.Blocks))
	next := 0
	for _, b := range doc.Blocks {
		if replaced(b) {
			continue
		}
		for next < len(numbers) && numbers[next] <= b.PageStart {
			merged.Blocks = append(merged.Blocks, ocrBlocks(numbers[next])...)
			next++
		}
		merged.Blocks = append(merged.Blocks, b)
	}
	for ; next < len(numbers); next++ {
		merged.Blocks = append(merged.Blocks, ocrBlocks(numbers[next])...)
	}
	merged.FlaggedPages = slices.DeleteFunc(slices.Clone(doc.FlaggedPages), func(n int) bool {
		_, ok := texts[n]
		return ok
	})
	assignSectionNumbers(merged.Blocks)
	return &merged
}

// sanitizeBlocks strips control characters (Postgres rejects NUL in text) and
// drops blocks left empty.
func sanitizeBlocks(blocks []Block) []Block {
	clean := make([]Block, 0, len(blocks))
	for _, b := range blocks {
		b.Text = strings.ToValidUTF8(b.Text, "")
		b.Text = strings.Map(func(r rune) rune {
			if unicode.IsControl(r) && r != '\n' && r != '\t' {
				return -1
			}
			return r
		}, b.Text)
		if strings.TrimSpace(b.Text) == "" {
			continue
		}
		clean = append(clean, b)
	}
	return clean
}

func (d *Document) HasText() bool {
	for _, b := range d.Blocks {
		if b.Kind != Heading && meaningfulChars(b.Text) > 0 {
			return true
		}
	}
	return false
}

func collapseSpaces(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func meaningfulChars(s string) int {
	n := 0
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			n++
		}
	}
	return n
}

// garbageRatio is the share of characters that broken font encodings produce.
func garbageRatio(s string) float64 {
	total, bad := 0, 0
	for _, r := range s {
		if unicode.IsSpace(r) {
			continue
		}
		total++
		if r == '�' || unicode.Is(unicode.Co, r) || unicode.IsControl(r) {
			bad++
		}
	}
	if total == 0 {
		return 0
	}
	return float64(bad) / float64(total)
}

func readLimited(path string, limit int64) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("file larger than %d bytes", limit)
	}
	return data, nil
}
