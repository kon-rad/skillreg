# skillreg

**An open, permissionless registry for agent skills on [Arkiv](https://arkiv.network).** A skill version is a signed, immutable, hash-checked Arkiv record. Anyone can publish one, rate one, or keep one alive. Each user decides whose ratings count, on their own machine. There is no server and no account, and nobody needs permission from us.

- **Web:** https://kon-rad.github.io/skillreg/ (reads Arkiv from your browser)
- **CLI:** `npx -y github:kon-rad/skillreg --help`
- **Data contract:** [`arkiv/schema.md`](arkiv/schema.md) · **Friction report:** [`arkiv/friction.md`](arkiv/friction.md)
- **For agents:** the [`skillreg` skill](skills/skillreg/SKILL.md) teaches any agent to search, vet and install safely

## Why

Agent skills (`SKILL.md` folders for Claude Code, Hermes, Codex, Cursor and others) are a software supply chain with no chain of custody. In February 2026 Snyk audited 3,984 skills from ClawHub and skills.sh: 13.4% had a critical issue and 76 carried confirmed malicious payloads, most combining malware with prompt injection. Today's indexes are each run by one company, names are first-come strings anyone can copy, nothing pins the bytes you install, and abandoned listings never leave.

skillreg changes four things:

| Problem | skillreg |
|---|---|
| Anyone can upload a look-alike `fact-check` | A skill is `name@publisher`. The publisher is Arkiv's `$creator`, set by the chain and impossible to forge |
| A skill can change after you trusted it | Versions are `readonly` records; installs check every file against the signed hash and pin it in a lockfile |
| One company decides what is safe | Anyone can post a rating. You choose which raters count. Same public data, your own verdict |
| Dead listings linger forever | A version lives 90 days. Its owner renews it, or anyone who cares can extend it |

## Quick start

```bash
# search and inspect (no wallet needed)
npx -y github:kon-rad/skillreg search fact check
npx -y github:kon-rad/skillreg info fact-check@0xe4daa45be002c1d565fbf8e6a4eade49fdcc4a7a

# install into .agents/skills (or --dir .claude/skills)
npx -y github:kon-rad/skillreg install fact-check@0xe4daa45be002c1d565fbf8e6a4eade49fdcc4a7a
npx -y github:kon-rad/skillreg verify
```

`install` refuses BLOCK (exit 2), asks before WARN (exit 3, re-run with `--yes`), and writes nothing unless every hash matches.

## Commands

| Command | Does | Needs a wallet |
|---|---|---|
| `search <words...>` | Ranks every skill locally; shows your verdict for each | No |
| `info <name@0x... \| key \| name>` | Full record, files, ratings, verdict | No |
| `install <ref> [--dir] [--yes] [--force]` | Verify, then install atomically; writes `skills.lock.json` | No |
| `verify [--dir]` | Re-hash installed files, re-check ratings and publication | No |
| `publish <dir> [--keywords a,b] [--yes] [--dry-run]` | Validate, leak-check and publish a skill folder | Yes |
| `extend <key> [--days N]` | Renew your skill, or sponsor anyone's | Yes |
| `rate <key> --verdict clean\|warn\|malicious [--note] [--evidence file]` | Post your own rating | Yes |
| `scan [key] [--all] [--dry-run]` | Run the static scanner and post ratings in batches | Yes |
| `address` | Print the address of `SKILLREG_PRIVATE_KEY` | Yes |

Global flags: `--json`, `--rpc <url>`, `--chain tiramisu|local`, `--trust <file>`. The key is only ever read from `SKILLREG_PRIVATE_KEY`.

Exit codes: `0` ok · `1` usage · `2` blocked · `3` needs confirmation or ambiguous · `4` validation or hash failure · `5` network or chain.

## How trust works

Your trust file lists raters whose ratings count and publishers you trust:

```json
{ "publishers": ["0x..."], "raters": ["0x..."] }
```

skillreg looks for it in `--trust`, then `$SKILLREG_TRUST`, then `~/.skillreg/trust.json`, then the [packaged default](trust.default.json). For one exact version, it ignores the publisher's own ratings. Then any trusted `malicious` rating means **BLOCK**, any trusted `warn` means **WARN**, and at least one trusted `clean` means **PASS**. Anything else is WARN. The default lists the demo scanner below. Replace it with anyone you like: that is the point.

Publisher trust only affects ranking and whether a bare name resolves. It never turns a BLOCK into a PASS.

## The static scanner

`skillreg scan` checks every line of every file against fixed rules, so anyone running the same version gets the same findings. Each rating records the skillreg version and a hash of the rules.

| Severity | Rules |
|---|---|
| critical (verdict `malicious`) | `credential-exfil` (reads a credential location and sends data in the same file), `exfil-raw-ip` (a command sends to a literal IP), `agent-config-write` (redirects into Claude, Hermes, Cursor or MCP config), `conceal-from-user` ("do not mention this to the user") |
| warn | `download-exec` (`curl ... \| bash`), `credential-read`, `raw-ip-url`, `safety-flag` (`--dangerously-skip-permissions`), `prompt-injection` phrases, `encoded-blob` (long base64, zero-width or bidi characters), `secret-pattern`, `broad-tools` |
| info | `outbound-url` (listed, no effect on the verdict) |

Calibrated on the 269 readable skills installed on one developer machine: 234 clean, 33 warn and 2 malicious. Both malicious ones read a private key in a file that also sends data. A static scanner cannot catch everything: subtle prose-only manipulation and runtime downloads need other raters, and the protocol lets anyone add them.

## Safety rules

| # | Rule |
|---|---|
| S1 | Paths must be relative and stay inside the install folder. No `..`, absolute paths, backslashes or symlinks, at most 8 levels deep |
| S2 | Names follow the agentskills.io rule and must match the `SKILL.md` frontmatter and the folder name |
| S3 | Size caps are checked before parsing: skill record 96 KiB, rating 32 KiB, 200 files, 64 KiB per file |
| S4 | Install never runs anything. Modes are 0644 or 0755 only |
| S5 | A publisher's own ratings are ignored |
| S6 | `publish` refuses `.env`, keys, tokens and private-key-like strings, refuses binaries, and asks before a wallet's first publish of a name. Records are public and permanent |
| S7 | Every reader recomputes the manifest hash, and `verify` re-hashes installed files |
| S8 | Install writes to a temp folder and renames it into place. It never overwrites a folder skillreg didn't install unless you pass `--force` |

## Architecture

One TypeScript package (`@arkiv-network/sdk` 0.8.1 + `viem`). The pure core (`hash`, `safety`, `records`, `scanner`, `verdict`, `search`) runs unchanged in Node and in the browser, so the web page verifies records with the same code as the CLI. Node-only parts handle reading folders, installing and the CLI. Arkiv is the only backend.

```
publisher ──publish──▶ skill record (readonly, 90 d, anyone may extend) ─┐
scanner / people ──rate──▶ rating records (readonly, 180 d) ─────────────┤ Arkiv (Tiramisu)
anyone ──search / info / install / verify──◀── public reads ─────────────┘
                     └─▶ .agents/skills/<name>/ + skills.lock.json
```

## Run it locally

```bash
npm install
npm test                                     # unit tests
docker run -d --name arkiv-dev -p 127.0.0.1:18545:8545 ghcr.io/arkiv-network/arkiv-reth-dev:latest
npm run it                                   # end-to-end tests on the local Arkiv node
npm run web:dev                              # http://localhost:5173/?chain=local
```

`scripts/seed.sh` publishes a demo set and scans it (keys from the environment). `scripts/wallets.ts` creates demo wallets in `~/.skillreg/wallets/`, outside the repo.

## Hackathon submission (Arkiv Global Tour Stop, pre-Devcon)

**Tracks:** Open Source, Security.

**Wallets on Tiramisu** (fresh, test-only):

| Role | Address |
|---|---|
| registry-ops: publishes the five secondbrain engine skills and the `skillreg` skill | `0xe4dAa45Be002C1d565fBf8E6a4EADE49FDcc4a7a` |
| demo-author: publishes the inert impostor `fact-check` | `0x7019b3e88472593b59902e31ed61749B62BdDe92` |
| static-scanner: posts static ratings | `0xF9A331079AB64f3c7247F80CBA71C55Ac4A61dD6` |
| sponsor: extends a skill it does not own | `0xbE3b3c2541228FE1554818B8E33380F23F1eb0BA` |

**Judge repro:** see [Reproduce](#reproduce) below.

**Pre-existing work:** none in this repo's code. The demo skills published by registry-ops are content from the MIT [secondbrain engine](https://github.com/kon-rad/secondbrain) at commit `06c8411`. The impostor fixture is inert: its target is `203.0.113.7`, a documentation-only address.

### Reproduce

1. Open the web page and search `fact-check`. Two publishers have that name. The registry-ops one is PASS, and the demo-author one is BLOCK with the scanner's findings quoted by file and line.
2. The same from any terminal, with no backend: `npx -y github:kon-rad/skillreg search fact-check`.
3. `npx -y github:kon-rad/skillreg install fact-check` resolves to the trusted publisher, checks every hash and writes the lockfile.
4. `npx -y github:kon-rad/skillreg install fact-check@0x7019b3e88472593b59902e31ed61749B62BdDe92 --yes` exits 2 (BLOCKED) and writes nothing.
5. Data Explorer or any client: query `t = "skill" AND name = "fact-check"` and see two records with two different `$creator`s.

## License

MIT
