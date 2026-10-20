// Blog: an index of posts and a post view (?post=<slug>). Posts are the repo's own markdown files,
// the same ones GitHub renders, so there is one source for both.
import "./site.css"
import { marked } from "marked"
import introducing from "../docs/introducing-skillreg.md?raw"
import threeMinutes from "../docs/skillreg-in-three-minutes.md?raw"
import explainer from "../docs/explainer-episode.md?raw"
import { createCyberspace } from "./cyberspace"

type Post = { slug: string; title: string; date: string; kicker: string; dek: string; md: string; image?: string }
const POSTS: Post[] = [
  {
    slug: "explainer-episode", title: "explainer-episode: the skill we use to make educational TV, now on skillreg", date: "21 October 2026", kicker: "Skill",
    dek: "Six to ten minute explainers researched from primary sources, fact-checked claim by claim behind a hash-stamped gate, critiqued twice, packaged for YouTube.",
    md: explainer, image: "./blog/explainer-episode/thumbnail.webp",
  },
  {
    slug: "skillreg-in-three-minutes", title: "skillreg in three minutes: the demo, frame by frame", date: "18 October 2026", kicker: "Walkthrough",
    dek: "The demo video as a post: two skills called fact-check, the real screens, the real terminal output and the real transactions on Arkiv.",
    md: threeMinutes, image: "./blog/skillreg-in-three-minutes/ai-cyberspace.webp",
  },
  {
    slug: "introducing-skillreg", title: "Introducing skillreg: a trust layer for agent instructions", date: "18 October 2026", kicker: "Essay",
    dek: "Why agent skills need a chain of custody, why smarter models make that more important rather than less, and where skillreg goes next.",
    md: introducing, image: "./blog/skillreg-in-three-minutes/ai-seal.webp",
  },
]

const REPO = "https://github.com/kon-rad/skillreg/blob/main/docs/"
const SITE = "https://kon-rad.github.io/skillreg/"
const slugs = new Set(POSTS.map((p) => p.slug))

function fixHref(href: string): string {
  if (href.startsWith("../web/public/")) return "./" + href.slice("../web/public/".length)
  const m = href.match(/^\.\/([a-z0-9-]+)\.md$/)
  if (m && slugs.has(m[1])) return `./blog.html?post=${m[1]}`
  if (href.startsWith(SITE)) return "./" + href.slice(SITE.length)
  if (href.startsWith("../") || href.startsWith("./")) return new URL(href, REPO).toString()
  return href
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
marked.use({
  walkTokens(token) {
    if (token.type === "link" || token.type === "image") token.href = fixHref(token.href)
  },
  renderer: {
    image({ href, title, text }) {
      const cap = title ? `<figcaption>${esc(title)}</figcaption>` : ""
      return `<figure class="post-fig"><img src="${esc(href)}" alt="${esc(text)}" loading="lazy" decoding="async" />${cap}</figure>`
    },
  },
})

function smartQuotes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.parentElement as HTMLElement).closest("code, pre")) continue
    n.nodeValue = n.nodeValue!
      .replace(/(^|[\s(\[])"/g, "$1\u201C").replace(/"/g, "\u201D")
      .replace(/(\w)'(\w)/g, "$1\u2019$2").replace(/(^|\s)'/g, "$1\u2018").replace(/'/g, "\u2019")
  }
}

const main = document.getElementById("post")!
const kicker = document.getElementById("kicker")!
const slug = new URLSearchParams(location.search).get("post")
const post = POSTS.find((p) => p.slug === slug)

if (post) {
  document.title = `${post.title} · skillreg`
  kicker.textContent = `${post.kicker} · ${post.date}`
  // The markdown is our own file from the repo, not record data, so rendering it as HTML is safe.
  main.innerHTML = marked.parse(post.md, { async: false }) as string
  // A paragraph that only wraps a figure becomes the figure itself.
  for (const p of [...main.querySelectorAll("p")]) {
    if (p.children.length === 1 && p.firstElementChild!.tagName === "FIGURE" && !p.textContent!.trim()) p.replaceWith(p.firstElementChild!)
  }
  smartQuotes(main)
  const end = document.createElement("p"); end.className = "post-end"; end.textContent = "■"
  const more = document.createElement("nav"); more.className = "post-more"
  const back = document.createElement("a"); back.href = "./blog.html"; back.textContent = "All posts"
  more.append(back)
  for (const other of POSTS.filter((p) => p !== post)) {
    const a = document.createElement("a"); a.href = `./blog.html?post=${other.slug}`; a.textContent = `Next: ${other.title}`; more.append(a)
  }
  main.append(end, more)
} else {
  kicker.textContent = "Blog · essays and walkthroughs"
  main.classList.add("post-index")
  const h = document.createElement("h1"); h.textContent = "The skillreg blog"
  const lede = document.createElement("p"); lede.className = "index-lede"; lede.textContent = "Notes on building a trust layer for agent instructions, on Arkiv."
  main.replaceChildren(h, lede)
  for (const p of POSTS) {
    const a = document.createElement("a"); a.className = "index-item"; a.href = `./blog.html?post=${p.slug}`
    if (p.image) { const img = document.createElement("img"); img.src = p.image; img.alt = ""; img.loading = "lazy"; a.append(img) }
    const k = document.createElement("span"); k.className = "index-kicker"; k.textContent = `${p.kicker} · ${p.date}`
    const t = document.createElement("span"); t.className = "index-title"; t.textContent = p.title
    const d = document.createElement("span"); d.className = "index-dek"; d.textContent = p.dek
    const text = document.createElement("span"); text.className = "index-text"; text.append(k, t, d)
    a.append(text); main.append(a)
  }
  smartQuotes(main)
}

try {
  if (document.createElement("canvas").getContext("webgl2"))
    createCyberspace(document.getElementById("cyberspace") as HTMLCanvasElement, null, { labels: false, density: 4000 })
} catch { /* the header just stays dark */ }
