#!/usr/bin/env bash
# Fast checks run by the agent stop gate. Leave out slow e2e here; run `bun run test:e2e` before opening a PR.
set -euo pipefail
cd "$(dirname "$0")/.."
bun run lint
bunx tsc -b
bun run test:unit
