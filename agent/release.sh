#!/usr/bin/env bash
set -euo pipefail
# Static, portable binaries; no C toolchain needed to build or test.
export CGO_ENABLED=0
cd "$(dirname "$0")"
OUT="${DESTDIR:-$PWD/../dist/downloads}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
BUILDER="${BUILDER:-$PWD/_tools/builder}"
if [[ ! -x "$BUILDER" ]]; then
  mkdir -p "$(dirname "$BUILDER")"
  GOBIN="$(dirname "$BUILDER")" go install go.opentelemetry.io/collector/cmd/builder@v0.165.0
fi
"$BUILDER" --config manifest.yaml --skip-compilation
cp main.go config.go logoperator.go config_test.go logoperator_test.go _build/
cd _build
# Build with a patched Go toolchain (standard-library security fixes); see docs/AUDIT.md.
go mod edit -toolchain=go1.26.11
go mod tidy
go test -p "${GO_BUILD_PARALLELISM:-2}" -trimpath -tags grpcnotrace ./...
TARGETS="${TARGETS:-linux/amd64 linux/arm64 darwin/arm64 darwin/amd64}" bash ../notices.sh "$OUT/datacat-agent-THIRD_PARTY_NOTICES.txt"
for target in ${TARGETS:-linux/amd64 linux/arm64 darwin/arm64 darwin/amd64}; do
  os="${target%/*}"
  arch="${target#*/}"
  echo "Building $os/$arch"
  CGO_ENABLED=0 GOOS="$os" GOARCH="$arch" go build -p "${GO_BUILD_PARALLELISM:-2}" \
    -trimpath -tags grpcnotrace -ldflags="-s -w" -o "$OUT/datacat-agent-$os-$arch" .
done
cd "$OUT"
if command -v sha256sum >/dev/null; then
  sha256sum datacat-agent-* > SHA256SUMS
else
  shasum -a 256 datacat-agent-* > SHA256SUMS
fi
