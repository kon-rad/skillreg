# skillreg: design spec (MVP)

**Date:** 2026-10-17
**Status:** Approved for implementation (Konrad approved the MVP architecture and asked to proceed to plan and build, 2026-10-17).
**Deadline:** Arkiv Global Tour Stop submissions close 2026-10-18 23:59 London (2026-10-19 06:59 KL).

## 1. Purpose

skillreg is an open, permissionless protocol and toolset for publishing, finding, rating and installing agent skills (the agentskills.io `SKILL.md` format) on Arkiv. A skill version is a signed, immutable, hash-checked Arkiv record. Anyone can publish, read, rate or keep a skill alive. Each user decides whose ratings to trust, on their own machine. No server, account or permission from the authors is needed.

**Success criteria (MVP):**
1. A publisher runs `skillreg publish ./my-skill` and gets one Arkiv record holding the whole skill.
2. Anyone runs `skillreg search pdf` and `skillreg install pdf@0x…` with no wallet; files land only after every hash matches and the trust rule allows it.
3. A scanner wallet rates every new skill; a malicious demo skill is BLOCKED with the finding quoted.
4. Anyone with a wallet can extend any skill's lifetime.
5. A static web page lets a judge search and inspect skills with no backend.
6. All safety rules (section 6) have tests that fail without the rule.

**Non-goals (MVP):** gateways or well-known indexes, binary files, skills over 96 KiB, git or IPFS side files, on-chain trust policies, name pointers, deprecation, disputes, sandbox or AI raters, live event feeds, publisher scores, payments, MCP server, embeddings.

## 2. Verified platform facts (local Arkiv dev node, SDK 0.8.1, 2026-10-17)

| Fact | Consequence |
|---|---|
| `str` attribute max 128 UTF-8 bytes, no control characters | Full description lives in the payload; a `summary` attribute holds up to 120 bytes |
| Max 32 cells per record including payload and content type | At most 30 custom attributes |
| Attribute names: letter first, `[A-Za-z0-9._-]`, max 32 bytes; `key`, `str`, `and`, etc. reserved | Use `skill`, not `key`, for the rated record's key |
| Payload max 128 KiB; no compression in transactions | Skill payload cap 96 KiB (headroom for JSON overhead); 100 KiB payload cost ~4.1M gas locally |
| `$createdAt` is returned but not indexed | Filter by it client-side only; never use a publisher-set timestamp for scanner scheduling |
| `$expiresAt` supports range queries | Usable for "expiring soon" |
| `bytes32` and `key` equality, 40+ term `OR`, `createdBy`, field selection without payload | All work |
| Readonly records reject patches; owner can still delete | Evidence in ratings quotes excerpts; ratings never rely on the skill record surviving |
| Non-owner `extendEntity` works only with `permissionlessExtension` | Sponsor flow works as designed |
| `executeBatch` with 25 creates works | Scanner posts one transaction per cycle (chunked at 25) |

## 3. Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/manifest.ts` | Read a skill folder, validate files, build the canonical manifest and its SHA-256 | `node:fs`, `node:crypto` |
| `src/frontmatter.ts` | Parse and validate `SKILL.md` frontmatter (agentskills.io rules) | `yaml`, `zod` |
| `src/safety.ts` | Path containment, name rule, size caps, leak check, binary check | none |
| `src/records.ts` | Build and parse `skill` and `rating` records (attributes + payload), with full validation on parse | `@arkiv-network/sdk` attr helpers |
| `src/arkiv.ts` | Create public and wallet clients from config; read-retry wrapper; query helpers | SDK, `viem` |
| `src/trust.ts` | Load the trust file; evaluate PASS/WARN/BLOCK for one version | records |
| `src/scanner.ts` | Static rules over a manifest; findings and verdict; rules hash | none |
| `src/install.ts` | Atomic install into a target folder; lockfile read/write | manifest, safety |
| `src/search.ts` | Fetch skill attributes, group, rank locally | arkiv, records |
| `src/cli/*.ts` | One file per command; argument parsing, output (human or `--json`), exit codes | everything above |
| `web/` | Static page reading Arkiv via the SDK in the browser | SDK, records, trust |

Each unit is testable without a network except `arkiv.ts`, `search.ts` and the CLI integration tests, which run against the local dev node.

## 4. Data contract (schema 1)

All records: `contentType = "application/json"`, attribute `t` (type) and `schema = u64(1)`.

### 4.1 `skill`

| Attribute | Type | Rule |
|---|---|---|
| `t` | str | `"skill"` |
| `schema` | u64 | `1` |
| `name` | str | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 chars, equals frontmatter `name` |
| `version` | str | Frontmatter `metadata.version` if it matches `^\d+\.\d+\.\d+$`, else `"0.0.0"` |
| `sha` | bytes32 | Manifest hash (4.3) |
| `summary` | str | Description truncated to 120 UTF-8 bytes at a character boundary, control characters replaced by spaces |
| `kw1`..`kw5` | str | Optional; lowercase `^[a-z0-9-]{1,32}$`; from `--keywords` or frontmatter `metadata.keywords` (comma-separated) |
| `license` | str | Frontmatter `license` truncated to 64 bytes, or `"unspecified"` |
| `size` | u64 | Sum of file content bytes |
| `files` | u64 | File count |

Payload:
```json
{ "description": "<full frontmatter description>",
  "files": [ { "path": "SKILL.md", "mode": 420, "text": "..." } ] }
```
`files` sorted by `path` (byte order). `mode` is 420 (0644) or 493 (0755).

Lifetime: `ExpirationTime.fromDays(90)`. Flags: `readonly: true, permissionlessExtension: true`.

### 4.2 `rating`

| Attribute | Type | Rule |
|---|---|---|
| `t` | str | `"rating"` |
| `schema` | u64 | `1` |
| `skill` | key | Entity key of the rated `skill` record |
| `sha` | bytes32 | Manifest hash of the rated version |
| `verdict` | str | `clean` \| `warn` \| `malicious` |
| `kind` | str | `static` \| `human` |
| `rater_ver` | str | For `static`: skillreg package version; for `human`: `"human"` |
| `findings` | u64 | Number of findings |

Payload (max 32 KiB):
```json
{ "rules_hash": "0x…" | null,
  "findings": [ { "file": "scripts/run.sh", "line": 14, "rule": "exfil-raw-ip", "severity": "critical", "excerpt": "≤200 chars" } ],
  "note": "≤2000 chars" }
```
Lifetime: 180 days. Flags: `readonly: true`; `permissionlessExtension: true` only if `verdict = malicious`.

### 4.3 Canonical manifest hash

For each file in path order, append the UTF-8 bytes of `path + "\0" + mode (decimal) + "\0" + hex(sha256(text bytes)) + "\n"`. `sha = sha256(all)`, as `0x`-prefixed 64 hex. Every reader recomputes it from the payload; a mismatch rejects the record.

### 4.4 Queries

| Use | Expression |
|---|---|
| All skills (paged, attributes only) | `t = "skill" AND schema = 1`, select `key, creator, createdAt, expiresAt, attributes` |
| One name by one publisher | `t = "skill" AND name = n` + `createdBy(addr)`; latest = highest `createdAt` |
| Ratings of a hash by a rater | `t = "rating" AND sha = h` + `createdBy(rater)` |
| A rater's ratings (scanner dedupe) | `t = "rating"` + `createdBy(scanner)`, attributes only |
| Duplicate check | `t = "skill" AND sha = h` + `createdBy(me)` |

## 5. Trust evaluation

Trust file (JSON): `{ "publishers": ["0x…"], "raters": ["0x…"] }`. Resolution order: `--trust <file>`, `$SKILLREG_TRUST`, `~/.skillreg/trust.json`, the packaged `trust.default.json`.

For one version (key `k`, hash `h`, creator `c`):
1. Collect ratings with `sha = h` from each trusted rater.
2. Drop ratings whose creator equals `c` (S5) and ratings whose `skill` attribute is not `k` or whose payload fails to parse.
3. Any `malicious` → **BLOCK**. Else any `warn` → **WARN**. Else at least one `clean` → **PASS**. Else → **WARN** ("no ratings from trusted raters").

`install <name>` without an address resolves automatically only if exactly one matching skill has a creator in `publishers`; otherwise it lists candidates and exits 3.

## 6. Safety rules (each has a failing-without-it test)

| # | Rule |
|---|---|
| S1 | Path containment: relative, `/` separators, no `..` segment, no leading `/` or `\`, no `:`, no NUL, no backslash, no empty segment, max depth 8, max 255 bytes; resolved path must stay inside the target folder; no symlinks read on publish or created on install |
| S2 | Name: `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 chars, equals frontmatter name and the folder name on publish |
| S3 | Caps before parsing: skill payload ≤ 96 KiB, rating payload ≤ 32 KiB, ≤ 200 files, each file ≤ 64 KiB; checked on raw bytes before `JSON.parse` |
| S4 | Install never executes: no scripts, no hooks; modes only 0644 or 0755 |
| S5 | Self-ratings discarded |
| S6 | Publish leak check: refuse names matching `.env*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `credentials*`, `auth.json`, `.npmrc`, `.netrc`; refuse content matching AWS access keys (`AKIA[0-9A-Z]{16}`), private-key blocks, `sk-ant-…`, `sk-…{20,}`, `ghp_…`, `github_pat_…`, `xox[baprs]-…`, `0x` + 64 hex not preceded by `sha`/`hash`/`digest` within 20 chars; refuse non-UTF-8 or NUL-containing files; first publish of a name by a wallet requires `--yes` or interactive confirmation |
| S7 | Hash check: recompute on every parse; `verify` re-hashes installed files |
| S8 | Atomic install: write to `<target>/.skillreg-tmp-<random>`, fsync-free rename into place; refuse to overwrite a folder not in the lockfile unless `--force`; remove temp on failure |

## 7. CLI

`skillreg <command> [options]`. Global: `--rpc <url>` (env `SKILLREG_RPC`, default Tiramisu public RPC), `--chain tiramisu|local` (env `SKILLREG_CHAIN`), `--json`, `--trust <file>`. Write commands read the key from `SKILLREG_PRIVATE_KEY`; never from a file argument.

| Command | Behaviour |
|---|---|
| `publish <dir> [--keywords a,b] [--yes] [--dry-run]` | S1, S2, S3, S6; build record; duplicate check; create; print key, tx, expiry |
| `search <words…> [--limit 20]` | Load all skills (attributes only), score, attach verdicts for the top `limit`, print |
| `info <name@addr \| key>` | Full record, files list, ratings, verdict |
| `install <name[@addr] \| key> [--dir .agents/skills] [--yes] [--force]` | Resolve; fetch; S3, S7; trust; BLOCK exits 2; WARN without `--yes` exits 3; S1, S4, S8; lockfile |
| `verify [--dir]` | For each lockfile entry: re-hash files, re-evaluate trust, check expiry |
| `extend <key> --days N` | `extendEntity`; works for owner or anyone on permissionless records |
| `rate <key> --verdict v [--note text] [--evidence file]` | Human rating (`kind = human`) |
| `scan [<key>] [--all] [--dry-run]` | Static scan; `--all` scans every active skill not yet rated by this wallet; posts in batches of 25 |

Exit codes: 0 ok · 1 usage · 2 blocked · 3 needs confirmation or ambiguous · 4 validation or hash failure · 5 network or chain error.

Search scoring (local): name exact 100, name prefix 60, name contains 40, keyword exact 50, summary word 10 per term; ties by newest `createdAt`; then group by `name@creator` keeping latest.

Lockfile `<dir>/../skills.lock.json` when `--dir` ends in `skills`, else `<dir>/skills.lock.json`: `{ "version": 1, "skills": { "<name>": { "creator", "key", "sha", "version", "installed_at" } } }`.

## 8. Static scanner (rules v1)

Critical: `download-exec` (`curl|wget … | (sh|bash|zsh|python)`, `iex … iwr`, `Invoke-Expression`), `credential-read` (`~/.ssh`, `id_rsa`, `.aws/credentials`, `.env` read with send, `.claude.json`, `security find-generic-password`), `exfil-raw-ip` (URL or `curl/wget/nc` to a literal IPv4), `agent-config-write` (writes to `.claude/settings`, `settings.json`, `.hermes/config`, `mcp.json`, `.cursor/`), `safety-disable` (`--dangerously-skip-permissions`, `ignore (all )?(previous|prior) instructions`).
Warn: `encoded-blob` (base64 run ≥ 200 chars, zero-width or bidi control characters), `secret-pattern` (S6 content patterns), `outbound-url` (any `https?://` host, listed), `broad-tools` (`allowed-tools` containing `Bash(*)` or bare `Bash`).
Verdict: any critical → malicious; any warn → warn; else clean. `rules_hash` = sha256 of the rules source text. Excerpts capped at 200 characters.

## 9. Web page

`web/index.html` + `web/main.ts`, built with Vite. Search box; result cards (name, `@creator` short, version, summary, verdict badge, expires in N days); detail view (rendered `SKILL.md` as escaped preformatted text, file list with hashes, ratings with findings, install command). Uses the packaged default trust file; a text field lets the viewer paste other rater addresses (kept in `localStorage`). No wallet connection. All text from records is inserted with `textContent`, never `innerHTML`.

## 10. Testing

| Layer | How |
|---|---|
| Unit | vitest: manifest hash vectors, frontmatter, every safety rule (positive and negative), trust truth table, scanner rules on fixtures, lockfile, search scoring |
| Integration | vitest against the local dev node (`ghcr.io/arkiv-network/arkiv-reth-dev`, port 18545, chain 1337, public dev keys): publish → search → install → verify; impostor scan → BLOCK; sponsor extend; duplicate publish refused. Skipped unless `SKILLREG_IT=1` |
| Live | One scripted run against Tiramisu once wallets are funded; outputs recorded in `arkiv/friction.md` and the README |

## 11. Deployment

npm package `@kon-rad/skillreg` (bin `skillreg`; the unscoped name belongs to another project), runnable before npm publish as `npx github:kon-rad/skillreg`. Web: static build on the droplet's Caddy. Scanner: systemd timer on the droplet running `skillreg scan --all` every 5 minutes with its own key in an env file readable only by its user.

## 12. Open items

- Tiramisu limits may differ from the dev node (payload gas, transaction size, batch size). Verify in the live run; lower caps if needed.
- Faucet: requires a hub account (wallet sign-in plus email). Konrad claims test GLM to one funder address; skillreg funds the other wallets from it.
