#!/usr/bin/env bash
# One-shot Tiramisu demo: fund the demo wallets from registry-ops, publish, scan, sponsor.
# Keys are read from ~/.skillreg/wallets/<role>.env (created by scripts/wallets.ts gen) and never printed.
#   ENGINE_SKILLS=/path/to/secondbrain/skills scripts/seed-tiramisu.sh [amountGLM per wallet, default 0.5]
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ENGINE_SKILLS:?set ENGINE_SKILLS to the folder holding the skills to publish}"
W="$HOME/.skillreg/wallets"
key() { sed -n 's/^SKILLREG_PRIVATE_KEY=//p' "$W/$1.env"; }
npx tsx scripts/wallets.ts fund "${1:-0.5}"
REGISTRY_KEY=$(key registry-ops) IMPOSTOR_KEY=$(key demo-author) SCANNER_KEY=$(key static-scanner) ./scripts/seed.sh
# Sponsor: a stranger keeps the registry's skillreg skill alive for 120 days.
k=$(npx tsx src/cli/main.ts --json info skillreg@0xe4daa45be002c1d565fbf8e6a4eade49fdcc4a7a | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).key))')
SKILLREG_PRIVATE_KEY=$(key sponsor) npx tsx src/cli/main.ts extend "$k" --days 120
npx tsx scripts/wallets.ts list
