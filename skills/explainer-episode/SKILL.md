---
name: explainer-episode
description: "Make a 6 to 10 minute educational TV episode (a 16:9 YouTube explainer) that is researched from primary sources, fact-checked claim by claim before anything renders, critiqued in two to three rounds by a five-critic panel, and shipped with an upload-ready YouTube package (title, description, chapters, tags, thumbnail brief, SRT). Visual style: the real page with the sentence highlighted, systems in motion (three.js scenes), diagrams that build on the words, designed slides, burned-in karaoke captions. Use when the user asks for an explainer video, an educational episode, a YouTube explainer about X, or to turn a paper, product or idea into a long-form video."
license: MIT
compatibility: "The method and the scripts need Python 3.10+ and nothing else. Rendering needs a TTS voice, a word aligner (faster-whisper), headless Chrome for page captures and scenes, and ffmpeg with libass. Critique needs any capable model."
metadata:
  version: "1.0.1"
  keywords: "video, explainer, youtube, education, fact-check"
  origin: "Argo Explains, the public explainer show of Argo (myargoquest.com). Proven on 'How an AI model gets etched into a chip' and 'Omarchy: the computer an agent can read' (2026-10)."
---

# explainer-episode: educational TV episodes that are true, clear and shown

An episode is a cold open plus four to seven chapters, each answering one question a smart viewer would ask next. Every sentence is a shot. Every claim traces to a source. Nothing renders until a fact-check with zero open findings is stamped against the exact words, and nothing ships until a critic panel has scored real frames at least twice.

**Read `references/constitution.md` in full before writing a word.** It is the binding standard (truth, clarity, depth, honesty about uncertainty, respect, show don't decorate, credit) and the house style. The other references are the procedures:

| File | Read it for |
|---|---|
| `references/constitution.md` | The constitution, voice, structure, visual order, layout, motion, captions, sound |
| `references/storyboard.md` | The `storyboard.json` schema: shots, visual kinds, slide styles, scene presets, cues |
| `references/fact-check.md` | The gate: research pack format, claims extraction, the verdict table, what "clean" means |
| `references/critique-panel.md` | The five critics, the rubric, the prompt, how to answer notes, when to stop |
| `references/render.md` | How to render with any engine: voice, timing, captures, captions, loudness, checks |
| `references/youtube.md` | The upload package and its rules |
| `examples/storyboard-example.json` | Real shots from a finished episode, one of each kind |

## The tool

`scripts/episode.py` is standard-library Python. It does the bookkeeping that keeps the gates honest; your render engine does the pictures.

```
E=scripts/episode.py
python3 $E new <slug> --title "..." [--root episodes]   # folder with storyboard.json, script.md, sources.md
python3 $E check <ep>                                   # lint: chapters, kind runs, banned phrases, sentence length, em dashes
python3 $E claims <ep>                                  # critique/fact-check-input.md: every spoken and on-screen claim, by shot
python3 $E gate <ep> --accept                           # stamp a clean critique/fact-check.md against the current text
python3 $E gate <ep>                                    # is the stamp still valid? exit 0 yes, 3 no
python3 $E captions <ep>                                # captions.ass (karaoke) + captions.srt from audio/timing.json
python3 $E youtube <ep>                                 # youtube.md from storyboard.json + audio/timing.json
```

`audio/timing.json` is what your voice and alignment step writes: `{"total": s, "shots": [{"id", "start", "end", "words": [{"w", "start", "end"}]}]}`, absolute seconds on the episode clock.

## The loop

1. **Research to a PhD standard.** Read the primary sources (the paper, the company page, the filing, the repo, the person's own words) and the best independent reporting. Write `sources.md`: one section per source with URL, primary or secondary, and the **verbatim passages** the episode may use; then "Inferred" (arithmetic and reasoning the script will label as ours); then "Not claimed" (tempting facts you could not source). Old notes and earlier videos are leads, never sources: reopen the URLs. Expect to find errors in earlier coverage.
2. **Script.** Cold open (the subject, why it matters, the surprising true fact), a short title card, four to seven chapters titled as questions, a close that lands `one_idea`. Write for the ear at the Feynman standard: familiar before new, one worked example with real numbers before the rule, every term defined in a clause, every analogy followed by where it breaks. About 1,000 to 1,500 words at 2.5 words per second.
3. **Storyboard.** `storyboard.json`, one shot per sentence or clause (2.5 to 8 s). Pick each visual in this order: the real page or PDF with the sentence highlighted; then a scene in motion or a diagram that builds for a mechanism; then a designed slide. No four shots of the same kind in a row. The first shot of each chapter carries `chapter` (it becomes a YouTube timestamp). Reveals land on the word that names them (`at_word`).
4. **Check and draft.** `check` until there are no `E` lines. Draft the voice, the timings and one still per shot, and make a contact sheet. Look at every still yourself before any critic: missed highlights, cookie banners, bot-check pages, clipped crops, empty frames. A page behind a bot wall becomes a verbatim quote card with the source in the credit.
5. **Fact-check (the gate).** `claims`, then give `critique/fact-check-input.md`, `sources.md` and the URLs to a separate, read-only fact-checker (a subagent or a second model with web access). It returns one row per claim: verified, incorrect or unresolved, with the source. Fix every incorrect and unresolved row in the script (or cut the line), re-check the changed shots, save the clean table as `critique/fact-check.md`, then `gate --accept`. The gate refuses any report with an open row and stamps a hash of every spoken and on-screen word: any later edit to a claim reopens it. The Omarchy episode needed 7 rounds; that is normal.
6. **Critique, two to three rounds.** Send the storyboard, real timings, `sources.md`, the fact-check and the contact sheet to the five critics (cut, design, truth, clarity, viewer). Answer **every** note in `critique/round-N-response.md` as `critic #n: accept|reject - reason`; a rejection needs a reason the constitution supports. Revise, redraft, re-run the fact-check on changed claims, then the next round. Round 2 always runs. Stop when every overall score is 8 or more after round 2, or after round 3 with every note answered.
7. **Render.** Spell-check every caption and on-screen word, render, then watch it: pull frames at a dozen points and look at them; confirm duration, resolution and -14 LUFS. See `references/render.md`.
8. **Package.** Fill `youtube` in the storyboard, run `captions` and `youtube`, make the thumbnail from a real frame. Upload by hand from `youtube.md`; the human decides when it goes public.
9. **Improve the standard.** Anything this episode taught that should change the next one goes into your copy of the constitution, with a dated line in its iteration log.

## Rules that are never traded away

- No claim without a source in `sources.md`. A company's figure is called the company's figure; a plan stays a plan.
- Quotes are verbatim. Don't add an ellipsis where nothing was cut; don't tidy a speaker's punctuation beyond a dash for a dash.
- Code shown on screen is the shipped code, exactly, including lines that ship commented out.
- No hype, no rhetorical questions, no call to action, no em dashes.
- The fact-check stamp must match the text that renders. If the text changed, the gate is closed.
- If the episode depends on another machine or service that is down, stop and say so; don't silently substitute.

## Nothing to show

If the topic has no primary sources you can read, say so and propose a narrower episode the sources do support.
