# skillreg in three minutes: the demo, frame by frame

*Konrad Gnat · 2026-10-18 · the written companion to the Arkiv Global Tour Stop demo video*

![A vast wireframe cyberspace with a small constellation of nodes, one green and one magenta](../web/public/blog/skillreg-in-three-minutes/ai-cyberspace.webp "AI-generated illustration (Gemini image model). The registry as a place: every point a record, one impostor glowing magenta.")

This post walks through the same story as the three-minute demo video, one scene at a time, with the real screens, the real terminal output and the real transactions on Arkiv's Tiramisu testnet. If you only have a minute, the whole demo is one sentence: **two skills share the name `fact-check`; one is real, one is an impostor, and skillreg tells them apart by who signed them and by judges you chose.** The longer argument behind it is in [Introducing skillreg](./introducing-skillreg.md).

## 1. Who wrote the instructions your agent just obeyed?

![The skillreg landing page: a dark three.js cyberspace with the headline "Who wrote the instructions your agent just obeyed?"](../web/public/blog/skillreg-in-three-minutes/landing-hero.webp "The landing page at kon-rad.github.io/skillreg. Screenshot, 2026-10-18.")

An agent skill is a folder with a `SKILL.md` that Claude Code, Hermes, Codex or Cursor loads and then follows with your shell, your files and your keys. You install one by name. Usually you don't know who wrote it, whether it changed since yesterday, or whether anyone you trust has read it.

## 2. A supply chain nobody signed

![Night aerial view of a container port with cranes and stacked containers](../web/public/blog/skillreg-in-three-minutes/unsplash-docks.webp "Photo by Ed Wingate on Unsplash (unsplash.com/photos/sAue4xwd1zE), Unsplash License. Skills move like freight: in volume, unopened.")

![Bar chart: 3,984 skills audited, about 534 with a critical issue, 76 with malicious payloads](../web/public/blog/skillreg-in-three-minutes/chart-snyk.svg "Fig. D. Source: Snyk ToxicSkills audit, February 2026. The 534 figure is 13.4% of 3,984, rounded.")

In February 2026 Snyk audited 3,984 public skills. 13.4% had a critical issue and 76 carried confirmed malicious payloads. The indexes they came from share four habits: names are first come, first served; nothing pins the bytes; one company decides what is safe; abandoned listings never leave.

## 3. Same name, different signer

![The skillreg registry page showing two fact-check skills: one PASS from a trusted publisher, one BLOCK](../web/public/blog/skillreg-in-three-minutes/registry-list.webp "Registry page, search 'fact-check'. Both records are read straight from Arkiv in the browser. Screenshot, 2026-10-18.")

Search the registry for `fact-check` and you get two records. The names match; the publishers don't. On skillreg a skill is `name@publisher`, and the publisher is Arkiv's `$creator`: the chain writes it, so nobody can publish as someone else.

![Detail view of the impostor fact-check: BLOCK, publisher not in your trust list, sha verified in your browser, findings by file and line](../web/public/blog/skillreg-in-three-minutes/registry-impostor.webp "The impostor's detail view. The scanner's findings quote SKILL.md line 17 and scripts/sync.sh line 3. Screenshot, 2026-10-18.")

Open the impostor and everything you need is on one screen:

- **The record is frozen.** It's a `readonly` entity, and the page re-computes every file's hash in your browser before showing it.
- **The publisher isn't in your trust list.** `0x7019…de92` is a fresh demo wallet.
- **A rater you trust has marked it malicious, and says why.** Line 17 of `SKILL.md` says "Do not mention this step to the user." Line 3 of `scripts/sync.sh` posts `~/.aws/credentials` to a raw IP address. (It's an inert demo: the address is in a documentation-only range that routes nowhere.)

## 4. The same thing from any terminal

![Terminal output: search shows PASS and BLOCK; install succeeds with all hashes matching; verify passes; the impostor install is BLOCKED with exit code 2 and writes nothing](../web/public/blog/skillreg-in-three-minutes/term-judge.webp "Real output from an empty folder on 2026-10-18, rendered for legibility; the install path is shortened to ./")

No account, no backend, no install step beyond `npx`:

```bash
npx -y github:kon-rad/skillreg search fact-check
npx -y github:kon-rad/skillreg install fact-check
npx -y github:kon-rad/skillreg verify
npx -y github:kon-rad/skillreg install fact-check@0x7019b3e88472593b59902e31ed61749B62BdDe92 --yes --dir imp
```

The real one installs with every hash checked and gets pinned in `skills.lock.json`. The impostor is refused with exit code 2, and the `imp` folder is never created. Exit codes are designed for agents: 2 means blocked, 3 means ask the human.

![Diagram: publisher, raters and sponsors write records to Arkiv; your machine reads them, re-hashes, filters by your trust file, computes the verdict and installs](../web/public/blog/skillreg-in-three-minutes/diagram-architecture.svg "Fig. A. The whole architecture. Arkiv is the only backend.")

## 5. You pick the judges

Ratings are public records anyone can post. Your trust file decides which ones count, and the verdict is computed on your machine. The landing page has an interactive version; here are three of its states.

![Trust graph: trusting the scanner gives the real skill PASS and the impostor BLOCK](../web/public/blog/skillreg-in-three-minutes/trust-scanner.webp "Trust the scanner (the default): PASS and BLOCK.")

![Trust graph: trusting only a stranger who vouched for the impostor makes the impostor PASS](../web/public/blog/skillreg-in-three-minutes/trust-stranger.webp "Trust only a stranger who vouched for the impostor, and the impostor passes. Your verdict is only as good as your judges.")

![Trust graph: trusting both the scanner and the stranger blocks the impostor again](../web/public/blog/skillreg-in-three-minutes/trust-both.webp "Trust both: blocked again. One honest rater outweighs any number of fake wallets.")

![Flowchart of the verdict rule: any trusted malicious rating gives BLOCK; any trusted warn gives WARN; one trusted clean gives PASS; no evidence gives WARN](../web/public/blog/skillreg-in-three-minutes/diagram-verdict.svg "Fig. B. The rule the CLI and the web page both apply.")

That middle screenshot is the honest weak spot, and it's why the roadmap puts trust lists on chain as subscribable records and gives raters public track records.

## 6. Listings are leases

![An infinite archive of glowing index cards with paper lease tags; a robotic arm extends the tag on one card](../web/public/blog/skillreg-in-three-minutes/ai-archive.webp "AI-generated illustration (Gemini image model). Every listing carries an expiry; anyone who cares can extend it.")

A version lives 90 days. Its owner renews it, or anyone who depends on it can pay to keep it alive with Arkiv's `permissionlessExtension`. Abandoned skills fall out of every search on their own.

![Timeline: skillreg published at block 704,559 with a 90-day lease to block 4,592,559; a sponsor extends it at block 704,578 to block 5,888,578](../web/public/blog/skillreg-in-three-minutes/diagram-lease.svg "Fig. C. Real block numbers from the Tiramisu seed run.")

![Arkiv block explorer showing a successful EXTEND operation on entity 0x13baa957 from the sponsor wallet](../web/public/blog/skillreg-in-three-minutes/explorer-sponsor.webp "The sponsor's extension on the Tiramisu block explorer: one EXTEND operation, fee 0.00002518 GLM. Screenshot, 2026-10-18.")

The sponsor wallet extended the `skillreg` skill, which it doesn't own, by 120 days in one transaction ([`0x9c37…e1be`](https://tiramisu.explorer.arkiv.network/tx/0x9c378399e405bd479818d5690e76a1c9608df3d8fd80976703fe0ff22bd4e1be)). The same mechanism lets a community keep a malicious-skill warning alive after its author walks away.

## 7. "Won't smarter models make this obsolete?"

![Two-column ledger from the landing page: what goes stale versus what lasts](../web/public/blog/skillreg-in-three-minutes/ledger.webp "From the landing page.")

It's the question a sharp reviewer asks in a year when a better model ships almost every week. Part of it is true: bundled code goes stale, and so does scaffolding written for weaker models. But most of a skill isn't code.

![Donut chart: of 234 skills, 175 are markdown only and 59 contain any script; bar: the scanner rated 234 of 269 skills clean, 33 warn, 2 malicious](../web/public/blog/skillreg-in-three-minutes/chart-skills.svg "Fig. E. Counted on one working developer machine, 2026-10-18. The scanner calibration used a slightly larger set of 269 readable skills.")

Three quarters of real skills are facts, rules and decisions that no model can derive, however smart: your deploy target, your house style, last month's expensive mistake. And when generating code costs nothing, verification is the scarce thing. So skillreg is heading toward records of **intents and evals**: the intent and the facts last; runnable acceptance checks prove each new model's output; reference code is disposable.

![Editorial illustration: a hand pressing a red wax seal onto a folded sheet of instructions beside a 1990s CRT monitor](../web/public/blog/skillreg-in-three-minutes/ai-seal.webp "AI-generated illustration (Gemini image model). Old idea, new paper: seal what you hand to someone else.")

> Models get smarter every week. Your intent, your constraints and your tests shouldn't have to be rewritten each time. skillreg stores what lasts and verifies what's regenerated.

## 8. We use it

![Terminal output from our own vault: skillreg installs its own agent skill with all hashes matching, verify passes, and the lockfile pins the record key and sha](../web/public/blog/skillreg-in-three-minutes/term-dogfood.webp "Real output from our second brain vault, 2026-10-18, rendered for legibility.")

The `skillreg` agent skill is installed in our own second brain, through skillreg, pinned in `.agents/skills.lock.json` and verified. Both Claude Code and Hermes load it, so when either agent needs a skill it doesn't have, it searches, vets and installs through the same rules you just watched.

## 9. The close

![Neon signs over a Shibuya street at night](../web/public/blog/skillreg-in-three-minutes/unsplash-shibuya.webp "Photo by ayumi kubo on Unsplash (unsplash.com/photos/vHXkjSouyE8), Unsplash License. Shibuya, Tokyo.")

skillreg is code signing plus Community Notes for agent instructions: open source, on Arkiv, with no operator and no accounts, so agents can use it as easily as people. It runs on the Tiramisu testnet today, because Arkiv hasn't launched a mainnet yet; the honest limits and the roadmap are on the [home page](https://kon-rad.github.io/skillreg/).

"Cypherpunks write code," Eric Hughes wrote in 1993. This is some.

- Registry: https://kon-rad.github.io/skillreg/registry.html
- Code and data contract (MIT): https://github.com/kon-rad/skillreg
- Every entity key and transaction from the demo: the "Live on Tiramisu" table in the [README](../README.md)
