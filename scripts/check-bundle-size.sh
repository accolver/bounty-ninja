#!/usr/bin/env bash
# Check that the gzipped build output stays under the 200KB budget.
# Runs after `bun run build` in CI.

set -euo pipefail

BUILD_DIR="build"
MAX_SIZE_KB=200

if [ ! -d "$BUILD_DIR" ]; then
  echo "ERROR: Build directory '$BUILD_DIR' not found. Run 'bun run build' first."
  exit 1
fi

# Calculate total gzipped size of JS + CSS assets
TOTAL_BYTES=0

for file in $(find "$BUILD_DIR" -type f \( -name '*.js' -o -name '*.css' \)); do
  GZIP_SIZE=$(gzip -c "$file" | wc -c | tr -d ' ')
  TOTAL_BYTES=$((TOTAL_BYTES + GZIP_SIZE))
done

TOTAL_KB=$((TOTAL_BYTES / 1024))

echo "Bundle size (gzipped): ${TOTAL_KB}KB / ${MAX_SIZE_KB}KB"

if [ "$TOTAL_KB" -gt "$MAX_SIZE_KB" ]; then
  echo "FAIL: Bundle size ${TOTAL_KB}KB exceeds ${MAX_SIZE_KB}KB budget."
  exit 1
fi

echo "PASS: Bundle size is within budget."
