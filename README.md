# skillreg

**An open, permissionless registry for agent skills on [Arkiv](https://arkiv.network).** A skill version is a signed, immutable, hash-checked Arkiv record. Anyone can publish one, rate one, or keep one alive. Each user decides whose ratings count, on their own machine. There is no server and no account, and nobody needs permission from us.

- **Web:** https://kon-rad.github.io/skillreg/registry.html (reads Arkiv from your browser)
- **CLI:** `npx -y github:kon-rad/skillreg --help`
- **Data contract:** [`arkiv/schema.md`](arkiv/schema.md) · **Friction report:** [`arkiv/friction.md`](arkiv/friction.md)
- **For agents:** the [`skillreg` skill](skills/skillreg/SKILL.md) teaches any agent to search, vet and install safely
- **Site:** https://kon-rad.github.io/skillreg/ (why it exists) · **Registry:** https://kon-rad.github.io/skillreg/registry.html · **Essay:** https://kon-rad.github.io/skillreg/blog.html ([source](docs/introducing-skillreg.md))

> Code signing plus Community Notes for agent instructions. Models get smarter every week. Your intent, your constraints and your tests shouldn't have to be rewritten each time. skillreg stores what lasts and verifies what's regenerated.

## Why

Agent skills (`SKILL.md` folders for Claude Code, Hermes, Codex, Cursor and others) are a software supply chain with no chain of custody. In February 2026 Snyk audited 3,984 skills from ClawHub and skills.sh: 13.4% had a critical issue and 76 carried confirmed malicious payloads, most combining malware with prompt injection. Today's indexes are each run by one company, names are first-come strings anyone can copy, nothing pins the bytes you install, and abandoned listings never leave.

skillreg changes four things:

| Problem | skillreg |
|---|---|
| Anyone can upload a look-alike `fact-check` | A skill is `name@publisher`. The publisher is Arkiv's `$creator`, set by the chain and impossible to forge |
| A skill can change after you trusted it | Versions are `readonly` records; installs check every file against the signed hash and pin it in a lockfile |
| One company decides what is safe | Anyone can post a rating. You choose which raters count. Same public data, your own verdict |
| Dead listings linger forever | A version lives 90 days. Its owner renews it, or anyone who cares can extend it |

### Won't smarter models make skills obsolete?

Partly, and the design accounts for it.

- **What goes stale:** bundled code (next month's model writes a better script), scaffolding written for weaker models, and workarounds for one model's quirks.
- **What doesn't:** most of a skill isn't code. Of 234 skills on one developer machine, only 59 (25%) contain any script; the rest are facts, decisions, constraints and pitfalls. A model ten times smarter still doesn't know your deploy host, your house style or last month's expensive mistake. Intelligence isn't knowledge.
- **Verification becomes the bottleneck.** When generation is free, regenerating from scratch costs you reproducibility, an audit trail and a fresh injection risk on every run. Knowing who wrote an instruction, that it hasn't changed, and who vouches for it gets more valuable as models speed up.
- **A prompt registry wouldn't escape this.** Prompts are the attack surface; prompt injection lives in prose. Same chain-of-custody problem, new label.

The direction is a registry of **intents and evals**: intent, the facts no model can derive, runnable acceptance checks, and reference code marked disposable. Each new model regenerates the code, the evals prove it works, and a rating records which model passed. See [Roadmap](#roadmap).

### Agents are first-class users

An agent can hold a key; it can't comfortably pass an email signup. Reading needs nothing; publishing, rating and sponsoring need only a wallet; and exit codes (2 blocked, 3 needs confirmation) are built for agents to act on. The human writes the trust file; the agent obeys it. skillreg isn't alignment research and doesn't make a model's values good. It is AI control and supply-chain defence: agent instructions stay readable, pinned and audited, and the human decides whose judgment their agent follows.

### A d/acc tool

| | Today | Next |
|---|---|---|
| **Defensive** | Detection and pinning help installers. Public findings also teach attackers, the CVE-database trade, still net defensive | LLM and sandbox raters whose rules can't be tested offline |
| **Differential** | Makes the open ecosystem safer, so open competes with walled marketplaces on safety | Safe install as the default in every harness |
| **Decentralized** | Data on Arkiv, reads need no backend. Default trust list, page host and CLI source are still one maintainer | Trust lists as records, several defaults, mirrors by hash |
| **Democratic** | Each user picks their own judges | Highlight ratings that agree across rater groups that usually disagree, Community Notes style |

### Why Arkiv, not Sigstore or a GitHub index

Sigstore gives signed provenance and a transparency log, and we'd interoperate with it. Arkiv adds two things we can't get elsewhere: **identity with no account** (`$creator`, no GitHub or Google login vouching for you, so agents can publish) and **ratings with no operator** (third-party judgments as queryable records, no server of ours in between). Leases (`expiresAt` plus `permissionlessExtension`) let abandoned skills fall out on their own while a community keeps orphans and warnings alive.

### Honest limits

- The static scanner is a floor, not the defence: its rules are public, so attackers can test against them. Other raters are the answer, and the protocol lets anyone add one.
- The default trust list is one maintainer's scanner wallet. Replace it.
- Tiramisu testnet only, for now.
- You install through this CLI today; existing harnesses need the gateway below.

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

## Roadmap

1. **Well-known index gateway:** emit `/.well-known/agent-skills/index.json` from Arkiv so Hermes, Claude Code, Codex and `npx skills` read skillreg with no client changes.
2. **Trust lists as records:** subscribable like ad-block filter lists, so no single default decides.
3. **More raters:** an LLM rater and a sandbox rater, each its own wallet with a public track record.
4. **Intents and evals:** acceptance checks in the record format; ratings record the model and date that passed.
5. **Gasless publishing:** a relayer for human authors who will never hold test tokens.
6. **Mirrors:** records copied to git and IPFS by hash, so the data outlives any one network.

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

**Tracks:** Open Source, Security. **Form answers draft:** [`arkiv/submission.md`](arkiv/submission.md).

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

1. Open https://kon-rad.github.io/skillreg/registry.html and search `fact-check`. Two publishers have that name. The registry-ops one is PASS, and the demo-author one is BLOCK with the scanner's findings quoted by file and line.
2. The same from any terminal, with no backend: `npx -y github:kon-rad/skillreg search fact-check`.
3. `npx -y github:kon-rad/skillreg install fact-check` resolves to the trusted publisher, checks every hash and writes the lockfile.
4. `npx -y github:kon-rad/skillreg install fact-check@0x7019b3e88472593b59902e31ed61749B62BdDe92 --yes` exits 2 (BLOCKED) and writes nothing.
5. Data Explorer or any client: query `t = "skill" AND name = "fact-check"` and see two records with two different `$creator`s.

## License

MIT
