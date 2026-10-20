# Explainer constitution and style

The one file that decides how an episode is researched, written, checked, drawn and packaged. Agents read all of it before writing a word; the critic panel reads it too. **Copy it into your project and edit it to change the next episode**, logging each change in §12. The defaults below are the ones Argo Explains uses (ink and gold, Newsreader and Manrope); swap the palette and fonts for your own brand, keep the rules.

## TL;DR: the five rules that matter

1. **True before anything else.** Every claim on screen or in the narration traces to a source in `sources.md`; a company's claim is called a claim; every number carries its unit, its date and who measured it. A fact-check with zero open findings gates the render. This is the rule most likely to change a script.
2. **Clarity is the product.** Explain it the way Feynman would at a blackboard: start from what the viewer already knows, one idea per sentence, a concrete example before the abstraction, every term defined the first time, every analogy followed by where it breaks.
3. **Show the thing, then the system in motion.** The real page, paper or repo with the sentence highlighted comes first; scenes in motion, diagrams that build and designed slides explain the mechanism. Nothing sits still and no visual is decoration.
4. **Chapters are questions.** A cold open plus four to seven chapters, each answering the question a smart viewer would ask next. They become the YouTube timestamps.
5. **Two to three critique passes, every note answered.** Five critics score real frames; the editor answers every note and revises until all pass or three rounds are done.

## 1. The constitution

Binding. A critic may block an episode for breaking any of these, and the editor may reject any note that would break one.

| # | Principle | In practice |
|---|---|---|
| 1 | **Truth** | Only claims we can source. Primary sources first (the paper, the company's page, the filing, the repo, the person's own words). A secondary source is named as one. Measured, claimed and inferred are three different words and the script uses the right one. Unverified means not in the episode; it goes in `sources.md` under "Not claimed" |
| 2 | **Clarity** | A motivated 16-year-old can follow every sentence, and a professor in the field would not wince at any. Familiar to new. Name the mechanism, not the vibe. One idea per sentence, one idea per screen |
| 3 | **Depth** | University level, not news level: the mechanism, the numbers that matter, the trade-off, the history that explains the design, and what is still unknown. The viewer can explain it to a friend afterwards |
| 4 | **Honesty about uncertainty** | Say what is not known or not independently checked. A plan stays a plan, a simulation stays a simulation, a company figure stays the company's figure |
| 5 | **Respect for the viewer** | No hype, clickbait, filler, rhetorical questions or "smash that like button". No call to action in the narration. The viewer's time is the budget |
| 6 | **Show, don't decorate** | Every visual explains the sentence it sits under. A stock photo never stands in for a real artifact or a diagram |
| 7 | **Credit** | Every picture we did not make is credited in the description; quotes are verbatim and attributed |

The clarity standard, concretely. The best explainers (Feynman on physics, Vitalik Buterin on Ethereum's design, Jobs on a product) share four habits:

- **Anchor in the familiar.** Start from something the viewer has touched ("ask a chatbot a question and watch the words appear").
- **Concrete before abstract.** One worked example with real numbers before the general rule.
- **The analogy and its limit.** Every analogy is followed by the sentence that says where it stops being true.
- **The one idea to keep.** The episode ends on one sentence the viewer could repeat.

### Mistakes the fact-checker caught in real episodes

Keep these in mind while writing; each one got past a draft or a revision before the checker caught it.

| Draft said | Why it was wrong | Fix |
|---|---|---|
| "Windows don't overlap" (a tiling window manager) | It also has floating windows | "By default, tiled windows don't overlap" |
| A config card showing a keybinding line | The line ships commented out | Show the shipped line, comment and all |
| "Every setting has a command" | The source says the CLI reaches the menus' tools, not every setting | Say what the source says |
| A quote card with "..." | Nothing was cut; the ellipsis implied an edit | The exact words, the source's dash as a dash |
| "That is why the release was built by agents" | A causal claim no source makes | Two sentences, no "that is why" |
| A component labelled a plugin | The plugin was a different component | The source's own name |
| Co-founder | The person's own bio says co-owner and CTO | The bio's words |

## 2. Audience, voice and script

The viewer is curious and technical: a developer, a founder, a student. They found the video through a thumbnail or a search and owe us nothing. Smart, not a specialist in this topic.

- **Open with the subject.** The first sentence states the thing and why it matters. No greeting, no channel name, no "today we're looking at".
- **Short declaratives for the ear.** Average sentence under 18 words; none over 25. Numbers with units, dates and who measured them.
- **Define every term** the first time, in a clause ("the weights, the billions of numbers a model learns in training").
- **Quotes are verbatim** and named ("Bajic told EE Times: ...").
- **No em dashes** anywhere: narration, captions, slides, headlines, YouTube text. Use commas, colons and periods.
- **Banned:** "did you know", "in today's world", "let's dive in", "you won't believe", "game-changer", "revolutionary", "mind-blowing", rhetorical questions, any sign-off.
- **Spell for the voice** with a pronunciation table (`voice.pronounce`), never by misspelling the script; captions show the script's spelling.
- A neural TTS voice at speed 0.94 reads about **2.5 words per second** (measured). 6 to 10 minutes is 900 to 1,500 words; the first real episode ran 11.6 minutes at 1,729 words.

## 3. Structure

| Part | Time | Job |
|---|---|---|
| Cold open | 0 to 30 s | The subject, why it matters, the most surprising true fact, on screen as a real artifact. A viewer who leaves at 0:30 has still learned the thesis |
| Title card | 3 to 5 s | Show name and episode title. Silent or one short sentence |
| Chapters | 4 to 7, 50 to 120 s each | Each answers one question, stated as its card or first line. Each answer raises the next question |
| The turn | last third | Consequences: where it matters, what it costs, what it gives up, how it compares |
| Close | final 15 to 30 s | The one idea to keep, a callback to the cold open, then a silent end card. No "subscribe" |

Shots run 2.5 to 8 s. The picture changes at least every 7 s, by a cut or a build inside the shot (a list item, a diagram node, a highlight sweep, a camera move).

## 4. Visual sourcing order

Pick the first kind that serves the sentence being spoken.

| Priority | Kind | Use for |
|---|---|---|
| 1 | `web` (desktop page in a browser window, mobile page in a phone, the sentence highlighted) | The page being discussed: the announcement, product page, the article that measured it, Wikipedia, the docs |
| 1 | `pdf` (page, crop, highlight) | Papers, whitepapers, filings, datasheets |
| 2 | `image` | Your own screenshots and photos |
| 3 | `three` | A system in motion: data through a pipeline hitting a bottleneck, layers pulling apart, windows tiling, a token going round a loop |
| 3 | `diagram` (Mermaid, Graphviz, D2, PlantUML) | A flow, lineage, sequence or architecture, built node by node on the words |
| 3 | `slide` | A designed screen: statement, quote, stats, timeline, compare, spectrum, equation, code, chips, chapter, title |
| 3 | `chart` | Real numbers compared or over time, exactly as sourced, source in the credit |
| 4 | stock photo or video | An establishing shot when no real artifact exists. Credited |
| 5 | generated image | A concept nothing else can show. At most 2 per episode, behind a cost gate |

A story about a company shows its own page; a measurement shows the article that measured it with the number highlighted; a mechanism is a scene or a building diagram, never a paragraph on a slide. No more than three shots of the same kind in a row.

## 5. Layout and safe zones (1920x1080)

```
 y=0     +-----------------------------------------------------------+
         | kicker / HEADLINE (y 54-190)            chapter tag  [logo]|
 y=200   |- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - |
         |              media band (y 200-880)                        |
         |   card / browser / paper / diagram / chart / slide         |
 y=880   |- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - |
         |            CAPTIONS, one line, centred at y=968            |
 y=1080  +-----------------------------------------------------------+
            x 96 .................................................. x 1824
```

| Layout | When |
|---|---|
| `browser` | A desktop page in a window across the band, headline above |
| `split-browser` | A desktop page plus 2 or 3 `points` that land on their words, left |
| `page` / `phone` | A mobile page in a phone on the right, headline and points left |
| `card` | Landscape images, diagrams as images |
| `paper` | PDFs; focus zooms to the highlight |
| `full` | Photos and video, full bleed with scrims |

Nothing important in the caption band or under the logo.

## 6. Typography and colour (defaults)

| Role | Value |
|---|---|
| Ground | ink `#16130E`, raised `#221D15`, a faint gold grid behind slides and scenes |
| The one thing that matters, the active caption word | gold `#F2CB4C` |
| Kickers, rules | antique gold `#B98A1E` |
| Body, inactive captions | paper `#F4F0E9` |
| Accents, one per category | `#4A7FD4`, `#9B72CF`, `#E8748A` (bottlenecks, warnings), `#7DBF72` |
| Headline | Newsreader SemiBold 54 to 66 px, max 8 words |
| Kicker | Manrope Bold 22 px, uppercase, letter-spaced |
| Slide body | Manrope Bold 30 to 48 px; statements Newsreader 92 px |

One idea per screen. Gold marks the one thing that matters on that screen, nothing else.

## 7. Motion

Every shot moves: `focus` (zoom to the highlighted sentence, default on real pages), `scroll` (at most 600 px/s), `kenburns` (photos), `pan` (wide images), `hold` (slides and diagrams that build themselves, with a 2 to 3 percent drift). Reveals land on the word that names them. Ease in and out. The transition is a straight cut on the word: no spins, wipes or sound effects. Scenes are deterministic: frame t always looks the same, so renders can be cached and resumed.

## 8. Diagrams and scenes

Diagrams: left to right reads best in 16:9 (`graph LR`, `rankdir=LR`). At most 12 nodes, labels under 5 words, reveal order follows the narration. In Mermaid, quote any label that starts with `/` (`D["/usr/share/app"]`; unquoted it is parallelogram syntax and fails), and use `<br/>` inside a quoted label for a line break, never `\n`.

Scenes: one subject, slow camera, palette colours, labels in the house fonts. A scene explains a system; if it would only decorate, use a real artifact. The presets that carried real episodes are listed in `storyboard.md`.

## 9. Captions

| Setting | Value |
|---|---|
| Style | Karaoke: the spoken word turns gold with a short pop (110 ms, 110 percent) |
| Font | Manrope ExtraBold 58 px |
| Words on screen | 3 to 6, one line, max 40 characters |
| Position | centred at y = 968, below the media band |
| Outline | ink 5 px, soft 2 px shadow |
| Breaks | at sentence ends, commas and every shot cut |

Spell-check every caption and on-screen word before burning it (a dictionary pass plus a model proofread). A correct word the checker doesn't know goes in the storyboard's `spelling`. The same words ship as `captions.srt`.

## 10. Branding and end card

A small logo top right at 90 percent opacity on every shot except the end card; the current chapter in small caps beside it. End card: 6 s, silent, the logo, the one idea to keep, your site. No progress bar on long-form (YouTube draws its own and the chapters mark it).

## 11. Sound

One narrator voice for the whole show, and say in the upload that it is synthetic. 0.14 s between shots; 0.4 to 0.8 s pause at a chapter turn. Loudness -14 LUFS integrated. Music off by default.

## 12. Iteration log

One line per change: what changed, why, the episode that prompted it. Newest first.

| Date | Change | Why | Episode |
|---|---|---|---|
| 2026-10-20 | Scene presets `tiling` and `loop`; a "mistakes caught" table in §1 | An OS episode needed a window manager and an agent's work loop shown in motion; seven fact-check rounds found the patterns above | Omarchy: the computer an agent can read |
| 2026-10-19 | Speaking rate 2.5 words/s (was 2.75); 900 to 1,500 words; a page behind a bot check becomes a verbatim quote card; chart bars take `at_words` | The first episode measured 2.50 words/s and ran 11.6 min; a critic flagged a 14 s static chart | How an AI model gets etched into a chip |
| 2026-10-19 | First version | Moving a news-desk explainer show to a visual, sourced, critiqued format | |
