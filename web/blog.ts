// Blog page: renders docs/introducing-skillreg.md (the same file GitHub shows) into the paper column.
import "./site.css"
import { marked } from "marked"
import md from "../docs/introducing-skillreg.md?raw"
import { createCyberspace } from "./cyberspace"

const REPO = "https://github.com/kon-rad/skillreg/blob/main/docs/"
const post = document.getElementById("post")!
// The markdown is our own file from the repo, not record data, so rendering it as HTML is safe.
post.innerHTML = marked.parse(md, { async: false }) as string
for (const a of post.querySelectorAll("a")) {
  const href = a.getAttribute("href") ?? ""
  if (href.startsWith("../") || href.startsWith("./")) a.href = new URL(href, REPO).toString()
  // Links back to this site stay on this site.
  a.href = a.href.replace("https://kon-rad.github.io/skillreg/", "./")
}
const end = document.createElement("p"); end.className = "post-end"; end.textContent = "■"
post.append(end)

// Typographer's quotes in prose, never inside code.
const walker = document.createTreeWalker(post, NodeFilter.SHOW_TEXT)
for (let n = walker.nextNode(); n; n = walker.nextNode()) {
  if ((n.parentElement as HTMLElement).closest("code, pre")) continue
  n.nodeValue = n.nodeValue!
    .replace(/(^|[\s(\[])"/g, "$1\u201C").replace(/"/g, "\u201D")
    .replace(/(\w)'(\w)/g, "$1\u2019$2").replace(/(^|\s)'/g, "$1\u2018").replace(/'/g, "\u2019")
}

try {
  if (document.createElement("canvas").getContext("webgl2"))
    createCyberspace(document.getElementById("cyberspace") as HTMLCanvasElement, null, { labels: false, density: 4000 })
} catch { /* the header just stays dark */ }
