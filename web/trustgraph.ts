// Figure 2: an interactive trust graph. Pick whose ratings count and watch the verdicts change.
// Uses the same rule as the CLI: any trusted "malicious" blocks, any trusted "warn" warns,
// one trusted "clean" passes, anything else warns.
import * as THREE from "three"

type Verdict = "PASS" | "WARN" | "BLOCK"
type Rating = "clean" | "warn" | "malicious"
const RATERS = ["scanner", "llm", "stranger"] as const
type Rater = (typeof RATERS)[number]
const SKILLS = ["real", "fake"] as const
type Skill = (typeof SKILLS)[number]

// What each rater has posted on chain in this example.
const RATINGS: Record<Rater, Partial<Record<Skill, Rating>>> = {
  scanner: { real: "clean", fake: "malicious" },
  llm: { real: "clean", fake: "malicious" },
  stranger: { fake: "clean" }, // a fresh wallet vouching for the impostor
}

export const SCENARIOS: { id: string; label: string; trust: Rater[]; note: string }[] = [
  { id: "scanner", label: "Trust the scanner", trust: ["scanner"], note: "The default. The scanner rated the real skill clean and the impostor malicious, so you get PASS and BLOCK." },
  { id: "nobody", label: "Trust nobody", trust: [], note: "No trusted ratings means no evidence either way. Both skills are WARN: install asks you first." },
  { id: "stranger", label: "Trust a stranger", trust: ["stranger"], note: "The stranger vouched for the impostor, so it now shows PASS. Your verdict is only as good as the judges you pick, which is why trust lists should be public and raters should earn track records." },
  { id: "both", label: "Scanner and stranger", trust: ["scanner", "stranger"], note: "One honest rater outweighs any number of dishonest ones: a single trusted malicious rating blocks. Sybil wallets can't vote a skill clean." },
]

export function verdict(skill: Skill, trust: Rater[]): Verdict {
  const rs = trust.map((r) => RATINGS[r][skill]).filter(Boolean) as Rating[]
  if (rs.includes("malicious")) return "BLOCK"
  if (rs.includes("warn")) return "WARN"
  if (rs.includes("clean")) return "PASS"
  return "WARN"
}

const C = { you: 0xf2f6ff, rater: 0x6fe3ff, off: 0x2a3550, PASS: 0x5cf2b2, WARN: 0xffc65c, BLOCK: 0xff3d7f, clean: 0x5cf2b2, malicious: 0xff3d7f, warn: 0xffc65c }

export function createTrustGraph(canvas: HTMLCanvasElement, overlay: HTMLElement) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(0x070a12, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 0, 15)
  const g = new THREE.Group()
  scene.add(g)

  const floor = new THREE.GridHelper(40, 40, 0x6fe3ff, 0x6fe3ff)
  ;(floor.material as THREE.LineBasicMaterial).transparent = true
  ;(floor.material as THREE.LineBasicMaterial).opacity = 0.08
  floor.rotation.x = Math.PI / 2
  floor.position.z = -3
  scene.add(floor)

  // Wide screens read left to right (you, raters, skills); narrow screens read top to bottom.
  const WIDE: Record<string, [number, number, number]> = {
    you: [-6, 0, 0], scanner: [0, 2.6, 0.5], llm: [0, 0, -0.5], stranger: [0, -2.6, 0.5], real: [6, 1.4, 0], fake: [6, -1.4, 0],
  }
  const TALL: Record<string, [number, number, number]> = {
    you: [0, 5.2, 0], scanner: [-3.4, 0.6, 0.5], llm: [0, 0, -0.5], stranger: [3.4, 0.6, 0.5], real: [-3, -4.6, 0], fake: [3, -5.6, 0],
  }
  const P: Record<string, THREE.Vector3> = Object.fromEntries(Object.entries(WIDE).map(([k, v]) => [k, new THREE.Vector3(...v)]))
  const meshes: [string, THREE.Mesh][] = []
  const lines: [string, string, THREE.Line][] = []
  const geo = new THREE.SphereGeometry(0.28, 20, 20)
  const node: Record<string, THREE.MeshBasicMaterial> = {}
  const halo: Record<string, THREE.Mesh> = {}
  for (const k of Object.keys(P)) {
    node[k] = new THREE.MeshBasicMaterial({ color: C.off })
    const m = new THREE.Mesh(geo, node[k]); m.position.copy(P[k]); g.add(m); meshes.push([k, m])
    const h = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C.off, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }))
    h.position.copy(P[k]); h.scale.setScalar(2.4); g.add(h); halo[k] = h; meshes.push([k, h])
  }
  const line = (a: string, b: string) => {
    const mat = new THREE.LineDashedMaterial({ color: C.off, dashSize: 0.3, gapSize: 0.15, transparent: true, opacity: 0.9 })
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P[a], P[b]]), mat)
    l.computeLineDistances(); g.add(l); lines.push([a, b, l])
    return mat
  }
  const trustEdge: Record<Rater, THREE.LineDashedMaterial> = { scanner: line("you", "scanner"), llm: line("you", "llm"), stranger: line("you", "stranger") }
  const ratingEdge: { r: Rater; s: Skill; m: THREE.LineDashedMaterial }[] = []
  for (const r of RATERS) for (const s of SKILLS) if (RATINGS[r][s]) ratingEdge.push({ r, s, m: line(r, s) })

  const labels: Record<string, HTMLElement> = {}
  const text: Record<string, [string, string]> = {
    you: ["you", "あなた"], scanner: ["static-scanner", "検査"], llm: ["llm-rater (roadmap)", "AI検査"], stranger: ["a fresh wallet", "匿名"],
    real: ["fact-check@registry-ops", "本物"], fake: ["fact-check@demo-author", "偽物"],
  }
  for (const k of Object.keys(P)) {
    const e = document.createElement("div"); e.className = "tg-label"
    const a = document.createElement("span"); a.textContent = text[k][0]
    const j = document.createElement("span"); j.className = "jp"; j.textContent = text[k][1]
    const v = document.createElement("b"); v.className = "tg-v"
    e.append(a, j, v); overlay.append(e); labels[k] = e
  }

  let current: Rater[] = ["scanner"]
  const set = (trust: Rater[]) => {
    current = trust
    node.you.color.setHex(C.you); (halo.you.material as THREE.MeshBasicMaterial).color.setHex(C.you)
    for (const r of RATERS) {
      const on = trust.includes(r)
      node[r].color.setHex(on ? C.rater : C.off); (halo[r].material as THREE.MeshBasicMaterial).color.setHex(on ? C.rater : C.off)
      trustEdge[r].color.setHex(on ? C.you : C.off); trustEdge[r].opacity = on ? 0.95 : 0.35
      labels[r].classList.toggle("off", !on)
    }
    for (const e of ratingEdge) {
      const on = trust.includes(e.r)
      e.m.color.setHex(on ? C[RATINGS[e.r][e.s]!] : C.off); e.m.opacity = on ? 0.95 : 0.25
    }
    for (const s of SKILLS) {
      const v = verdict(s, trust)
      node[s].color.setHex(C[v]); (halo[s].material as THREE.MeshBasicMaterial).color.setHex(C[v])
      const b = labels[s].querySelector(".tg-v")!
      b.textContent = v; b.className = `tg-v ${v}`
    }
    if (reduce) frame()
  }

  let w = 0, h = 0
  const tmp = new THREE.Vector3()
  const clock = new THREE.Clock()
  const frame = () => {
    const r = canvas.getBoundingClientRect()
    if (r.width !== w || r.height !== h) {
      w = r.width; h = r.height; renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      const tall = w < 560
      camera.position.z = tall ? 24 : 15
      camera.updateProjectionMatrix()
      for (const [k, v] of Object.entries(tall ? TALL : WIDE)) P[k].set(...v)
      for (const [k, m] of meshes) m.position.copy(P[k])
      for (const [a, b, l] of lines) { l.geometry.setFromPoints([P[a], P[b]]); l.computeLineDistances() }
    }
    const t = clock.getElapsedTime()
    g.rotation.y = Math.sin(t * 0.3) * 0.22
    g.rotation.x = Math.sin(t * 0.21) * 0.08
    for (const m of [...Object.values(trustEdge), ...ratingEdge.map((e) => e.m)]) (m as any).dashOffset = -t * 0.8
    for (const s of SKILLS) if (verdict(s, current) === "BLOCK") halo[s].scale.setScalar(2.4 + Math.sin(t * 4) * 0.6); else halo[s].scale.setScalar(2.4)
    renderer.render(scene, camera)
    g.updateMatrixWorld()
    for (const k of Object.keys(P)) {
      tmp.copy(P[k]).applyMatrix4(g.matrixWorld).project(camera)
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h
      labels[k].style.transform = `translate(${x}px, ${y + 18}px) translateX(-50%)`
    }
  }
  let visible = true
  new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(canvas)
  const loop = () => { if (visible) frame(); requestAnimationFrame(loop) }
  set(current)
  if (reduce) { frame(); addEventListener("resize", frame) } else loop()
  return { set }
}
