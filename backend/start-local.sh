#!/usr/bin/env bash
set -e

# ProofMarket backend — local starter
# Loads .env if present, otherwise expects vars in the environment.
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$SYNAPSE_PRIVATE_KEY" ]; then
  echo "ERROR: SYNAPSE_PRIVATE_KEY is not set (neither in .env nor in env)"
  exit 1
fi

echo "Starting ProofMarket backend..."
exec npx tsx src/index.ts
