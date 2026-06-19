#!/bin/bash
# last30days wrapper script for pi
# Researches what people say about topics in the last 30 days

set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SKILL_DIR/last30days.py"

exec python3 "$SCRIPT" "$@"