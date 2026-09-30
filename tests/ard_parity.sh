#!/bin/sh
# Guard: the ARD manifest must be served identically at both paths (ARD v0.91 + legacy ai-catalog).
cmp "$(dirname "$0")/../.well-known/ard.json" "$(dirname "$0")/../.well-known/ai-catalog.json" || { echo "ard.json and ai-catalog.json differ"; exit 1; }
