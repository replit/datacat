FROM golang:1.26.11-bookworm AS build
WORKDIR /src/agent
COPY agent/ .
RUN CGO_ENABLED=0 DESTDIR=/out bash build.sh

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/datacat-agent /usr/local/bin/datacat-agent
ENTRYPOINT ["/usr/local/bin/datacat-agent"]
CMD ["run", "-c", "/etc/datacat/datacat.yaml"]
