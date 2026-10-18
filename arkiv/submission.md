# Devfolio submission draft (Arkiv Global Tour Stop, pre-Devcon)

Answers to paste into the Devfolio form. Each answer is plain text under its label. Items marked TODO need the Tiramisu seed run, the video, or Konrad's own answer. Rules and question list: the 18 Devfolio questions from the event's rules repo (https://github.com/Arkiv-Network/global-tour-stop-pre-devcon).

Tracks: Open Source (first), Security (second).

---

### Project name

skillreg

### Tagline

Code signing plus Community Notes for agent skills: signed, immutable, hash-checked on Arkiv, rated by whoever you trust.

### The problem it solves

Agent skills (SKILL.md folders loaded by Claude Code, Hermes, Codex, Cursor and others) run with the agent's full permissions, and they are a software supply chain with no chain of custody. In February 2026 Snyk audited 3,984 skills from ClawHub and skills.sh: 13.4% had a critical issue and 76 carried confirmed malicious payloads. Today's indexes are each run by one company, names are first-come strings anyone can copy, nothing pins the bytes you install, and abandoned listings never leave.

skillreg makes a skill name@publisher, where the publisher is Arkiv's $creator and cannot be forged. Every version is a readonly record with a hash of every file, re-checked on install and pinned in a lockfile. Anyone can post a rating; each user's trust file decides whose ratings count, and the verdict (PASS, WARN, BLOCK) is computed on their own machine. Listings are 90-day leases that the owner renews or anyone can sponsor. No server, no account.

Who is misled today and what changes for them: a developer or an agent that types "install fact-check" gets whichever upload came first. With skillreg they get the version from a publisher they trust, byte for byte, and an impostor is refused with the scanner's findings quoted by file and line.

Why it still matters as models improve weekly: most of a skill is not code. Of 234 skills on one developer machine, only 59 (25%) contain any script; the rest are facts, decisions and constraints no model can derive, however smart. When generation is cheap, verification is the bottleneck: who wrote an instruction, has it changed, who vouches for it. A prompt registry would have the same problem, since prompt injection lives in prose. The roadmap moves records toward intents plus evals, so each new model regenerates the code and the evals prove it works.

### Challenges we ran into

1. The SDK caps string attributes at 128 bytes, so the skill description moved to the payload with a 120-byte summary attribute.
2. $createdAt is returned but cannot be filtered on, so the scanner cannot ask for "skills since block N". We refused to trust a publisher-written timestamp (a publisher could backdate it to dodge the scanner); the scanner lists all active skills and skips ones it already rated.
3. Our first scanner rules marked 60 legitimate skills malicious when run over 269 real skills. Rules v1.1 reserve BLOCK for strong evidence: 234 clean, 33 warn, 2 malicious (both send a private key).
4. A keyword-stuffed impostor outranked the real fact-check in search. Any matching skill from a trusted publisher now ranks above untrusted ones.
5. readonly entities can still be deleted by their owner, so ratings key the content hash and quote the offending excerpt, and the evidence survives the skill record.
6. The faucet needs an email-registered hub account, so we built and tested everything on the local Arkiv dev node first.

### Q1. Live app URL

https://kon-rad.github.io/skillreg/registry.html (reads Tiramisu directly from the browser, no backend). Overview and live trust demo: https://kon-rad.github.io/skillreg/. Essay: https://kon-rad.github.io/skillreg/blog.html. CLI with no install: npx -y github:kon-rad/skillreg search fact-check

### Q2. Indian nationality on team

TODO: Konrad's answer.

### Q3. Why Arkiv? What breaks on Postgres, IPFS, a subgraph or an API?

The property we cannot lose is $creator as an unforgeable publisher identity that needs no account. A skill is name@$creator. On Postgres or an API, the operator decides who owns a name and can change it; on IPFS content is addressed but nobody is; a subgraph indexes a contract we would have to write and run. Sigstore gives signed provenance, but its keyless signing ties identity to an OIDC login (GitHub, Google), which an agent cannot comfortably get.

Three more Arkiv properties carry the design. readonly makes a published version immutable, so a skill cannot change after you trusted it. Entity expiration plus permissionlessExtension turns a listing into a lease: the owner renews, anyone who depends on it can sponsor it, and abandoned skills fall out on their own; malicious ratings are extendable by anyone, so a community can keep a warning alive. Public queries from a wallet-less client mean the web page and the CLI read the registry with no server of ours, so there is nothing to take down and no operator deciding what is safe.

What stays off Arkiv: install counts, any human identity or personal data, binaries and skills over 96 KiB, and the user's trust file (it lives on their machine). Verdicts are computed client-side, never stored.

### Q4. How each Arkiv feature is used, with code links

- $creator as publisher identity, filtered on chain with createdBy: https://github.com/kon-rad/skillreg/blob/main/src/arkiv.ts#L88 (shown in the UX as name@0x... and "trusted publisher")
- $creator filter for trusted raters only (compound OR): https://github.com/kon-rad/skillreg/blob/main/src/arkiv.ts#L104-L106
- readonly + permissionlessExtension on every skill version, 90-day expiration: https://github.com/kon-rad/skillreg/blob/main/src/arkiv.ts#L124-L130 (UX: "expires in N days, anyone can extend it")
- Lifetime extension as renew or sponsor: https://github.com/kon-rad/skillreg/blob/main/src/arkiv.ts#L133-L135
- Per-type expiration (skills 90 days, ratings 180 days) and permissionlessExtension only on malicious ratings: https://github.com/kon-rad/skillreg/blob/main/src/arkiv.ts#L11-L12 and https://github.com/kon-rad/skillreg/blob/main/src/records.ts#L196
- Atomic batch writes, 25 ratings per executeBatch: https://github.com/kon-rad/skillreg/blob/main/src/arkiv.ts#L138-L155
- Typed attributes for queried fields (t, schema, name, sha as bytes32), payload for files; attribute-only listing with pages of 200: https://github.com/kon-rad/skillreg/blob/main/src/arkiv.ts#L82
- Client-side verdict that ignores the publisher's own ratings: https://github.com/kon-rad/skillreg/blob/main/src/verdict.ts#L12-L18

### Q5. Link to friction.md

https://github.com/kon-rad/skillreg/blob/main/arkiv/friction.md

### Q6. Creator wallet addresses and roles

registry-ops (funds the other wallets; publishes the five secondbrain engine skills and the skillreg skill): 0xe4dAa45Be002C1d565fBf8E6a4EADE49FDcc4a7a
demo-author (publishes the inert impostor fact-check): 0x7019b3e88472593b59902e31ed61749B62BdDe92
static-scanner (posts static ratings): 0xF9A331079AB64f3c7247F80CBA71C55Ac4A61dD6
sponsor (extends a skill it does not own): 0xbE3b3c2541228FE1554818B8E33380F23F1eb0BA

Live entities and transactions (Tiramisu, seeded 2026-10-18; open any hash at https://tiramisu.explorer.arkiv.network/tx/<hash>):

fact-check@registry-ops: key 0xfe43c71a313a0cb6b5bba689968a4dd4bb88a1364ce3d3a2b0717fe6fd6434e8, tx 0x59abb4f5d565939960426315ca82a144906e17ebaf55146a18e8b39c2585884f
fact-check@demo-author (impostor): key 0xc1834f4011c8b02f661522cc82d941867a3c5a37039cdef75ae794850b8b7d1a, tx 0x3d368c2c65b8b1548f7a1e1d38160327868736aa887270006cb006f74fba7a27
skillreg@registry-ops: key 0x13baa957a849b234980bd55679b94f37508d103f307000757975d398421efa3a, tx 0x08c382e3c2d38ad100dd7d349e503e56311d68489835e096fd1faaf10e4ccaff
company-report@registry-ops: key 0xf570261cd55b9ef45c8e548b06c4f089b6cb0cb8a74af8137fc7089ad628cbce, tx 0x3c8ef3d01ef51f09b4571c6540ca90234505a34e8cf8326f45312a8e230a0b93
ingest@registry-ops: key 0xe67c1697706af49e6bc74377b9993614406c52f1c41a9ef141b4e5ca8b5415bf, tx 0x69aa0a265b55c6bac3c85949408a74cc2689b2dca7d5b319a5cc7050349210b7
livestream-x@registry-ops: key 0x9cf4e358971eb7e3f28e5eaf4622d68d5a0a2b5735642608172b54d0d4864bb4, tx 0x967289cc903dd64a5e3a338687bd67c94b67ff0abedfdbb4ea2e2b6168bd3a2f
org-member@registry-ops: key 0xa72a5b42e9c1b455ee1f4d5fafe224e85679b9965c1c80cbd8b97cf1562dd654, tx 0xc8b9d530e6ca9d673f0ec2a4a7c662dd769f46915af137f37dcb1c90aa97af45
7 static ratings in one batch (static-scanner): tx 0xb604a50a1a542769052f633407d3bb2c98d799cbadac077b1ff61530d376ab3e; the impostor's malicious rating is key 0xf3871c9988d30a1ab6a44f3524ea29a868f8fb9fbda0da853982d647244d033b
Sponsor extends skillreg, which it does not own, to block 5,888,578: tx 0x9c378399e405bd479818d5690e76a1c9608df3d8fd80976703fe0ff22bd4e1be

### Q7. Link to schema.md

https://github.com/kon-rad/skillreg/blob/main/arkiv/schema.md

### Q8. Step-by-step judge repro

1. Open https://kon-rad.github.io/skillreg/registry.html and search fact-check. Two publishers have that name. The registry-ops one is PASS; the demo-author one is BLOCK with the scanner's findings quoted by file and line.
2. Same from any terminal, no backend: npx -y github:kon-rad/skillreg search fact-check
3. npx -y github:kon-rad/skillreg install fact-check resolves to the trusted publisher, checks every hash and writes skills.lock.json.
4. npx -y github:kon-rad/skillreg install fact-check@0x7019b3e88472593b59902e31ed61749B62BdDe92 --yes exits 2 (BLOCKED) and writes nothing.
5. In the Data Explorer or any client, query t = "skill" AND name = "fact-check" and see two records with two different $creator values.
6. Local, from a clean clone: npm install, npm test (149 unit tests), then start the arkiv-reth-dev container and npm run it (4 end-to-end tests). Exact commands in the README.

### Q9. Pre-existing work

None in this repo's code; all of it was written from 2026-10-17. The demo skills published by registry-ops are content from the MIT secondbrain engine (https://github.com/kon-rad/secondbrain) at commit 06c8411. The impostor fixture is inert: its target is 203.0.113.7, a documentation-only address.

### Q10. Arkiv surfaces used

TS SDK, JSON-RPC, Docs, Hub, Faucet, Block Explorer, Data Explorer, Other

### Q11. Name of "Other"

arkiv-reth-dev local node (Docker image ghcr.io/arkiv-network/arkiv-reth-dev), used for all development and end-to-end tests.

### Q12. Time to first entity

2 h or less

### Q13. LLMs used

Claude (Anthropic) through Claude Code and Hermes Agent, for design, implementation, tests and docs, with Konrad reviewing and directing.

### Q14. The one thing Arkiv should improve first

Make $createdAt filterable, or say clearly on the Fundamentals page that it is returned but not filterable. Without it, any "new since block N" worker (scanners, indexers, notifiers) has to rescan everything or trust a timestamp the writer controls. Close second: an address-only faucet tier for CI and agents.

### Q15. Open to a 20-minute feedback call

TODO: Konrad's choice.

### Q16. Built 2026-10-09 to 18, with disclosures

Yes. Repo created 2026-10-17. Disclosure as in Q9.

### Q17. Public MIT repo and working links

Yes: https://github.com/kon-rad/skillreg (MIT).

### Q18. Devcon plans

TODO: Konrad's answer.

### Video link

TODO: 3-minute demo video. Suggested beats: the problem (15 s), search fact-check and see PASS vs BLOCK (45 s), install and the blocked install from the terminal (45 s), "won't smarter models make this obsolete?" and the intents-plus-evals answer (30 s), d/acc and the roadmap (30 s), Data Explorer showing two $creator values (15 s).

### Deadline commit SHA

TODO: git rev-parse HEAD at submission, before 2026-10-19 06:59 KL.
