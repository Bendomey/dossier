package lang

import (
	"unicode"

	"github.com/abadojack/whatlanggo"

	"dossier/services/document-processor/internal/chunk"
)

var (
	allowed = whatlanggo.Options{Whitelist: map[whatlanggo.Lang]bool{
		whatlanggo.Eng: true,
		whatlanggo.Fra: true,
		whatlanggo.Por: true,
	}}
	codes = map[whatlanggo.Lang]string{
		whatlanggo.Eng: "en",
		whatlanggo.Fra: "fr",
		whatlanggo.Por: "pt",
	}
)

func Detect(text string) string {
	letters := 0
	for _, r := range text {
		if unicode.IsLetter(r) {
			letters++
		}
	}
	if letters < 40 {
		return ""
	}
	return codes[whatlanggo.DetectWithOptions(text, allowed).Lang]
}

// Majority weighs each chunk's language by its size.
func Majority(chunks []chunk.Chunk) string {
	weight := map[string]int{}
	for _, c := range chunks {
		if c.Language != "" {
			weight[c.Language] += c.TokenCount
		}
	}
	best, bestWeight := "", 0
	for language, w := range weight {
		if w > bestWeight || (w == bestWeight && language < best) {
			best, bestWeight = language, w
		}
	}
	return best
}
