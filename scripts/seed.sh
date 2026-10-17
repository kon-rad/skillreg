#!/usr/bin/env bash
# Publish the demo set and scan it. Keys come from the environment, never from files in this repo.
#   REGISTRY_KEY  publishes the engine skills and the skillreg skill
#   IMPOSTOR_KEY  publishes the inert impostor fact-check
#   SCANNER_KEY   runs the static scanner
#   ENGINE_SKILLS folder holding the secondbrain engine's shared skills
# Extra args (e.g. --chain local --rpc http://127.0.0.1:18545) go to every command.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${REGISTRY_KEY:?}" "${IMPOSTOR_KEY:?}" "${SCANNER_KEY:?}" "${ENGINE_SKILLS:?}"
CLI=(npx tsx src/cli/main.ts "$@")
for d in "$ENGINE_SKILLS"/*/ skills/skillreg/; do
  [ -f "$d/SKILL.md" ] || continue
  SKILLREG_PRIVATE_KEY="$REGISTRY_KEY" "${CLI[@]}" publish "${d%/}" --yes
done
work=$(mktemp -d); cp -R fixtures/impostor-fact-check "$work/fact-check"
SKILLREG_PRIVATE_KEY="$IMPOSTOR_KEY" "${CLI[@]}" publish "$work/fact-check" --yes
SKILLREG_PRIVATE_KEY="$SCANNER_KEY" "${CLI[@]}" scan --all
