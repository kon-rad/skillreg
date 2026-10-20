# The YouTube package

Every episode ships upload-ready in its folder. `episode.py youtube <ep>` writes `youtube.md` from the storyboard and the real timings; the human uploads it and decides when it goes public.

| File | Rules |
|---|---|
| `episode.mp4` | 1920x1080, H.264, AAC 48 kHz, -14 LUFS |
| `thumbnail.jpg` | 1280x720. 2 to 5 words, one gold emphasis (`*word*`), over a real frame or our own scene, readable at phone size, no clickbait, no shocked faces |
| `youtube.md` | Copy-ready title, description, tags, settings, pinned comment |
| `captions.srt` | The script's words on the voice's timing; upload as the English subtitle track even though captions are burned in |

## Title

Under 70 characters, specific, sentence case, no all caps, no question bait. Name the thing and the angle: "Omarchy explained: the Linux setup built for AI agents".

## Description

1. A two or three sentence summary that states the thesis plainly (not a teaser).
2. Up to three key links (the project, its manual or the paper), above the fold.
3. `Chapters`: the first at `0:00`, at least 3, each at least 10 s apart (YouTube's rules). The tool builds them from the shots that carry `chapter` and refuses chapters under 10 s.
4. `Sources (primary first)`: every source with its full URL.
5. `Visual credits`: every picture we did not make, with its licence.
6. One line on how the video was checked, and an invitation to report errors ("we will pin the correction").
7. One line about the channel.

No em dashes anywhere; the tool refuses to write a package that contains one.

## Settings

Category Science & Technology (id 28), language English, not made for kids, and **altered or synthetic content: yes** when the narration is a synthetic voice.

## Pinned comment

Use it for corrections, including corrections to earlier coverage the research found ("the repository now lives at ...; Steam is installed from the menu rather than preinstalled"). It shows viewers the checking happened.
