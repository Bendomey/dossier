FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/processor ./cmd/processor

FROM debian:bookworm-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends poppler-utils ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 10001 processor
USER processor
COPY --from=build /out/processor /usr/local/bin/processor
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/processor"]
