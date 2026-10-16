package chunk

import (
	"math"
	"strings"
	"unicode"
	"unicode/utf8"

	"dossier/services/document-processor/internal/extract"
)

type Options struct {
	TargetTokens  int
	MaxTokens     int
	OverlapTokens int
	CharsPerToken float64
}

type Chunk struct {
	Index         int      `json:"index"`
	Content       string   `json:"content"`
	HeadingPath   []string `json:"heading_path"`
	SectionTitle  string   `json:"section_title,omitempty"`
	SectionNumber string   `json:"section_number,omitempty"`
	PageStart     int      `json:"page_start,omitempty"`
	PageEnd       int      `json:"page_end,omitempty"`
	TokenCount    int      `json:"token_count"`
	Language      string   `json:"language,omitempty"`
	OCR           bool     `json:"ocr"`
}

// Tokens is an estimate: Gemini's tokenizer is only reachable as a remote
// call, so sizing errs on the side of smaller chunks.
func (o Options) Tokens(s string) int {
	return int(math.Ceil(float64(utf8.RuneCountInString(s)) / o.CharsPerToken))
}

func EmbeddingInput(documentName string, headingPath []string, content string) string {
	context := append([]string{documentName}, headingPath...)
	return strings.Join(context, " › ") + "\n\n" + content
}

type heading struct {
	level  int
	text   string
	number string
}

type piece struct {
	text      string
	pageStart int
	pageEnd   int
	number    string
	ocr       bool
	table     bool
	overlap   bool
}

func Split(doc *extract.Document, o Options) []Chunk {
	var (
		chunks  []Chunk
		stack   []heading
		section []piece
	)
	flush := func() {
		chunks = append(chunks, o.pack(section, stack)...)
		section = nil
	}
	for _, b := range doc.Blocks {
		if strings.TrimSpace(b.Text) == "" {
			continue
		}
		if b.Kind == extract.Heading {
			flush()
			level := max(b.Level, 1)
			for len(stack) > 0 && stack[len(stack)-1].level >= level {
				stack = stack[:len(stack)-1]
			}
			stack = append(stack, heading{level: level, text: b.Text, number: b.SectionNumber})
			continue
		}
		section = append(section, piece{
			text:      b.Text,
			pageStart: b.PageStart,
			pageEnd:   max(b.PageEnd, b.PageStart),
			number:    b.SectionNumber,
			ocr:       b.Source == extract.OCR,
			table:     b.Kind == extract.Table,
		})
	}
	flush()
	for i := range chunks {
		chunks[i].Index = i
	}
	return chunks
}

func (o Options) pack(section []piece, stack []heading) []Chunk {
	if len(section) == 0 {
		return nil
	}
	path := make([]string, len(stack))
	for i, h := range stack {
		path[i] = h.text
	}
	title, number := "", ""
	if len(stack) > 0 {
		title, number = stack[len(stack)-1].text, stack[len(stack)-1].number
	}
	var parts []piece
	for _, p := range section {
		parts = append(parts, o.splitPiece(p)...)
	}

	var (
		out     []Chunk
		current []piece
		tokens  int
	)
	emit := func() {
		if len(current) == 0 {
			return
		}
		texts := make([]string, len(current))
		c := Chunk{HeadingPath: path, SectionTitle: title, SectionNumber: number}
		for i, p := range current {
			texts[i] = p.text
			if p.pageStart > 0 && (c.PageStart == 0 || p.pageStart < c.PageStart) {
				c.PageStart = p.pageStart
			}
			c.PageEnd = max(c.PageEnd, p.pageEnd)
			if c.SectionNumber == "" {
				c.SectionNumber = p.number
			}
			c.OCR = c.OCR || p.ocr
		}
		c.Content = strings.Join(texts, "\n\n")
		c.TokenCount = o.Tokens(c.Content)
		out = append(out, c)
		overlap := o.overlapFrom(current)
		current, tokens = nil, 0
		if overlap.text != "" {
			current, tokens = []piece{overlap}, o.Tokens(overlap.text)
		}
	}
	for _, p := range parts {
		t := o.Tokens(p.text)
		if len(current) > 0 && tokens+t > o.TargetTokens && (tokens >= o.TargetTokens*2/3 || tokens+t > o.MaxTokens) {
			emit()
		}
		current = append(current, p)
		tokens += t
	}
	if !(len(current) == 1 && current[0].overlap) {
		emit()
	}
	return out
}

func (o Options) splitPiece(p piece) []piece {
	limit := o.MaxTokens - o.OverlapTokens
	if o.Tokens(p.text) <= limit {
		return []piece{p}
	}
	if p.table {
		return o.splitTable(p, limit)
	}
	return o.splitProse(p, limit)
}

type unit struct {
	text string
	sep  string
}

func (o Options) splitProse(p piece, limit int) []piece {
	var units []unit
	for i, paragraph := range strings.Split(p.text, "\n\n") {
		sep := "\n\n"
		if i == 0 {
			sep = ""
		}
		if o.Tokens(paragraph) <= limit {
			units = append(units, unit{paragraph, sep})
			continue
		}
		for _, s := range sentences(paragraph) {
			if o.Tokens(s) <= limit {
				units = append(units, unit{s, sep})
				sep = " "
				continue
			}
			for _, h := range o.hardSplit(s, limit) {
				units = append(units, unit{h, sep})
				sep = " "
			}
		}
	}
	var (
		out    []piece
		buffer strings.Builder
		n      int
	)
	for _, u := range units {
		t := o.Tokens(u.text)
		if n > 0 && n+t > limit {
			out = append(out, withText(p, buffer.String()))
			buffer.Reset()
			n = 0
		}
		if n > 0 {
			buffer.WriteString(u.sep)
		}
		buffer.WriteString(u.text)
		n += t + 1
	}
	if n > 0 {
		out = append(out, withText(p, buffer.String()))
	}
	return out
}

// splitTable keeps rows whole and repeats the header row in every piece. A row
// that cannot fit with the header is split as prose.
func (o Options) splitTable(p piece, limit int) []piece {
	rows := strings.Split(p.text, "\n")
	header := rows[0]
	headerTokens := o.Tokens(header)
	if headerTokens >= limit {
		return o.splitProse(p, limit)
	}
	var (
		out   []piece
		group []string
	)
	flush := func() {
		if len(group) > 0 {
			out = append(out, withText(p, strings.Join(append([]string{header}, group...), "\n")))
			group = nil
		}
	}
	for _, row := range rows[1:] {
		if o.Tokens(header+"\n"+row) > limit {
			flush()
			rowLimit := limit - headerTokens - 1
			prefix := header + "\n"
			if rowLimit < limit/4 {
				rowLimit, prefix = limit, ""
			}
			for _, part := range o.splitProse(withText(p, row), rowLimit) {
				out = append(out, withText(p, prefix+part.text))
			}
			continue
		}
		candidate := strings.Join(append([]string{header}, append(group, row)...), "\n")
		if len(group) > 0 && o.Tokens(candidate) > limit {
			flush()
		}
		group = append(group, row)
	}
	flush()
	if len(out) == 0 {
		out = append(out, withText(p, header))
	}
	return out
}

func (o Options) hardSplit(s string, limit int) []string {
	runes := []rune(s)
	size := max(int(float64(limit)*o.CharsPerToken), 1)
	var out []string
	for len(runes) > size {
		cut := size
		for i := size; i > size/2; i-- {
			if unicode.IsSpace(runes[i]) {
				cut = i
				break
			}
		}
		out = append(out, strings.TrimSpace(string(runes[:cut])))
		runes = runes[cut:]
	}
	if rest := strings.TrimSpace(string(runes)); rest != "" {
		out = append(out, rest)
	}
	return out
}

func (o Options) overlapFrom(current []piece) piece {
	if o.OverlapTokens <= 0 || len(current) == 0 {
		return piece{}
	}
	last := current[len(current)-1]
	if last.table {
		return piece{}
	}
	all := sentences(last.text)
	budget := o.OverlapTokens
	var tail []string
	for i := len(all) - 1; i >= 0; i-- {
		t := o.Tokens(all[i])
		if t > budget {
			break
		}
		tail = append([]string{all[i]}, tail...)
		budget -= t
	}
	if len(tail) == 0 {
		return piece{}
	}
	return piece{text: strings.Join(tail, " "), pageStart: last.pageEnd, pageEnd: last.pageEnd, number: last.number, ocr: last.ocr, overlap: true}
}

func withText(p piece, text string) piece {
	p.text = text
	return p
}

var abbreviations = map[string]bool{
	"Mr": true, "Mrs": true, "Ms": true, "Dr": true, "M": true, "Mme": true, "Mlle": true,
	"Sr": true, "Sra": true, "St": true, "No": true, "art": true, "Art": true,
	"e.g": true, "i.e": true, "etc": true, "cf": true, "vs": true,
}

func endsWithAbbreviation(runes []rune) bool {
	i := len(runes)
	for i > 0 && !unicode.IsSpace(runes[i-1]) {
		i--
	}
	return abbreviations[strings.TrimLeft(string(runes[i:]), "(\"“«")]
}

// sentences splits after . ! ? when the next word starts with a capital, a
// digit or an opening quote or bracket, unless the word before a period is a
// known abbreviation.
func sentences(s string) []string {
	runes := []rune(s)
	var (
		out   []string
		start int
	)
	for i := 0; i < len(runes)-2; i++ {
		if !strings.ContainsRune(".!?", runes[i]) || !unicode.IsSpace(runes[i+1]) {
			continue
		}
		if runes[i] == '.' && endsWithAbbreviation(runes[start:i]) {
			continue
		}
		j := i + 1
		for j < len(runes) && unicode.IsSpace(runes[j]) {
			j++
		}
		if j < len(runes) && (unicode.IsUpper(runes[j]) || unicode.IsDigit(runes[j]) || strings.ContainsRune("«“\"(", runes[j])) {
			out = append(out, strings.TrimSpace(string(runes[start:i+1])))
			start = j
		}
	}
	if rest := strings.TrimSpace(string(runes[start:])); rest != "" {
		out = append(out, rest)
	}
	return out
}
