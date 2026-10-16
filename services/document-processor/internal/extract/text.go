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
	text := decodeText(raw)
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")

	doc := &Document{Blocks: []Block{}}
	var paragraph []string
	flush := func() {
		if len(paragraph) > 0 {
			doc.Blocks = append(doc.Blocks, Block{Kind: Paragraph, Text: collapseSpaces(strings.Join(paragraph, " ")), Source: Native})
			paragraph = nil
		}
	}
	inFence := false
	afterListLine := false
	for _, line := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(line)
		continuesList := afterListLine
		afterListLine = false
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
			if len(paragraph) == 1 && (setextH1.MatchString(trimmed) || setextH2.MatchString(trimmed)) {
				level := 2
				if trimmed[0] == '=' {
					level = 1
				}
				doc.Blocks = append(doc.Blocks, Block{Kind: Heading, Level: level, Text: collapseSpaces(paragraph[0]), Source: Native})
				paragraph = nil
				continue
			}
			if horizontalRule.MatchString(trimmed) {
				flush()
				continue
			}
			if m := markdownHeading.FindStringSubmatch(trimmed); m != nil {
				flush()
				doc.Blocks = append(doc.Blocks, Block{Kind: Heading, Level: len(m[1]), Text: m[2], Source: Native})
				continue
			}
		} else if len(paragraph) == 0 && isShoutedHeading(trimmed) {
			doc.Blocks = append(doc.Blocks, Block{Kind: Heading, Level: 1, Text: trimmed, Source: Native})
			continue
		}
		if listMarker.MatchString(line) {
			flush()
			doc.Blocks = append(doc.Blocks, Block{Kind: ListItem, Text: collapseSpaces(trimmed), Source: Native})
			afterListLine = true
			continue
		}
		if continuesList && len(paragraph) == 0 && line != trimmed {
			last := &doc.Blocks[len(doc.Blocks)-1]
			last.Text = last.Text + " " + collapseSpaces(trimmed)
			afterListLine = true
			continue
		}
		paragraph = append(paragraph, trimmed)
	}
	flush()
	return doc, nil
}

// decodeText accepts UTF-8 (with or without a BOM) and falls back to
// Windows-1252, which is what older Office exports in Ghana and Liberia produce.
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
