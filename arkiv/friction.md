# Friction report

What we expected, what happened, versions and how to reproduce, for every Arkiv surface we used. Smooth paths are recorded with the same detail.

**Versions:** `@arkiv-network/sdk` 0.8.1, `viem` 2.x, Node 22.22.0, macOS 26 (Darwin 25.5.0). Local node: `ghcr.io/arkiv-network/arkiv-reth-dev@sha256:8204268426c2827f136a4fd0f422d61f11f503388df0f70a273c1227b6f6fb4d`. Testnet: Tiramisu (chain 7738577).

**Time to first entity:** under 2 hours (first entity on the local dev node at about 13:51 KL on 2026-10-17, from a cold start the same morning).

## 1. `$createdAt` is documented as queryable but cannot be filtered on

- **Surface:** TypeScript SDK query builder; Docs (Fundamentals, system attributes).
- **Expected:** the Fundamentals page lists `$owner, $creator, $createdAt, $updatedAt, $expiresAt` as queryable system attributes, so `gt("$createdAt", u64(n))` should work. We wanted it for "skills published since block N" (the scanner's work list).
- **Actual:** the SDK throws before sending: `InvalidPredicateError: "$createdAt" is returned in query results but carries no index, so it cannot be filtered on.` `$expiresAt` range queries do work.
- **Repro:** `pub.select({ key: true }).where(eq("t", str("skill")), gt("$createdAt", u64(1n))).fetch()`.
- **Impact:** we could not use a publisher-written timestamp instead, because a publisher could backdate it to dodge the scanner. The scanner now lists all active skills and skips ones it already rated, which costs a full scan each cycle.
- **Suggested fix:** index `$createdAt` (block-ordered, so it is cheap), or say "returned, not filterable" on the Fundamentals page.

## 2. The 128-byte `str` limit is only in the SDK source

- **Surface:** Docs; SDK `attr` module.
- **Expected:** attribute value limits on the Fundamentals or data-modelling page.
- **Actual:** found by reading `src/attr/values.ts`: `MAX_STRING_BYTES = 128`, no control characters; also 32 cells per entity including payload and content type, attribute names max 32 bytes, and reserved names (`key`, `str`, `and`...). The SDK's error messages are excellent once you hit them.
- **Impact:** our first design put the 1,024-character skill description in an attribute. We moved it to the payload and keep a 120-byte `summary` attribute.
- **Suggested fix:** a limits table on the docs site (payload 128 KiB, 32 cells, 128-byte strings, 200 results per page).

## 3. The faucet needs an account with an email address

- **Surface:** Hub faucet.
- **Expected:** paste an address, solve a captcha, receive test GLM.
- **Actual:** the faucet requires wallet sign-in (SIWE) and account registration with an email address, then a Cap.js proof-of-work check. This blocks scripted or CI funding, and an agent cannot claim for a fresh test wallet without the human's email.
- **Workaround:** we built and tested everything against the local dev node first (section 4), and the human claimed once for a funder wallet that funds the others.
- **Suggested fix:** an address-only faucet tier with a small daily amount, or a documented API for CI.

## 4. Smooth path: the local dev node

- **Surface:** `Arkiv-Network/arkiv` repo, `arkiv-reth-dev` image.
- **Tested:** `docker run -p 127.0.0.1:18545:8545 ghcr.io/arkiv-network/arkiv-reth-dev:latest`. Chain ID 1337 matches the SDK's `localhost` chain, and the standard dev accounts are prefunded. Every operation we use worked: create with `readonly` and `permissionlessExtension`, field selection without payload, `bytes32`/`key` equality, 41-term `OR`, `createdBy`, `executeBatch` with 25 creates, non-owner extend (and its rejection without the flag), patch rejection on readonly, owner delete of readonly.
- **Expected vs actual:** as documented, except item 1.
- **Suggested fix:** document this image on the docs site as the local development path. We found it by reading the repo's Dockerfile.

## 5. Payloads are not compressed

- **Surface:** SDK transactions.
- **Expected:** `brotli-wasm` is an SDK dependency, so large payloads might be compressed in transit.
- **Actual:** `sendArkivTransaction` sends payload bytes as-is. A 100 KiB JSON payload cost about 4.1M gas on the dev node.
- **Impact:** we cap skills at 96 KiB to leave headroom for transaction size limits.
- **Suggested fix:** document whether compression is planned, and the maximum transaction size on Tiramisu.

## 6. Readonly entities can still be deleted by their owner

- **Surface:** entity lifecycle.
- **Expected and actual:** as documented, `readonly` blocks patches but not `deleteEntity`. Confirmed on the dev node.
- **Impact on design:** a publisher can delete a malicious version after it is flagged. Ratings therefore quote the offending excerpt and key the hash (`sha`), so the evidence survives the skill record.

## 7. Tiramisu

Results of the live run are recorded in the README (wallets, entity keys, transactions).
