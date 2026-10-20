# Rendering with any engine

The skill doesn't ship a renderer; it fixes what the render must produce and how to check it. This is the pipeline Argo Explains runs (Python driving headless Chrome over the DevTools protocol, a local TTS model, ffmpeg); any stack that meets the same contract works.

## Contract

| Output | Spec |
|---|---|
| `audio/timing.json` | `{"total": s, "shots": [{"id", "start", "end", "words": [{"w", "start", "end"}]}]}`, absolute seconds |
| `audio/voice.wav` | The narration, one take per shot, joined with 0.14 s gaps plus each shot's `pause_after` |
| `work/sheet.jpg` | Contact sheet, one frame per shot at 70 percent, labelled id and time (for the critics) |
| `episode.mp4` | 1920x1080, 30 fps, H.264 (CRF 18), AAC 48 kHz 192 kbps, -14 LUFS integrated |
| `captions.ass`, `captions.srt` | From `episode.py captions` |
| `thumbnail.jpg` | 1280x720 from a real frame (`still:<shot id>`) |

## Steps

1. **Voice.** Synthesize each shot's `say` separately (cache by text + voice + speed), applying `voice.pronounce` to the TTS input only. Trim leading and trailing silence at about -45 dB. A local neural voice (Kokoro 82M, voice `af_bella`, speed 0.94) gives about 2.5 words per second.
2. **Timing.** Align each take with faster-whisper (`base.en`, word timestamps, `glossary` as the initial prompt), then map whisper's words back onto the script's own words so captions show the script's spelling. Offset to the episode clock and write `timing.json`.
3. **Assets.** For `web`: load the page in headless Chrome at 1440x900 at DPR 1.5 (desktop) or 432 wide at DPR 2.5 (mobile), dismiss or hide banners (`hide` selectors), find the `highlight` text in the DOM, wrap it in a highlight mark, record its bounding box, screenshot the page. If the text isn't found, log `highlight not found` and fix the storyboard; if a bot check answers, use a verbatim quote card. For `pdf`: rasterise the page (poppler), find the text box. For `diagram`: render to SVG (Mermaid CLI, Graphviz, D2, or a Kroki server) and reveal nodes in `order` on `at_words`.
4. **Frames.** Each shot is an HTML page that draws itself as a pure function of time t (layouts, slides, scenes in three.js, the camera's focus on the highlight box). Seek t frame by frame and screenshot, or record. Cache each shot's clip by a hash of its spec, its timing and the templates, so a one-word fix re-renders one shot.
5. **Captions.** `episode.py captions <ep>` builds karaoke ASS from `timing.json` (3 to 6 words, one line, the spoken word gold with a pop, breaks at punctuation and shot cuts). Burn with ffmpeg's libass, pointing `fontsdir` at the caption font: `-vf "subtitles=captions.ass:fontsdir=fonts"`.
6. **Mix.** Concatenate clips, lay the voice under them, add the 6 s silent end card, then loudness-normalise: `-af loudnorm=I=-14:TP=-1.5:LRA=11`.
7. **Spell gate.** Before the final render, check every caption word and on-screen word against a dictionary plus the storyboard's `spelling`, then ask a model to proofread the full text. Zero findings or no render.

## Watch it before you call it done

- Pull a frame at a dozen points (`ffmpeg -ss T -i episode.mp4 -frames:v 1 f.jpg`) and look at each: highlights on the right sentence, nothing clipped, nothing under the captions, diagrams fully rendered.
- `ffprobe` the duration and resolution; measure loudness with `ffmpeg -af ebur128` (expect about -14 LUFS).
- Check the assets log: no `highlight not found`, no blank captures, no diagram syntax errors. Real failures seen: a Mermaid label starting with `/` broke a diagram silently into an error image; a page capture came back blank under machine load and fixed itself on a re-draft; a capture clipped at the left needed a lower focus zoom.

## Cost and time (measured, M1 Max, 2026-10)

About 1.7 minutes of render per minute of video for the final render; an 8-minute episode is about 14 minutes. Voice and alignment run locally at no API cost. Critique rounds were about USD 0.55 each on a Pro-class model. Generated images, if any, about USD 0.13 each.
