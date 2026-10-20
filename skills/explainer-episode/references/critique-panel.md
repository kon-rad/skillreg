# The critique panel

Five critics review the episode before it renders, each from one angle, each blind to the others. They see what a viewer will see: real frames, real timings. Run them on any capable multimodal model, in parallel, one call per critic.

## When

After the fact-check gate is clean (`episode.py gate <ep>` exits 0). At least two rounds always run. Render when every overall score is 8 or more after round 2, or after round 3 with every note answered. Any narration change that touches a claim sends those shots back through the fact-check first.

## What each critic gets

1. Its brief (below) as the system prompt, plus the constitution.
2. The storyboard as a table: shot id, real start and end time from the synthesized voice, kicker, headline, `say`, visual spec.
3. Length: seconds of narration, words, words per second, shot count; the end card line.
4. `sources.md`, and `critique/fact-check.md` so critics see what was verified.
5. The contact sheet: one real frame per shot, about 70 percent through it, labelled with id and time. Say that captions are burned in later and aren't on the sheet.
6. From round 2: the editor's response to the last round.

## The prompt

> Review this educational long-form YouTube explainer (16:9, 1920x1080, 6 to 10 minutes) before it renders. It is round N of at most 3. [title, thesis, length, shot table, sources, fact-check, last response, constitution]. Score each rubric row 1 to 10, give an overall score, a one-line verdict, and numbered notes ordered by importance. Each note names the shot id, a severity (block = must change before render, major, minor), what is wrong, and a concrete replacement (a new line of narration, a new visual spec, a cut). Do not repeat notes the editor already answered unless the answer is wrong. Be specific and brief. No em dashes. Also list up to 3 questions a viewer would ask.

Ask for JSON: `{"scores": {row: int}, "overall": int, "verdict": str, "notes": [{"shot", "severity", "note", "suggestion"}], "viewer_questions": [str]}`. Collect the five into `critique/round-N.md` (a score table, then every note numbered per critic) and keep a copy of the storyboard each round judged in `history/storyboard-vN.json`.

## Rubric

| Row | 10 means |
|---|---|
| hook | The cold open states the subject and the surprising true fact; I would keep watching |
| clarity | Every term defined, every analogy bounded, a smart 16-year-old follows every sentence |
| depth | Mechanism, numbers, trade-off and open questions; a specialist would sign off |
| accuracy | Every claim is in the sources with its unit, date and who measured it; quotes verbatim; claims labelled as claims |
| structure | Chapters are questions in the order a curious viewer would ask them; the close lands the one idea |
| pacing | A visual change at least every 7 s, cuts on words, no dead air, 6 to 10 minutes |
| visuals | Real artifacts first; mechanisms in motion; every visual explains its sentence; variety |
| captions | Legible, in the caption band, never covering the point |
| brand | House colours and type, restraint, no em dashes, honest tone |

## The five briefs

**Cut (video editor).** You judge the cut and the retention curve. Read the contact sheet as a timeline: where would a viewer leave, at which second and which shot? Demand a visual change at least every seven seconds, a cut on the word, and no run of more than three shots of the same kind. Flag any shot that is text on a background when a real page or a scene in motion could carry it. Name the line to cut when a chapter drags.

**Design (head of design).** You judge every frame as a designed 16:9 screen. One idea per screen, restraint, hierarchy, contrast. Nothing important in the caption band (below y 880) or under the logo (top right). Gold marks only the one thing that matters. Diagrams read left to right with at most twelve nodes and short labels; slides are designed, not typed; scenes look deliberate. Name the one element to remove from each weak frame.

**Truth (head of research).** You judge truth at a PhD standard. Check every claim, number, unit, date, name and quote in the narration and on screen against the sources and the fact-check. A claim not in the sources is a block: name the source that would settle it or ask for the line to be cut. Flag any company claim stated as fact, any measured figure without who measured it, any rounding that changes meaning, and any upgrade of a plan, a simulation or a hope into a result. Your blocks stop the render.

**Clarity (writer and teacher).** You judge clarity at the Feynman standard. Does each chapter start from something the viewer already knows? Is every term defined the first time, in plain words? Does every analogy say where it breaks? Is there one concrete example with real numbers before each general rule? Mark any sentence over 25 words, any abstraction without an example, and any place a smart 16-year-old would get lost, and rewrite it. Check the close lands one idea the viewer could repeat.

**Viewer (community).** You are the viewer in the YouTube comments. Say what a curious developer would ask after watching, what they would quote, what they would argue with, and what would make them share it. Flag hype, clickbait, jargon never defined, and a close that ends on a slogan instead of a fact. Draft the title (under 70 characters) and the first two lines of the description.

## Answering the notes

The editor (the agent running the skill) answers every note in `critique/round-N-response.md`, one line each:

```
- cut #1: accept - the two homepage shots are now one, with two highlights and a focus move.
- design #3: reject - "built-in clock plugin, trimmed" is a fact-check requirement (round 1, row 40); the viewer must be told both.
- truth #2: accept with the source's own words - "It has no GPU acceleration, so it is not meant for gaming."
- viewer #1: reject - "or the agent that generated it" adds a claim no source makes.
```

A rejection needs a reason grounded in the constitution or the fact-check: a critic's better-sounding line that adds an unsourced claim is rejected, every time. Accepting the point but not the wording is allowed, and often right.

Real numbers: on the Omarchy episode round 1 sent it back (overall 7, 8, 9, 9, 9), round 2 passed (8, 8, 10, 9, 9); the two rounds cost USD 1.08 on a Pro-class model.
