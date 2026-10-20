# The fact-check gate

Nothing goes to the critics, and nothing renders, until every claim in the episode is verified against a source and the verification is stamped against the exact words. This is the step that most changes a script.

## 1. The research pack: `sources.md`

```markdown
# Sources: <episode title>

## 1. <Source title>
URL: https://...
Primary or secondary: primary (the project's own manual)
Read: 2026-10-20

> The verbatim passage the episode may use.
> Another passage, exactly as written.

## 2. ...

## Inferred
- Arithmetic or reasoning the script states as ours ("Our reasoning, not a benchmark"), with the inputs.

## Not claimed
- Tempting facts we could not source, and why (a testimonial that never says what the claim says; a figure with no independent measurement).
```

Rules: primary sources first (the paper, the filing, the repo at a named branch, the person's own post with its date). Copy passages exactly, typography included; a highlight on screen must match the page character for character. Old notes, earlier videos and summaries are leads: reopen the URL and quote the source itself. A page behind a bot check can be quoted from another faithful copy, named as such.

## 2. Claims extraction

`python3 scripts/episode.py claims <ep>` writes `critique/fact-check-input.md`: for every shot, the narration (`SAY:`) and everything drawn on screen (`ON SCREEN:` kicker, headline, points, slide text, stats as drawn with prefix and suffix, diagram and scene labels, code, and the sentence highlighted on a source page). On-screen text is checked as hard as narration: a diagram's arrows and a code card's lines are claims too.

## 3. The checker

Run a separate, read-only reviewer (a subagent, or a second model with web access) that did not write the script. Give it `fact-check-input.md`, `sources.md` and permission to open every URL. Its brief:

> Check every factual claim in the input against the sources; open them. For each claim return one row: the claim in short, the verdict (verified, incorrect, unresolved), the source with the exact passage or path:line, and the correction or the missing evidence. A claim is verified only if a source supports it as stated: same number, unit, date, scope and certainty. Flag framing the source does not support (a causal "that is why", "every", "never", "whole"), a company claim stated as fact, a paraphrase shown inside quote marks, an ellipsis where nothing was cut, and code that is not the shipped code. Do not edit any file.

It writes `critique/fact-check-round-N.md` in this shape:

```markdown
### Fact-check: critique/fact-check-input.md
Checked: 2026-10-20 · Claims: 65 · verified 65 · incorrect 0 · unresolved 0

| # | Claim (short) | Verdict | Source (path:line or URL) | Correction / missing evidence |
|---|---|---|---|---|
| 1 | s01: "Quattro has almost exclusively been built by agents" | verified | https://... dated "September 3, 2026", exact | |
```

The `Claims: N · verified V · incorrect I · unresolved U` line is what the gate reads.

## 4. Fix, re-check, accept

1. Fix every incorrect and unresolved row in the storyboard, or cut the line. Never argue a row away; change the words to what the source says.
2. Re-run `claims` and have the checker look again at the changed shots (and anything they touch).
3. Repeat until the report is clean. Save the final table as `critique/fact-check.md`.
4. `python3 scripts/episode.py gate <ep> --accept`. It refuses a report with any incorrect or unresolved claim, then writes `critique/fact-check.json` with a hash of every spoken and on-screen word.
5. `python3 scripts/episode.py gate <ep>` exits 3 whenever the text has changed since; the critique and render steps should refuse to run until it exits 0.

Real numbers: the Omarchy episode needed seven rounds (round 1 found 6 incorrect and 5 unresolved claims among 64; the final report verified 65 of 65). The etched-chip episode needed five rounds for 72 claims. Every later round still found something small: an ellipsis, a label, a headline that generalised.

## 5. Editing while something else runs

If a remote machine renders while you keep editing the storyboard or the fact-check, copy back only what the renderer produces (audio, frames, clips, the video, captions, logs), never the authored files (`storyboard.json`, `sources.md`, `script.md`, `critique/`). Mirroring the whole folder back once silently restored a pre-fact-check storyboard and an old report.
