# skillreg data contract (schema 1)

Everything skillreg knows lives in two Arkiv record types. Anyone can write either one; every reader validates both. This file is the contract: build your own client, scanner, rater or web page against it without asking.

All records: `contentType = "application/json"`, attribute `t` names the type, attribute `schema = u64(1)`.

## `skill`: one published version

| Attribute | Type | Rule |
|---|---|---|
| `t` | str | `"skill"` |
| `schema` | u64 | `1` |
| `name` | str | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 chars, equals the `name` in the payload's `SKILL.md` frontmatter |
| `version` | str | `x.y.z` from frontmatter `metadata.version` (or top-level `version`), else `0.0.0` |
| `sha` | bytes32 | Manifest hash of the files (below) |
| `summary` | str | Description, whitespace collapsed, at most 120 UTF-8 bytes |
| `kw1`..`kw5` | str | Optional keywords, `^[a-z0-9-]{1,32}$` |
| `license` | str | Frontmatter `license` (max 64 bytes) or `unspecified` |
| `size` | u64 | Total bytes of file text |
| `files` | u64 | File count |

**Payload** (max 96 KiB):

```json
{ "description": "full frontmatter description (max 1024 chars)",
  "files": [ { "path": "SKILL.md", "mode": 420, "text": "---\nname: ..." },
             { "path": "scripts/run.sh", "mode": 493, "text": "..." } ] }
```

Files are sorted by path (UTF-8 byte order), text only (valid UTF-8, no NUL), at most 200 files of at most 64 KiB each. `mode` is `420` (0644) or `493` (0755). Paths are relative, `/`-separated, with no empty, `.` or `..` segments, no backslash, colon or control characters, at most 8 levels and 255 bytes.

**Manifest hash:** for each file in path order, the UTF-8 bytes of `path + "\0" + mode + "\0" + hex(sha256(text)) + "\n"`, concatenated; `sha = sha256(all)`. Readers recompute it and reject the record if it differs from the `sha` attribute.

**Expiration:** 90 days at creation. **Flags:** `readonly` (the version can never change) and `permissionlessExtension` (anyone can extend its life: owners renew, others sponsor).

**Identity:** a skill is `name@$creator`. `$creator` is set by the chain and cannot be forged; two publishers can both have a `fact-check`. "Latest" means the record with the highest `$createdAt` for that name and creator.

## `rating`: one verdict about one exact version

| Attribute | Type | Rule |
|---|---|---|
| `t` | str | `"rating"` |
| `schema` | u64 | `1` |
| `skill` | key | Entity key of the rated `skill` record |
| `sha` | bytes32 | Manifest hash of the rated version |
| `verdict` | str | `clean`, `warn` or `malicious` |
| `kind` | str | `static` (the scanner) or `human` |
| `rater_ver` | str | For `static`, the skillreg version that produced it; `human` otherwise |
| `findings` | u64 | Number of findings |

**Payload** (max 32 KiB):

```json
{ "rules_hash": "0x... (static) or null",
  "findings": [ { "file": "scripts/sync.sh", "line": 3, "rule": "credential-exfil", "severity": "critical", "excerpt": "max 200 chars" } ],
  "note": "max 2000 chars, optional" }
```

**Expiration:** 180 days, so ratings fade and must be re-earned. **Flags:** `readonly`; plus `permissionlessExtension` only when `verdict = malicious`, so anyone can keep a warning alive.

**Identity:** a rating is only as good as its `$creator`. Clients count ratings only from raters the user trusts, and drop ratings by the skill's own creator.

## Verdict rule (client-side)

For one version (key `k`, sha `h`, creator `c`), using ratings with `sha = h`, `skill = k`, `$creator` in the user's trusted raters and `$creator != c`:

1. any `malicious` → **BLOCK**
2. else any `warn` → **WARN**
3. else any `clean` → **PASS**
4. else → **WARN** (no ratings from raters you trust)

## Queries the clients run

| Use | Query |
|---|---|
| All skills, attributes only (search runs locally) | `t = "skill" AND schema = 1`, select `key, creator, createdAt, expiresAt, attributes`, pages of 200 |
| One publisher's versions of a name | `t = "skill" AND name = "<n>"` + `createdBy(<publisher>)` |
| Everyone's versions of a name | `t = "skill" AND name = "<n>"` |
| Ratings of a version by trusted raters | `t = "rating" AND sha = <h> AND ($creator = <r1> OR $creator = <r2> ...)`, with payload |
| A rater's ratings (scanner dedupe) | `t = "rating"` + `createdBy(<rater>)`, attributes only |
| Duplicate check before publishing | `t = "skill" AND sha = <h>` + `createdBy(<me>)` |

Writes: one `createEntity` per publish; one `executeBatch` per 25 ratings; `extendEntity` to renew or sponsor.

## What stays off Arkiv

Skills over 96 KiB, binaries, telemetry, install counts, and any personal data. The trust file is local to each user. There is no server.
