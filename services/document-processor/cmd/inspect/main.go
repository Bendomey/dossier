package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"dossier/services/document-processor/internal/chunk"
	"dossier/services/document-processor/internal/config"
	"dossier/services/document-processor/internal/extract"
	"dossier/services/document-processor/internal/lang"
)

func main() {
	showChunks := flag.Bool("chunks", false, "print chunks instead of blocks")
	flag.Parse()
	path := flag.Arg(0)
	if path == "" {
		fmt.Fprintln(os.Stderr, "usage: inspect [-chunks] <file>")
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
