package extract

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"dossier/services/document-processor/internal/failure"
)

const (
	commandTimeout  = 2 * time.Minute
	minPageChars    = 50
	maxGarbageRatio = 0.3
)

var (
	markupTag       = regexp.MustCompile(`<[^>]+>`)
	digits          = regexp.MustCompile(`\d+`)
	pageNumberLine  = regexp.MustCompile(`(?i)^(?:page|p\.)?\s*\d+(?:\s*(?:/|of|sur|de)\s*\d+)?$`)
	listItemPattern = regexp.MustCompile(`^(?:[•▪◦‣–*-]|\(?[a-z0-9]{1,3}[.)])\s+`)
)

type xmlPage struct {
	Number int       `xml:"number,attr"`
	Height float64   `xml:"height,attr"`
	Fonts  []xmlFont `xml:"fontspec"`
	Texts  []xmlText `xml:"text"`
}

type xmlFont struct {
	ID   string  `xml:"id,attr"`
	Size float64 `xml:"size,attr"`
}

type xmlText struct {
	Top    float64 `xml:"top,attr"`
	Left   float64 `xml:"left,attr"`
	Height float64 `xml:"height,attr"`
	Font   string  `xml:"font,attr"`
	Inner  string  `xml:",innerxml"`
}

type pdfLine struct {
	page       int
	top        float64
	bottom     float64
	pageHeight float64
	size       float64
	bold       bool
	text       string
}

func extractPDF(ctx context.Context, path string) (*Document, error) {
	pages, encrypted, err := pdfInfo(ctx, path)
	if err != nil {
		return nil, err
	}
	if encrypted {
		return nil, failure.Permanent(failure.Encrypted, errors.New("password-protected"))
	}
	if pages == 0 {
		return nil, failure.Permanent(failure.CorruptFile, errors.New("no pages"))
	}
	if pages > MaxPages {
		return nil, failure.Permanent(failure.TooManyPages, fmt.Errorf("%d pages", pages))
	}
	xmlPages, err := pdfToXML(ctx, path)
	if err != nil {
		return nil, err
	}
	lines := linesOf(xmlPages)
	lines = dropRunningLines(lines, pages)
	doc := &Document{PageCount: pages, FlaggedPages: flaggedPages(lines, pages)}
	doc.Blocks = blocksFromLines(lines)
	return doc, nil
}

func run(ctx context.Context, name string, args ...string) ([]byte, error) {
	commandCtx, cancel := context.WithTimeout(ctx, commandTimeout)
	defer cancel()
	output, err := exec.CommandContext(commandCtx, name, args...).CombinedOutput()
	if err != nil && commandCtx.Err() != nil {
		if errors.Is(commandCtx.Err(), context.DeadlineExceeded) {
			return output, failure.Transient(failure.Timeout, fmt.Errorf("%s took too long", name))
		}
		return output, commandCtx.Err()
	}
	return output, err
}

func toolFailure(err error, message string) error {
	var f *failure.Error
	if errors.As(err, &f) {
		return f
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) && exitErr.ExitCode() > 0 {
		return failure.Permanent(failure.CorruptFile, errors.New(message))
	}
	return failure.Transient(failure.Internal, err)
}

func pdfInfo(ctx context.Context, path string) (int, bool, error) {
	output, err := run(ctx, "pdfinfo", path)
	if err != nil {
		if strings.Contains(strings.ToLower(string(output)), "incorrect password") {
			return 0, true, nil
		}
		return 0, false, toolFailure(err, "pdfinfo could not read the file")
	}
	pages := 0
	for _, line := range strings.Split(string(output), "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		value = strings.TrimSpace(value)
		switch strings.TrimSpace(key) {
		case "Pages":
			pages, _ = strconv.Atoi(value)
		}
	}
	return pages, false, nil
}

func pdfToXML(ctx context.Context, path string) ([]xmlPage, error) {
	dir, err := os.MkdirTemp("", "pdfxml-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	base := filepath.Join(dir, "doc")
	if _, err := run(ctx, "pdftohtml", "-xml", "-i", "-q", "-nodrm", "-enc", "UTF-8", path, base); err != nil {
		return nil, toolFailure(err, "pdftohtml could not read the file")
	}
	f, err := os.Open(base + ".xml")
	if err != nil {
		return nil, failure.Permanent(failure.CorruptFile, err)
	}
	defer f.Close()
	decoder := xml.NewDecoder(f)
	decoder.Strict = false
	decoder.AutoClose = xml.HTMLAutoClose
	decoder.Entity = xml.HTMLEntity
	var parsed struct {
		Pages []xmlPage `xml:"page"`
	}
	if err := decoder.Decode(&parsed); err != nil {
		return nil, failure.Permanent(failure.CorruptFile, err)
	}
	return parsed.Pages, nil
}

func linesOf(pages []xmlPage) []pdfLine {
	fonts := map[string]float64{}
	for _, p := range pages {
		for _, f := range p.Fonts {
			fonts[f.ID] = f.Size
		}
	}
	var lines []pdfLine
	for _, p := range pages {
		texts := p.Texts
		var current *pdfLine
		for _, t := range texts {
			content := collapseSpaces(html.UnescapeString(markupTag.ReplaceAllString(t.Inner, "")))
			if content == "" {
				continue
			}
			bold := strings.Contains(t.Inner, "<b>")
			size := fonts[t.Font]
			if current != nil && math.Abs(t.Top-current.top) < 3 {
				current.text += " " + content
				current.bold = current.bold && bold
				current.size = math.Max(current.size, size)
				current.bottom = math.Max(current.bottom, t.Top+t.Height)
				continue
			}
			if current != nil {
				lines = append(lines, *current)
			}
			current = &pdfLine{page: p.Number, top: t.Top, bottom: t.Top + t.Height, pageHeight: p.Height, size: size, bold: bold, text: content}
		}
		if current != nil {
			lines = append(lines, *current)
		}
	}
	return lines
}

func flaggedPages(lines []pdfLine, pageCount int) []int {
	text := make([]strings.Builder, pageCount+1)
	for _, l := range lines {
		if l.page >= 1 && l.page <= pageCount {
			text[l.page].WriteString(l.text)
			text[l.page].WriteByte(' ')
		}
	}
	var flagged []int
	for page := 1; page <= pageCount; page++ {
		content := text[page].String()
		if meaningfulChars(content) < minPageChars || garbageRatio(content) > maxGarbageRatio {
			flagged = append(flagged, page)
		}
	}
	return flagged
}

// dropRunningLines removes headers, footers and page numbers that repeat in
// the top or bottom margin of most pages.
func dropRunningLines(lines []pdfLine, pageCount int) []pdfLine {
	body := bodySize(lines)
	inMargin := func(l pdfLine) bool {
		return l.pageHeight > 0 && (l.top < l.pageHeight*0.08 || l.bottom > l.pageHeight*0.92)
	}
	key := func(l pdfLine) string { return digits.ReplaceAllString(strings.ToLower(l.text), "#") }
	seen := map[string]map[int]bool{}
	for _, l := range lines {
		if inMargin(l) {
			k := key(l)
			if seen[k] == nil {
				seen[k] = map[int]bool{}
			}
			seen[k][l.page] = true
		}
	}
	kept := lines[:0:0]
	for _, l := range lines {
		if inMargin(l) && (pageNumberLine.MatchString(l.text) || (pageCount >= 3 && l.size < body*1.15 && len(seen[key(l)])*2 > pageCount)) {
			continue
		}
		kept = append(kept, l)
	}
	return kept
}

func bodySize(lines []pdfLine) float64 {
	weight := map[float64]int{}
	for _, l := range lines {
		weight[math.Round(l.size*2)/2] += utf8.RuneCountInString(l.text)
	}
	best, bestWeight := 0.0, -1
	for size, w := range weight {
		if w > bestWeight || (w == bestWeight && size < best) {
			best, bestWeight = size, w
		}
	}
	return best
}

func isHeading(l pdfLine, body float64) bool {
	n := utf8.RuneCountInString(l.text)
	if n == 0 || n > 150 || body == 0 {
		return false
	}
	if l.size >= body*1.15 {
		return true
	}
	return l.bold && n <= 120 && !strings.HasSuffix(l.text, ".") && l.size >= body*0.95
}

func headingLevels(lines []pdfLine, body float64) func(pdfLine) int {
	var sizes []float64
	for _, l := range lines {
		if isHeading(l, body) && l.size >= body*1.15 {
			rounded := math.Round(l.size*2) / 2
			if !slices.Contains(sizes, rounded) {
				sizes = append(sizes, rounded)
			}
		}
	}
	sort.Sort(sort.Reverse(sort.Float64Slice(sizes)))
	return func(l pdfLine) int {
		rounded := math.Round(l.size*2) / 2
		if i := slices.Index(sizes, rounded); i >= 0 {
			return min(i+1, 3)
		}
		return min(len(sizes)+1, 4)
	}
}

func blocksFromLines(lines []pdfLine) []Block {
	body := bodySize(lines)
	pitch := linePitch(lines)
	lines = demoteBoldRuns(lines, body, pitch)
	levelOf := headingLevels(lines, body)
	var blocks []Block
	var previous *pdfLine
	for i := range lines {
		l := lines[i]
		last := len(blocks) - 1
		switch {
		case isHeading(l, body):
			level := levelOf(l)
			if last >= 0 && blocks[last].Kind == Heading && blocks[last].Level == level && previous != nil &&
				previous.page == l.page && isHeading(*previous, body) && l.top-previous.bottom < (previous.bottom-previous.top) {
				blocks[last].Text += " " + l.text
			} else {
				blocks = append(blocks, Block{Kind: Heading, Level: level, Text: l.text, PageStart: l.page, PageEnd: l.page, Source: Native})
			}
		case listItemPattern.MatchString(l.text):
			blocks = append(blocks, Block{Kind: ListItem, Text: l.text, PageStart: l.page, PageEnd: l.page, Source: Native})
		case last >= 0 && (blocks[last].Kind == Paragraph || blocks[last].Kind == ListItem) && continues(previous, l, body, pitch):
			joinLine(&blocks[last], l.text)
			blocks[last].PageEnd = l.page
		default:
			blocks = append(blocks, Block{Kind: Paragraph, Text: l.text, PageStart: l.page, PageEnd: l.page, Source: Native})
		}
		previous = &lines[i]
	}
	for i := range blocks {
		if blocks[i].Kind == Heading && utf8.RuneCountInString(blocks[i].Text) > 150 {
			blocks[i].Kind, blocks[i].Level = Paragraph, 0
		}
	}
	return blocks
}

func continues(previous *pdfLine, l pdfLine, body, pitch float64) bool {
	if previous == nil || isHeading(*previous, body) {
		return false
	}
	if startsClause(l.text) && endsSentence(previous.text) {
		return false
	}
	if previous.page == l.page {
		return l.top-previous.top <= math.Max(pitch*1.3, 2)
	}
	return l.page == previous.page+1 && !endsSentence(previous.text)
}

func endsSentence(s string) bool {
	r, _ := utf8.DecodeLastRuneInString(strings.TrimSpace(s))
	return strings.ContainsRune(".!?:;»”\"", r)
}

func joinLine(b *Block, next string) {
	first, _ := utf8.DecodeRuneInString(next)
	if strings.HasSuffix(b.Text, "-") && unicode.IsLower(first) {
		b.Text = strings.TrimSuffix(b.Text, "-") + next
		return
	}
	b.Text += " " + next
}

func startsClause(text string) bool {
	return dottedNumber.MatchString(text) || keywordNumber.MatchString(text)
}

func linePitch(lines []pdfLine) float64 {
	counts := map[int]int{}
	for i := 1; i < len(lines); i++ {
		d := lines[i].top - lines[i-1].top
		if lines[i].page == lines[i-1].page && d > 0 {
			counts[int(math.Round(d))]++
		}
	}
	best, bestCount := 0, 0
	for d, c := range counts {
		if c > bestCount || (c == bestCount && d < best) {
			best, bestCount = d, c
		}
	}
	return float64(best)
}

// demoteBoldRuns turns a run of adjacent bold-only lines into body text when it
// looks like a bold clause (four or more lines, ends a sentence, or is long);
// a short wrapped title stays a heading.
func demoteBoldRuns(lines []pdfLine, body, pitch float64) []pdfLine {
	boldOnly := func(l pdfLine) bool { return isHeading(l, body) && l.size < body*1.15 }
	adjacent := func(a, b pdfLine) bool { return a.page == b.page && b.top-a.top <= math.Max(pitch*1.3, 2) }
	out := slices.Clone(lines)
	for start := 0; start < len(lines); {
		if !boldOnly(lines[start]) {
			start++
			continue
		}
		end := start + 1
		for end < len(lines) && boldOnly(lines[end]) && adjacent(lines[end-1], lines[end]) {
			end++
		}
		runes := 0
		for _, l := range lines[start:end] {
			runes += utf8.RuneCountInString(l.text)
		}
		if end-start > 1 && (end-start >= 4 || endsSentence(lines[end-1].text) || runes > 120) {
			for k := start; k < end; k++ {
				out[k].bold = false
			}
		}
		start = end
	}
	return out
}
