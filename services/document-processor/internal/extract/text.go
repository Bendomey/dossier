package extract

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"
	xunicode "golang.org/x/text/encoding/unicode"

	"dossier/services/document-processor/internal/failure"
)

const maxTextBytes = 25 << 20

var (
	markdownHeading = regexp.MustCompile(`^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$`)
	setextH1        = regexp.MustCompile(`^=+$`)
	setextH2        = regexp.MustCompile(`^-+$`)
	horizontalRule  = regexp.MustCompile(`^(?:-{3,}|\*{3,}|_{3,})$`)
	listMarker      = regexp.MustCompile(`^\s*(?:[-*+•]|\d+[.)])\s+`)
)

func extractText(path string, markdown bool) (*Document, error) {
	raw, err := readLimited(path, maxTextBytes)
	if err != nil {
		return nil, failure.Permanent(failure.CorruptFile, err)
	}
	return &Document{Blocks: parseText(decodeText(raw), markdown)}, nil
}

// parseText turns plain text or Markdown into blocks; OCR transcriptions go
// through it as Markdown.
func parseText(text string, markdown bool) []Block {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")

	blocks := []Block{}
	var paragraph []string
	flush := func() {
		if len(paragraph) > 0 {
			blocks = append(blocks, Block{Kind: Paragraph, Text: collapseSpaces(strings.Join(paragraph, " ")), Source: Native})
			paragraph = nil
		}
	}
	inFence := false
	afterListLine := false
	afterTableRow := false
	for _, line := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(line)
		continuesList := afterListLine
		continuesTable := afterTableRow
		afterListLine = false
		afterTableRow = false
		if markdown && strings.HasPrefix(trimmed, "```") {
			flush()
			inFence = !inFence
			continue
		}
		if inFence {
			if trimmed != "" {
				paragraph = append(paragraph, trimmed)
			}
			continue
		}
		if trimmed == "" {
			flush()
			continue
		}
		if markdown {
			if strings.HasPrefix(trimmed, "|") {
				flush()
				afterTableRow = true
				row, ok := tableRow(trimmed)
				if !ok {
					continue
				}
				if continuesTable && len(blocks) > 0 && blocks[len(blocks)-1].Kind == Table {
					blocks[len(blocks)-1].Text += "\n" + row
				} else {
					blocks = append(blocks, Block{Kind: Table, Text: row, Source: Native})
				}
				continue
			}
			if len(paragraph) == 1 && (setextH1.MatchString(trimmed) || setextH2.MatchString(trimmed)) {
				level := 2
				if trimmed[0] == '=' {
					level = 1
				}
				blocks = append(blocks, Block{Kind: Heading, Level: level, Text: collapseSpaces(paragraph[0]), Source: Native})
				paragraph = nil
				continue
			}
			if horizontalRule.MatchString(trimmed) {
				flush()
				continue
			}
			if m := markdownHeading.FindStringSubmatch(trimmed); m != nil {
				flush()
				blocks = append(blocks, Block{Kind: Heading, Level: len(m[1]), Text: m[2], Source: Native})
				continue
			}
		} else if len(paragraph) == 0 && isShoutedHeading(trimmed) {
			blocks = append(blocks, Block{Kind: Heading, Level: 1, Text: trimmed, Source: Native})
			continue
		}
		if listMarker.MatchString(line) {
			flush()
			blocks = append(blocks, Block{Kind: ListItem, Text: collapseSpaces(trimmed), Source: Native})
			afterListLine = true
			continue
		}
		if continuesList && len(paragraph) == 0 && line != trimmed {
			last := &blocks[len(blocks)-1]
			last.Text = last.Text + " " + collapseSpaces(trimmed)
			afterListLine = true
			continue
		}
		paragraph = append(paragraph, trimmed)
	}
	flush()
	return blocks
}

// tableRow reads a Markdown table row as cells joined by " | ", the form the
// DOCX extractor and the chunker use; separator and empty rows report false.
func tableRow(line string) (string, bool) {
	if strings.Contains(line, "-") && strings.Trim(line, "|:- \t") == "" {
		return "", false
	}
	cells := strings.Split(strings.Trim(line, "|"), "|")
	empty := true
	for i := range cells {
		cells[i] = collapseSpaces(cells[i])
		empty = empty && cells[i] == ""
	}
	if empty {
		return "", false
	}
	return strings.Join(cells, " | "), true
}

// decodeText accepts UTF-8 (with or without a BOM) and falls back to
// Windows-1252, which is what older Office exports in Ghana and Equatorial Guinea produce.
func decodeText(raw []byte) string {
	if len(raw) >= 2 && (raw[0] == 0xFF && raw[1] == 0xFE || raw[0] == 0xFE && raw[1] == 0xFF) {
		decoded, err := xunicode.UTF16(xunicode.LittleEndian, xunicode.UseBOM).NewDecoder().Bytes(raw)
		if err == nil {
			return string(decoded)
		}
	}
	if utf8.Valid(raw) {
		return strings.TrimPrefix(string(raw), "\uFEFF")
	}
	decoded, err := charmap.Windows1252.NewDecoder().Bytes(raw)
	if err != nil {
		return strings.ToValidUTF8(string(raw), "�")
	}
	return string(decoded)
}

func isShoutedHeading(line string) bool {
	if utf8.RuneCountInString(line) > 80 || strings.HasSuffix(line, ".") {
		return false
	}
	letters := 0
	for _, r := range line {
		if unicode.IsLetter(r) {
			letters++
			if unicode.IsLower(r) {
				return false
			}
		}
	}
	return letters >= 3
}
