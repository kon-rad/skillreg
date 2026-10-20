# storyboard.json

One file holds the whole episode: what is said, what is on screen, when each thing lands, and the YouTube package. `scripts/episode.py new` writes a blank one. A render engine reads it; the fact-check gate hashes its words. See `examples/storyboard-example.json` for real shots.

```json
{
  "title": "Omarchy: the computer an agent can read",
  "thesis": "the argument in one or two sentences",
  "one_idea": "the sentence the viewer keeps",
  "end_line": "the line on the silent end card",
  "glossary": ["names the speech aligner should know"],
  "spelling": ["correct words the spell checker lacks"],
  "voice": {"pronounce": {"Omarchy": "Oh-mar-key", "systemd": "system D"}},
  "youtube": {
    "title": "under 70 characters",
    "summary": "two or three sentences",
    "tags": ["up to 15"],
    "links": ["Name: https://... (above the chapters)"],
    "pinned_comment": "optional",
    "thumbnail": {"kicker": "Show name", "text": "2 to 5 *words*", "image": "still:s10"}
  },
  "sources": [{"title": "...", "url": "https://...", "note": "primary"}],
  "shots": [
    {"id": "s01", "chapter": "Cold open", "kicker": "small caps", "headline": "max 8 words",
     "points": [{"text": "beside the picture", "at_word": "word"}],
     "say": "the narration for this shot", "pause_after": 0.4, "credit": "small source line",
     "visual": {"kind": "web", "url": "https://...", "highlight": "an exact sentence on the page"}}
  ]
}
```

## Shot fields

| Field | Rule |
|---|---|
| `id` | `s01`, `s02` ... unique |
| `chapter` | On the first shot of each chapter only. Becomes a YouTube timestamp and the chapter tag. `s01` must have one |
| `kicker`, `headline` | Small caps line and a headline of at most 8 words. Both are on-screen claims and get fact-checked |
| `say` | The narration, one sentence or clause. 2.5 to 8 s at 2.5 words per second. Empty `say` plus `seconds` makes a silent card |
| `points` | 2 or 3 beats beside a picture in the split layouts, strings or `{text, sub, at_word}` |
| `pause_after` | Extra silence after the shot; 0.4 to 0.8 at a chapter turn |
| `credit` | Source line under the picture; the YouTube description collects them |
| `at_word` (anywhere) | The first word in this shot's `say` that starts with it fires the reveal |

## Visual kinds

| `kind` | Fields | Notes |
|---|---|---|
| `web` | `url`, `mode` desktop\|mobile, `highlight` (string or list, exact text on the page), `hide` [css selectors], `motion` {type, at_word, zoom} | Capture with headless Chrome at 1440x900 (desktop) or 432 wide (mobile), find the text, draw the highlight, keep the box for the camera |
| `pdf` | `url` or `path`, `page`, `crop` [x0,y0,x1,y1] fractions, `highlight` | `paper` layout; a short highlight zooms in |
| `image` / `video` | `path` or `url`, `credit`, `license` | |
| stock | `query`, `pick` | Credited |
| `generate` | `prompt` | At most 2 per episode |
| `slide` | `style` and its fields (below) | `*word*` marks gold |
| `diagram` | `lang` mermaid\|graphviz\|d2\|plantuml, `source`, `order` [node ids], `at_words` | Nodes appear in `order`, each on its word |
| `three` | `preset` and its fields (below), `counter` {value, prefix, suffix, label, at} | Deterministic scenes |
| `chart` | `option` (an ECharts option), `at_words` | Real numbers only, as sourced |

## Slide styles

| `style` | Fields |
|---|---|
| `title` | `text`, `sub` |
| `chapter` | `number`, `text` (the question), `sub` |
| `statement` | `text`, `size`, `sub` |
| `quote` | `text` (verbatim), `attrib`; lights word by word with the voice |
| `list` | `title`, `items` [{text, at_word}] |
| `chips` | `items` [{text, role, at_word}] in a row |
| `stat` / `stats` | `value`, `prefix`, `suffix`, `label`, `note`; `stats` takes `items` and a `hero` |
| `timeline` | `items` [{year, text, at_word}], horizontal |
| `compare` | `columns` [{title, items}], any number, `hero` |
| `spectrum` | `left`, `right`, `items` [{text, at (0..1)}], `note`, `hero` |
| `equation` | `parts` or `ops`, `gloss` |
| `code` | `code` (the shipped code, exactly), `lang` |

## Scene presets that carried real episodes

| `preset` | Shows | Fields |
|---|---|---|
| `pipeline` | Stages in a row with packets flowing; one link is the bottleneck where packets queue | `stages` [{label, sub, hero}], `narrow` (link index), `narrow_label` |
| `grid` | Weights as cells: `fetch` carries rows from memory to compute one at a time; `etched` fires cells in place | `mode`, `rows`, `cols`, `left_label`, `right_label` |
| `layers` | A stack pulling apart, highlighted layers glowing; layers can drop in on words | `layers` [{label, at_word}], `highlight` [indexes], `gap` |
| `chip` | A packaged chip turning, labelled parts arriving on their words | `parts` [{text, sub}] |
| `tiling` | A tiling window manager: each new window splits the newest (dwindle), panes slide to make room, the newest has the gold border | `windows` [{label, sub, at_word}] |
| `loop` | Stages on a ring, a token travelling round and lighting each: an agent's read, write, run, check loop | `stages` [{label, sub, at_word}], `center_label`, `start` (fraction of the shot), `lap` (s) |
| `network`, `globe`, `particles`, `orbit` | Nodes passing messages; points on a turning sphere; a field resolving into a word; an object turning | `nodes`, `points`, `word`, `parts` |

Build a scene as a function of time t: given t, set every object's state from scratch. That makes any frame renderable on its own, so a renderer can seek, cache and parallelise.

## What `check` enforces

| Code | Rule |
|---|---|
| E | `s01` has no `chapter`; fewer than 3 chapters; a banned phrase; an em dash anywhere; YouTube title over 70 characters; duplicate shot ids; a shot without `visual.kind` |
| W | Four shots of one kind (or slide style) in a row; a sentence over 25 words; a question outside a chapter opener; no `one_idea`; a shot over 12 s or under 1.5 s of estimated speech (8 to 12 s is fine when something builds inside it); a headline over 8 words; total words outside 900 to 1,650 |
