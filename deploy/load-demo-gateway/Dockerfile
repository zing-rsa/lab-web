# Build a static Go binary and ship it on distroless (nonroot). CGO is off so the binary runs on
# the empty static base. go.mod/go.sum are copied first so module download is cached separately
# from source changes.
FROM golang:1.23-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/load-demo-gateway .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/load-demo-gateway /load-demo-gateway
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/load-demo-gateway"]
