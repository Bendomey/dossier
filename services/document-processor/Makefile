.PHONY: run check inspect enqueue docker bench

run:
	go run ./cmd/processor

check:
	gofmt -l . | (! grep .) && go vet ./... && go build ./...

inspect:
	go run ./cmd/inspect $(if $(CHUNKS),-chunks) "$(FILE)"

enqueue:
	go run ./cmd/enqueue -job $(JOB)

docker:
	docker build --platform linux/amd64 -t dossier-document-processor .

bench:
	docker run --rm --platform linux/amd64 --cpus=0.25 --memory=1g --env-file .env -p 8080:8080 dossier-document-processor
