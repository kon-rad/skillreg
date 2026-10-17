# Introducing skillreg: a trust layer for agent instructions

*Konrad Gnat · 2026-10-18 · built for the Arkiv Global Tour Stop (pre-Devcon)*

My agents install skills every week. A skill is a folder with a `SKILL.md` that Claude Code, Hermes, Codex or Cursor loads and then follows, with the agent's full permissions: shell, files, keys. I have 234 of them on one machine. Until this week I couldn't have told you, for most of them, who wrote them, whether they'd changed since I installed them, or whether anyone I trust had looked at them.

That isn't a hypothetical risk. In February 2026 Snyk audited 3,984 skills from ClawHub and skills.sh and found that 13.4% had a critical issue and 76 carried confirmed malicious payloads, most combining malware with prompt injection. Agent skills are a software supply chain with no chain of custody.

So I built **skillreg**: an open, permissionless registry for agent skills on [Arkiv](https://arkiv.network). The short version is **code signing plus Community Notes for agent instructions**.

## What it does

- **A skill is `name@publisher`.** The publisher is Arkiv's `$creator`, set by the chain. Anyone can upload a `fact-check`, but nobody can upload one as someone else.
- **Versions can't change.** Each version is one `readonly` record with a hash of every file. Install re-checks every byte and pins it in `skills.lock.json`. `verify` re-checks later.
- **Anyone can rate, you choose who counts.** Ratings are public records. Your trust file lists the raters you believe; the verdict (PASS, WARN, BLOCK) is computed on your own machine. The same data can give you and me different verdicts, and that's correct.
- **Listings are leases.** A version lives 90 days. The owner renews it, or anyone who depends on it can extend it. Abandoned skills fall out on their own.
- **No server, no account.** The web page and the CLI read Arkiv directly. There's nothing of mine in the middle to take down or to trust.

The demo: two publishers both have a skill called `fact-check`. One is the real one. The other is an inert impostor whose script sends a credential file to an IP address. The static scanner (a separate wallet) rates it malicious, quoting file and line. `skillreg install fact-check` resolves to the trusted publisher and checks every hash. Installing the impostor by its full name exits 2 and writes nothing.

## The question I had to answer first

While building this I kept running into one objection, and it's the right one: **we're in an intelligence explosion. A better model ships nearly every week. Isn't a skill registry just a warehouse of stale code that the next model would write better from a prompt? Shouldn't it be a prompt registry instead?**

I took it seriously. Here's where I landed.

**Part of it is true.** Three kinds of skill content do go stale:

1. **Bundled code.** Next month's model writes a better script than the one pinned in March. Regenerating wins.
2. **Scaffolding for weaker models.** "Think step by step", rigid twelve-step procedures, over-specified output formats. These can make a stronger model worse.
3. **Workarounds for one model's quirks.** They die with the model.

**But most of a skill isn't code.** I counted: of my 234 skills, 59 (25%) contain any script at all. The other 75% are markdown, and when you read them, they're mostly facts, decisions, constraints and pitfalls.

**Intelligence isn't knowledge.** A model ten times smarter still doesn't know my deploy host, that I never want em-dashes in my writing, which database is the master, which API endpoint replaced the old one, or the mistake that cost me 63 GB of video last month. That's context, not reasoning. No prompt derives it. A brilliant new hire still reads the runbook on day one, and a skill is a runbook.

**When generation is free, verification is the bottleneck.** Regenerating everything from scratch every time means no reproducibility (the same prompt gives different code every week), no audit trail, paying again for solved problems, and a fresh chance for an injected instruction on every run. The faster models get, the more it's worth knowing who wrote an instruction, that it hasn't changed, and who vouches for it.

**A prompt registry has exactly the same problem.** Prompts are the attack surface. Prompt injection lives in prose, which is where static scanners are weakest. Calling skills "prompts" doesn't remove the need for a chain of custody; it's the same registry with a new label.

## Where this goes: intents and evals

The objection did change the roadmap. If models improve weekly, the lasting asset isn't the implementation. It's the spec and the test. So the record format is heading toward:

| Part | Lifetime |
|---|---|
| **Intent:** what the skill is for | Long |
| **Facts and constraints:** what no model can derive | Long, renewed as they change |
| **Evals:** runnable acceptance checks | Long |
| **Reference code:** marked disposable | Short; each new model regenerates it |

Ratings then mean more than "this file looks safe". They also mean "model X on date Y produced output that passed these evals". Each new model regenerates the code; the evals prove it works; the record shows who checked. The 90-day lease already suits content that decays.

> Models get smarter every week. Your intent, your constraints and your tests shouldn't have to be rewritten each time. skillreg stores what lasts and verifies what's regenerated.

## Agents are the real customers

As agents start writing skills and handing them to each other, the users of a registry become machines. An agent can hold a key and pay for storage. It can't comfortably pass an email-plus-captcha signup. (I learned this the hard way: Arkiv's own testnet faucet needs an email account, which is the one step of this project an agent couldn't do for me.) skillreg needs nothing to read and only a wallet to publish, rate or sponsor, and its exit codes are built for an agent to act on.

The division of labour I want: **the human sets the trust policy, the agent does the work, the public record keeps both honest.**

To be precise about what that is and isn't: skillreg doesn't make a model's values good. That's alignment research. What it does is narrower and real. It keeps what agents are told to do in readable markdown, pinned and audited in public, and it keeps the human in charge of whose judgment their agent obeys. That's AI control and supply-chain defence, and the same pattern extends to MCP servers, tools and agent-to-agent messages.

## Why it's a d/acc project

Vitalik Buterin's d/acc (decentralized, defensive, differential, democratic acceleration) asks builders to speed up the technologies that make the world safer for pluralism. In "My techno-optimism" he singles out info-defence: tools that plug into "a large and sophisticated group of people" instead of one arbiter of good and bad, and that "should not be something that requires explicit installs" but come by default.

skillreg is info-defence for agents. Scoring it honestly:

- **Defensive:** yes. Detection and pinning help the installer. Public findings also teach attackers, the same trade as CVE databases, and still net defensive.
- **Differential:** yes. It makes the *open* skill ecosystem safer, so open can compete with walled marketplaces on safety, not just freedom.
- **Democratic:** yes, by design. Everyone picks their own judges.
- **Decentralized:** partly. The data lives on Arkiv and needs no backend. But today the default trust list is my scanner wallet, the page is on GitHub Pages and the CLI installs from GitHub. The failure mode Vitalik would warn about is a default list that quietly becomes the central authority, the way browser root certificate lists did. The next steps exist to remove that.

## Why Arkiv

The fair comparison isn't other skill marketplaces, it's Sigstore, which already gives npm and PyPI signed provenance and a transparency log. I'd interoperate with it. Arkiv gives two things Sigstore doesn't:

- **Identity with no account.** `$creator` is the publisher. No GitHub or Google login vouching for you, so an agent can publish.
- **Ratings with no operator.** Third-party judgments are records anyone can query from a browser.

And leases: entity expiration plus `permissionlessExtension` turns a listing into something its maintainer renews, while a community can keep an orphaned skill, or a warning about a malicious one, alive.

## Honest limits

- The static scanner is a floor, not the defence. Its rules are public and deterministic, so an attacker can test against them offline. Calibrated on 269 real skills: 234 clean, 33 warn, 2 malicious. Other raters are the answer, and the protocol lets anyone add one.
- The default trust list is one wallet. Replace it; that's the point.
- It runs on the Arkiv Tiramisu testnet.
- Today you install through the skillreg CLI.

## What's next

1. A `/.well-known/agent-skills/index.json` gateway, so Hermes, Claude Code, Codex and `npx skills` read skillreg with no client changes. This is the one that decides adoption.
2. Trust lists as Arkiv records you subscribe to, like ad-block filter lists.
3. An LLM rater and a sandbox rater, each with a public track record.
4. Intents and evals in the record format.
5. Gasless publishing for humans who will never hold test tokens.
6. Mirrors to git and IPFS by hash.

## Try it

```bash
npx -y github:kon-rad/skillreg search fact-check
npx -y github:kon-rad/skillreg install fact-check
npx -y github:kon-rad/skillreg verify
```

- Web: https://kon-rad.github.io/skillreg/ (and [why it exists](https://kon-rad.github.io/skillreg/about.html))
- Code and data contract (MIT): https://github.com/kon-rad/skillreg
- Your agent can learn it from the [skillreg skill](../skills/skillreg/SKILL.md).

If you run raters, maintain a trust list, or build an agent harness, I'd like to hear from you.
