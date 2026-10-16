package extract

import (
	"regexp"
	"strings"
)

var (
	keywordNumber = regexp.MustCompile(`(?i)^((?:article|art\.|section|sec\.|chapter|chapitre|cap[ií]tulo|clause|cl[aá]usula|annex|annexe|anexo)\s+(?:\d+(?:\.\d+)*|[ivxlc]+))\b`)
	dottedNumber  = regexp.MustCompile(`^(\d+(?:\.\d+)+)\.?(?:\s|$)`)
	headingNumber = regexp.MustCompile(`^(\d+)[.)]?\s`)
)

func sectionNumberOf(b Block) string {
	text := strings.TrimSpace(b.Text)
	if m := keywordNumber.FindStringSubmatch(text); m != nil {
		return m[1]
	}
	if m := dottedNumber.FindStringSubmatch(text); m != nil {
		return m[1]
	}
	// A bare "4 " or "4." only counts on headings; in body text it is usually a list.
	if b.Kind == Heading {
		if m := headingNumber.FindStringSubmatch(text); m != nil {
			return m[1]
		}
	}
	return ""
}

func assignSectionNumbers(blocks []Block) {
	for i := range blocks {
		if blocks[i].SectionNumber == "" {
			blocks[i].SectionNumber = sectionNumberOf(blocks[i])
		}
	}
}
