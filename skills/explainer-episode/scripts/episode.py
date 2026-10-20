#!/usr/bin/env python3
"""explainer-episode bookkeeping: scaffold, lint, the fact-check gate, captions and the YouTube package.

Standard library only. Rendering is your engine's job; this keeps the gates honest.

    episode.py new <slug> --title "..." [--root episodes]
    episode.py check <ep>
    episode.py claims <ep>             -> critique/fact-check-input.md
    episode.py gate <ep> [--accept]    -> critique/fact-check.json (exit 3 when closed)
    episode.py captions <ep>           -> captions.ass + captions.srt from audio/timing.json
    episode.py youtube <ep>            -> youtube.md from storyboard.json + audio/timing.json

Exit codes: 0 ok, 1 usage or errors found, 3 gate closed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

EM_DASH = "\u2014"
BANNED = ["did you know", "in today's world", "let's dive in", "you won't believe", "game-changer", "game changer",
          "revolutionary", "mind-blowing", "smash that like"]
WPS = 2.5                       # measured words per second of the narrator (constitution §2)
TITLE_MAX, TAGS_MAX, CHAPTER_MIN = 70, 15, 10
CAP = {"max_words": 6, "max_chars": 40, "center_y": 968, "size": 58, "font": "Manrope ExtraBold",
       "paper": "#F4F0E9", "gold": "#F2CB4C", "ink": "#16130E", "outline": 5, "shadow": 2,
       "pop": 110, "pop_ms": 110, "lead": 0.04, "linger": 0.3, "width": 1920, "height": 1080}


def words_of(text: str) -> list[str]:
    return re.findall(r"[\w'’.,%-]+", text or "")


def load(ep: Path) -> dict:
    f = ep / "storyboard.json"
    if not f.exists():
        sys.exit(f"no {f}")
    return json.loads(f.read_text())


def text_hash(sb: dict) -> str:
    """What the fact-check vouches for: every spoken word and every word drawn on screen."""
    keys = ("text", "items", "columns", "value", "prefix", "suffix", "label", "note", "sub", "attrib", "code",
            "parts", "stages", "layers", "windows", "counter", "option", "highlight", "source", "center_label")
    parts = [[s.get("say", ""), s.get("headline"), s.get("kicker"), s.get("points"), s.get("credit"),
              {k: s.get("visual", {}).get(k) for k in keys}] for s in sb.get("shots", [])]
    parts.append(sb.get("end_line"))
    return hashlib.sha256(json.dumps(parts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


# ---------- new, check ----------

def cmd_new(a) -> int:
    slug = re.sub(r"[^a-z0-9-]+", "-", a.slug.lower()).strip("-")
    ep = Path(a.root) / f"{date.today().isoformat()}_{slug}"
    if ep.exists():
        sys.exit(f"{ep} exists")
    (ep / "critique").mkdir(parents=True)
    title = a.title or slug.replace("-", " ").title()
    sb = {"title": title, "thesis": "", "one_idea": "", "end_line": "", "glossary": [], "spelling": [],
          "voice": {"pronounce": {}},
          "youtube": {"title": "", "summary": "", "tags": [], "thumbnail": {"kicker": "", "text": "", "image": ""}},
          "sources": [{"title": "", "url": "", "note": "primary"}],
          "shots": [{"id": "s01", "chapter": "Cold open", "headline": "", "say": "",
                     "visual": {"kind": "web", "url": "", "highlight": ""}}]}
    (ep / "storyboard.json").write_text(json.dumps(sb, indent=2) + "\n")
    (ep / "script.md").write_text(f"# {title}\n\n**Thesis:**\n**One idea to keep:**\n\n## Chapters (as questions)\n\n1. Cold open\n\n## Narration\n")
    (ep / "sources.md").write_text(f"# Sources: {title}\n\n## 1. \nURL: \nPrimary or secondary: \nRead: {date.today()}\n\n> \n\n## Inferred\n\n- \n\n## Not claimed\n\n- \n")
    print(ep)
    return 0


def lint(sb: dict) -> list[str]:
    out, shots = [], sb.get("shots", [])
    if not shots or not shots[0].get("chapter"):
        out.append("E s01 has no `chapter`: YouTube needs the first chapter at 0:00")
    n_ch = sum(1 for s in shots if s.get("chapter"))
    if n_ch < 3:
        out.append(f"E {n_ch} chapters; YouTube needs at least 3 (the constitution wants 4 to 7 plus the cold open)")
    ids = [s.get("id") for s in shots]
    for d in sorted({i for i in ids if ids.count(i) > 1}):
        out.append(f"E duplicate shot id {d}")
    run, last, total = 0, None, 0
    for s in shots:
        v = s.get("visual") or {}
        if not v.get("kind"):
            out.append(f"E {s.get('id')}: no visual.kind")
            continue
        key = v["kind"] + (":" + v.get("style", "") if v["kind"] == "slide" else "")
        run = run + 1 if key == last else 1
        last = key
        if run == 4:
            out.append(f"W {s['id']}: four `{key}` shots in a row (mix the kinds)")
        say = s.get("say", "")
        n = len(words_of(say))
        total += n
        if say and (n / WPS > 12.0 or n / WPS < 1.5):   # over 8 s is fine only with a build inside the shot
            out.append(f"W {s['id']}: about {n / WPS:.1f} s of speech; split it, or build inside it every 7 s")
        for b in BANNED:
            if b in say.lower():
                out.append(f"E {s['id']}: banned phrase {b!r}")
        for sent in re.split(r"(?<=[.!?])\s+", say):
            if len(words_of(sent)) > 25:
                out.append(f"W {s['id']}: a {len(words_of(sent))}-word sentence (keep under 25)")
        if "?" in say and not s.get("chapter"):
            out.append(f"W {s['id']}: a question outside a chapter opener (no rhetorical questions)")
        if len(words_of(s.get("headline", ""))) > 8:
            out.append(f"W {s['id']}: headline over 8 words")
    if total and not 900 <= total <= 1650:
        out.append(f"W {total} words of narration, about {total / WPS / 60:.1f} min (aim for 900 to 1,500)")
    if len((sb.get("youtube") or {}).get("title", "")) > TITLE_MAX:
        out.append(f"E youtube.title over {TITLE_MAX} characters")
    if EM_DASH in json.dumps(sb, ensure_ascii=False):
        out.append("E an em dash somewhere in storyboard.json")
    if not sb.get("one_idea"):
        out.append("W no `one_idea`: the close should land one sentence the viewer could repeat")
    return out


def cmd_check(ep: Path) -> int:
    probs = lint(load(ep))
    print("\n".join(probs) or "clean")
    return 1 if any(p.startswith("E") for p in probs) else 0


# ---------- the fact-check gate ----------

def cmd_claims(ep: Path) -> int:
    sb = load(ep)
    lines = [f"# Claims to check: {sb['title']}", "",
             f"Sources: `{ep / 'sources.md'}` and the URLs it lists. Check every factual claim below against them",
             "(open them) and return one row per claim: verified, incorrect or unresolved, with the source.", ""]
    for s in sb["shots"]:
        v = s.get("visual", {})
        screen = [x for x in (s.get("kicker"), s.get("headline")) if x]
        screen += [p if isinstance(p, str) else p.get("text", "") for p in s.get("points") or []]
        if v.get("value") is not None:
            screen.append(f"stat: {v.get('prefix', '')}{v['value']}{v.get('suffix', '')}")
        for k in ("text", "label", "note", "sub", "attrib", "code", "center_label"):
            if v.get(k):
                screen.append(f"{k}: {v[k]}")
        for k in ("items", "columns", "parts", "stages", "layers", "windows", "counter"):
            if v.get(k):
                screen.append(f"{k}: {json.dumps(v[k], ensure_ascii=False)}")
        if v.get("source"):
            screen.append(f"diagram: {v['source']}")
        if v.get("highlight"):
            screen.append(f"highlighted on {v.get('url', 'the source')}: {v['highlight']}")
        if s.get("credit"):
            screen.append(f"credit: {s['credit']}")
        lines.append(f"## {s['id']}" + (f" (chapter: {s['chapter']})" if s.get("chapter") else ""))
        if s.get("say"):
            lines.append(f"SAY: {s['say']}")
        if screen:
            lines.append("ON SCREEN: " + " | ".join(screen))
        lines.append("")
    if sb.get("end_line"):
        lines += ["## end card", f"ON SCREEN: {sb['end_line']}", ""]
    out = ep / "critique" / "fact-check-input.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(lines))
    print(out)
    return 0


def cmd_gate(ep: Path, accept: bool) -> int:
    sb, report, stamp = load(ep), ep / "critique" / "fact-check.md", ep / "critique" / "fact-check.json"
    if accept:
        if not report.exists():
            sys.exit(f"no {report}")
        m = re.search(r"Claims:\s*(\d+).*?verified\s*(\d+).*?incorrect\s*(\d+).*?unresolved\s*(\d+)", report.read_text(), re.S | re.I)
        if not m:
            sys.exit("could not read the 'Claims: N · verified V · incorrect I · unresolved U' line")
        n, v, i, u = map(int, m.groups())
        if i or u or v != n:
            print(f"refused: {i} incorrect, {u} unresolved, {v} of {n} verified; fix the script or cut the lines, re-check, then accept")
            return 3
        stamp.write_text(json.dumps({"claims": n, "text": text_hash(sb),
                                     "accepted": datetime.now().astimezone().isoformat(timespec="minutes")}, indent=2))
        print(f"accepted: {n} claims, all verified")
        return 0
    if not stamp.exists():
        print("closed: no accepted fact-check (run claims, have the checker write critique/fact-check.md, then gate --accept)")
        return 3
    st = json.loads(stamp.read_text())
    if st.get("text") != text_hash(sb):
        print("closed: the narration or on-screen text changed since the fact-check; re-check the changed shots and accept again")
        return 3
    print(f"open: {st['claims']} claims verified, accepted {st['accepted']}")
    return 0


# ---------- captions ----------

def groups_of(timing: dict, max_words: int, max_chars: int) -> list[list[dict]]:
    """Caption groups: break at punctuation, the word and character budget, long pauses and every shot cut."""
    out: list[list[dict]] = []
    for shot in timing["shots"]:
        cur: list[dict] = []
        for w in shot.get("words", []):
            if cur and (len(cur) >= max_words or sum(len(x["w"]) + 1 for x in cur) + len(w["w"]) > max_chars
                        or w["start"] - cur[-1]["end"] > 0.6):
                out.append(cur)
                cur = []
            cur.append(w)
            if w["w"][-1:] in ".!?;:,":
                out.append(cur)
                cur = []
        if cur:
            out.append(cur)
    return out


def _ass_col(hex_rgb: str, alpha: int = 0) -> str:
    h = hex_rgb.lstrip("#")
    return f"&H{alpha:02X}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def _ass_ts(t: float) -> str:
    cs = int(round(max(0.0, t) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _srt_ts(t: float) -> str:
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def cmd_captions(ep: Path) -> int:
    timing = json.loads((ep / "audio" / "timing.json").read_text())
    c = CAP
    paper, gold, ink = _ass_col(c["paper"]), _ass_col(c["gold"]), _ass_col(c["ink"])
    head = (f"[Script Info]\nScriptType: v4.00+\nPlayResX: {c['width']}\nPlayResY: {c['height']}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"Style: Cap,{c['font']},{c['size']},{paper},{gold},{ink},{_ass_col(c['ink'], 0x60)},0,0,0,0,100,100,0,0,1,{c['outline']},{c['shadow']},5,0,0,0,1\n\n"
            "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    groups = groups_of(timing, c["max_words"], c["max_chars"])
    cuts = sorted(s["end"] for s in timing["shots"])
    events = []
    for gi, g in enumerate(groups):
        nxt = groups[gi + 1][0]["start"] - c["lead"] if gi + 1 < len(groups) else timing["total"]
        end = nxt if nxt - g[-1]["end"] < 0.6 else min(g[-1]["end"] + c["linger"], nxt)
        cut = next((x for x in cuts if x > g[0]["start"] + 0.01), None)
        end = min(end, cut) if cut is not None else end
        texts = [w["w"].replace("{", "(").replace("}", ")").replace("*", "") for w in g]
        for wi, w in enumerate(g):
            s = (g[0]["start"] if wi == 0 else w["start"]) - c["lead"]
            e = g[wi + 1]["start"] - c["lead"] if wi + 1 < len(g) else end
            if e - s < 0.02:
                continue
            line = " ".join(f"{{\\1c{gold}\\fscx{c['pop']}\\fscy{c['pop']}\\t(0,{c['pop_ms']},\\fscx100\\fscy100)}}{t}{{\\1c{paper}}}"
                            if k == wi else t for k, t in enumerate(texts))
            events.append(f"Dialogue: 0,{_ass_ts(s)},{_ass_ts(e)},Cap,,0,0,0,,{{\\an5\\pos({c['width'] // 2},{c['center_y']})}}{line}")
    (ep / "captions.ass").write_text(head + "\n".join(events) + "\n")
    srt, sg = [], groups_of(timing, 12, 84)          # the subtitle track: up to two lines per cue
    for i, g in enumerate(sg, 1):
        end = min(g[-1]["end"] + 0.3, sg[i][0]["start"] if i < len(sg) else g[-1]["end"] + 0.3)
        srt += [str(i), f"{_srt_ts(g[0]['start'])} --> {_srt_ts(end)}", " ".join(w["w"] for w in g).replace("*", ""), ""]
    (ep / "captions.srt").write_text("\n".join(srt))
    print(f"{ep / 'captions.ass'} ({len(groups)} groups)\n{ep / 'captions.srt'} ({len(sg)} cues)")
    return 0


# ---------- the YouTube package ----------

def _hms(t: float) -> str:
    h, r = divmod(int(t), 3600)
    m, s = divmod(r, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def cmd_youtube(ep: Path) -> int:
    sb = load(ep)
    timing = json.loads((ep / "audio" / "timing.json").read_text())
    tmap = {s["id"]: s for s in timing["shots"]}
    chs = [(0.0 if i == 0 else tmap[s["id"]]["start"], s["chapter"]) for i, s in enumerate(sb["shots"]) if s.get("chapter")]
    if len(chs) < 3:
        sys.exit("YouTube needs at least 3 chapters")
    ends = [t for t, _ in chs[1:]] + [timing["total"]]
    short = [name for (t, name), e in zip(chs, ends) if e - t < CHAPTER_MIN]
    if short:
        sys.exit(f"chapters shorter than {CHAPTER_MIN} s: {short}")
    yt = sb.get("youtube") or {}
    prim = [s for s in sb.get("sources", []) if "primary" in s.get("note", "")]
    sec = [s for s in sb.get("sources", []) if s not in prim]
    credits = sorted({s["credit"] for s in sb["shots"] if s.get("credit")})
    desc = [yt.get("summary") or sb.get("thesis", ""), ""]
    if yt.get("links"):
        desc += [*yt["links"], ""]
    desc += ["Chapters", *[f"{_hms(t)} {n}" for t, n in chs], "", "Sources (primary first)",
             *[f"- {s['title']}: {s['url']}" for s in prim + sec]]
    if credits:
        desc += ["", "On-screen credits", *[f"- {c}" for c in credits]]
    desc += ["", "Every claim in this video was checked against the sources above before it was published. "
                 "If you find a mistake, tell us in the comments and we will pin the correction."]
    body = [f"# YouTube upload: {sb['title']}", "",
            f"Video: episode.mp4 · Thumbnail: thumbnail.jpg (1280x720) · Subtitles: captions.srt (English)",
            "Settings: Science & Technology (28), English, not made for kids, altered or synthetic content: yes if the voice is synthetic",
            "", "### Title", "", yt.get("title") or sb["title"], "", "### Description", "", *desc, "",
            "### Tags", "", ", ".join((yt.get("tags") or [])[:TAGS_MAX]), ""]
    if yt.get("pinned_comment"):
        body += ["### Pinned comment", "", yt["pinned_comment"], ""]
    text = "\n".join(body)
    if EM_DASH in text:
        sys.exit("an em dash in the YouTube text; fix the storyboard")
    if len(yt.get("title") or sb["title"]) > TITLE_MAX:
        sys.exit(f"title over {TITLE_MAX} characters")
    (ep / "youtube.md").write_text(text)
    print(ep / "youtube.md")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("new")
    p.add_argument("slug")
    p.add_argument("--title")
    p.add_argument("--root", default="episodes")
    for name in ("check", "claims", "gate", "captions", "youtube"):
        p = sub.add_parser(name)
        p.add_argument("ep")
        if name == "gate":
            p.add_argument("--accept", action="store_true")
    a = ap.parse_args()
    if a.cmd == "new":
        return cmd_new(a)
    ep = Path(a.ep).resolve()
    return {"check": lambda: cmd_check(ep), "claims": lambda: cmd_claims(ep), "gate": lambda: cmd_gate(ep, a.accept),
            "captions": lambda: cmd_captions(ep), "youtube": lambda: cmd_youtube(ep)}[a.cmd]()


if __name__ == "__main__":
    sys.exit(main())
