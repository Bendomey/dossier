package extract

import (
	"archive/zip"
	"encoding/xml"
	"errors"
	"io"
	"regexp"
	"strconv"
	"strings"

	"dossier/services/document-processor/internal/failure"
)

const (
	maxDOCXEntries      = 2000
	maxDOCXUncompressed = 100 << 20
	maxDOCXPart         = 50 << 20
)

var headingStyle = regexp.MustCompile(`(?i)^(?:heading|titre|t[ií]tulo|überschrift|kop)\s*([1-9])$`)

func extractDOCX(path string) (*Document, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return nil, failure.Permanent(failure.CorruptFile, err)
	}
	defer zr.Close()
	if len(zr.File) > maxDOCXEntries {
		return nil, failure.Permanent(failure.CorruptFile, errors.New("too many entries"))
	}
	var (
		total               uint64
		document, stylesXML *zip.File
	)
	for _, f := range zr.File {
		total += f.UncompressedSize64
		switch f.Name {
		case "word/document.xml":
			document = f
		case "word/styles.xml":
			stylesXML = f
		}
	}
	if total > maxDOCXUncompressed {
		return nil, failure.Permanent(failure.CorruptFile, errors.New("too large when unpacked"))
	}
	if document == nil {
		return nil, failure.Permanent(failure.CorruptFile, errors.New("missing word/document.xml"))
	}
	styles := map[string]string{}
	if stylesXML != nil {
		if names, err := readStyleNames(stylesXML); err == nil {
			styles = names
		}
	}
	r, err := document.Open()
	if err != nil {
		return nil, failure.Permanent(failure.CorruptFile, err)
	}
	defer r.Close()
	blocks, err := parseDocumentXML(io.LimitReader(r, maxDOCXPart), styles)
	if err != nil {
		return nil, failure.Permanent(failure.CorruptFile, err)
	}
	return &Document{Blocks: blocks}, nil
}

func readStyleNames(f *zip.File) (map[string]string, error) {
	r, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer r.Close()
	decoder := xml.NewDecoder(io.LimitReader(r, maxDOCXPart))
	names := map[string]string{}
	current := ""
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			return names, nil
		}
		if err != nil {
			return names, err
		}
		if start, ok := token.(xml.StartElement); ok {
			switch start.Name.Local {
			case "style":
				current = attr(start, "styleId")
			case "name":
				if current != "" {
					names[current] = attr(start, "val")
				}
			}
		}
	}
}

func attr(start xml.StartElement, local string) string {
	for _, a := range start.Attr {
		if a.Name.Local == local {
			return a.Value
		}
	}
	return ""
}

func headingLevel(styleID string, styles map[string]string) int {
	if styleID == "" {
		return 0
	}
	for _, candidate := range []string{styles[styleID], styleID} {
		name := strings.TrimSpace(candidate)
		if strings.EqualFold(name, "title") {
			return 1
		}
		if m := headingStyle.FindStringSubmatch(name); m != nil {
			level, _ := strconv.Atoi(m[1])
			return level
		}
	}
	return 0
}

type paragraphState struct {
	text     strings.Builder
	styleID  string
	numbered bool
	inText   bool
}

// parseDocumentXML walks WordprocessingML: paragraphs become blocks, tables
// become one block of " | "-separated rows, and deleted or moved-away text,
// old property revisions, mc:Fallback copies and field codes are skipped.
// Paragraphs nest (text boxes), so each keeps its own state on a stack.
func parseDocumentXML(r io.Reader, styles map[string]string) ([]Block, error) {
	decoder := xml.NewDecoder(r)
	var (
		blocks     []Block
		current    = &paragraphState{}
		stack      []*paragraphState
		skipDepth  int
		tableDepth int
		rows       []string
		cells      []string
		cell       []string
	)
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			return blocks, nil
		}
		if err != nil {
			return nil, err
		}
		switch t := token.(type) {
		case xml.StartElement:
			if skipDepth > 0 {
				skipDepth++
				continue
			}
			switch t.Name.Local {
			case "del", "delText", "instrText", "moveFrom", "pPrChange", "Fallback":
				skipDepth = 1
			case "tbl":
				tableDepth++
				if tableDepth == 1 {
					rows = nil
				}
			case "tr":
				if tableDepth == 1 {
					cells = nil
				}
			case "tc":
				if tableDepth == 1 {
					cell = nil
				}
			case "p":
				stack = append(stack, current)
				current = &paragraphState{}
			case "pStyle":
				current.styleID = attr(t, "val")
			case "numId":
				current.numbered = attr(t, "val") != "0"
			case "t":
				current.inText = true
			case "tab", "br", "cr":
				current.text.WriteByte(' ')
			}
		case xml.EndElement:
			if skipDepth > 0 {
				skipDepth--
				continue
			}
			switch t.Name.Local {
			case "t":
				current.inText = false
			case "p":
				done := current
				if len(stack) > 0 {
					current = stack[len(stack)-1]
					stack = stack[:len(stack)-1]
				} else {
					current = &paragraphState{}
				}
				line := collapseSpaces(done.text.String())
				if line == "" {
					continue
				}
				if tableDepth > 0 {
					cell = append(cell, line)
					continue
				}
				switch level := headingLevel(done.styleID, styles); {
				case level > 0:
					blocks = append(blocks, Block{Kind: Heading, Level: level, Text: line, Source: Native})
				case done.numbered:
					blocks = append(blocks, Block{Kind: ListItem, Text: line, Source: Native})
				default:
					blocks = append(blocks, Block{Kind: Paragraph, Text: line, Source: Native})
				}
			case "tc":
				if tableDepth == 1 {
					cells = append(cells, strings.Join(cell, " "))
				}
			case "tr":
				if tableDepth == 1 && anyNonEmpty(cells) {
					rows = append(rows, strings.Join(cells, " | "))
				}
			case "tbl":
				if tableDepth == 1 && len(rows) > 0 {
					blocks = append(blocks, Block{Kind: Table, Text: strings.Join(rows, "\n"), Source: Native})
				}
				tableDepth--
			}
		case xml.CharData:
			if skipDepth == 0 && current.inText {
				current.text.Write(t)
			}
		}
	}
}

func anyNonEmpty(cells []string) bool {
	for _, c := range cells {
		if c != "" {
			return true
		}
	}
	return false
}
