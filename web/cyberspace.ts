// The hero scene: a vast wireframe cyberspace with the registry drawn into it.
// Every faint point is a record; a few are named, and your trust lines run through them.
import * as THREE from "three"

export type Label = { id: string; text: string; jp?: string; tone: "you" | "rater" | "pass" | "block" | "dim" }
type Opts = { labels?: boolean; density?: number; towers?: boolean }

const VOID = 0x05070d
const CYAN = 0x6fe3ff
const MAGENTA = 0xff3d7f
const WHITE = 0xf2f6ff
const GREEN = 0x5cf2b2

export function createCyberspace(canvas: HTMLCanvasElement, overlay: HTMLElement | null, opts: Opts = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(VOID, 1)
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(VOID, 0.016)
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400)
  camera.position.set(0, 2.2, 14)

  // Floor grid: scrolls toward the camera and wraps, so the plane never ends.
  const CELL = 2
  const grid = new THREE.GridHelper(480, 240, CYAN, CYAN)
  ;(grid.material as THREE.LineBasicMaterial).transparent = true
  ;(grid.material as THREE.LineBasicMaterial).opacity = 0.22
  grid.position.y = -4
  scene.add(grid)
  const ceiling = new THREE.GridHelper(480, 60, MAGENTA, MAGENTA)
  ;(ceiling.material as THREE.LineBasicMaterial).transparent = true
  ;(ceiling.material as THREE.LineBasicMaterial).opacity = 0.05
  ceiling.position.y = 40
  scene.add(ceiling)

  // Distant data towers: wireframe columns on the horizon, for scale.
  const towers = new THREE.Group()
  if (opts.towers !== false) {
    const mat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.18 })
    for (let i = 0; i < 70; i++) {
      const h = 4 + Math.random() ** 2 * 46
      const w = 1 + Math.random() * 3
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, w)), mat)
      const side = Math.random() < 0.5 ? -1 : 1
      box.position.set(side * (18 + Math.random() * 120), -4 + h / 2, -20 - Math.random() * 220)
      towers.add(box)
    }
    scene.add(towers)
  }

  // Point field: the registry at scale, every record a speck of light.
  const N = opts.density ?? 7000
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 300
    pos[i * 3 + 1] = -3 + Math.random() * 60
    pos[i * 3 + 2] = -Math.random() * 300 + 20
  }
  const pg = new THREE.BufferGeometry()
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  const points = new THREE.Points(pg, new THREE.PointsMaterial({ color: WHITE, size: 0.12, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }))
  scene.add(points)

  // The constellation: anonymous records linked to neighbours, plus the named cast.
  const cluster = new THREE.Group()
  cluster.position.set(3.5, 2.5, -6)
  scene.add(cluster)
  const nodes: THREE.Vector3[] = []
  for (let i = 0; i < 46; i++) nodes.push(new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8))
  const cast: Record<string, THREE.Vector3> = {
    you: new THREE.Vector3(-2.2, 3.6, 2),
    scanner: new THREE.Vector3(1.2, 0.8, 0.5),
    real: new THREE.Vector3(6.2, 2.6, -0.5),
    fake: new THREE.Vector3(5.4, -2.6, 1.5),
  }
  const segs: number[] = []
  nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => { if (a.distanceTo(b) < 3.4) segs.push(a.x, a.y, a.z, b.x, b.y, b.z) }))
  const eg = new THREE.BufferGeometry()
  eg.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3))
  cluster.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.12 })))
  const ng = new THREE.BufferGeometry().setFromPoints(nodes)
  cluster.add(new THREE.Points(ng, new THREE.PointsMaterial({ color: CYAN, size: 0.16, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })))

  const sphere = new THREE.SphereGeometry(0.16, 16, 16)
  const glow = (color: number, at: THREE.Vector3, scale = 1) => {
    const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color }))
    m.position.copy(at); m.scale.setScalar(scale); cluster.add(m)
    const halo = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }))
    halo.position.copy(at); halo.scale.setScalar(scale * 3.2); cluster.add(halo)
    return halo
  }
  glow(WHITE, cast.you, 1.2)
  glow(CYAN, cast.scanner)
  glow(GREEN, cast.real)
  const fakeHalo = glow(MAGENTA, cast.fake)

  // Trust beams: you -> scanner (your choice), scanner -> both skills (its ratings).
  const beam = (a: THREE.Vector3, b: THREE.Vector3, color: number, dashed = false) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b])
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.9 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    const l = new THREE.Line(g, mat)
    if (dashed) l.computeLineDistances()
    cluster.add(l)
    return mat
  }
  beam(cast.you, cast.scanner, WHITE)
  beam(cast.scanner, cast.real, GREEN)
  const fakeBeam = beam(cast.scanner, cast.fake, MAGENTA, true) as THREE.LineDashedMaterial

  // HTML labels, projected every frame (sharp text, real fonts, readable by screen readers).
  const labelEls: [HTMLElement, THREE.Vector3][] = []
  if (overlay && opts.labels !== false) {
    const add = (key: keyof typeof cast, l: Label) => {
      const e = document.createElement("div")
      e.className = `cs-label cs-${l.tone}`
      const t = document.createElement("span"); t.textContent = l.text; e.append(t)
      if (l.jp) { const j = document.createElement("span"); j.className = "jp"; j.textContent = l.jp; e.append(j) }
      overlay.append(e)
      labelEls.push([e, cast[key]])
    }
    add("you", { id: "you", text: "you · your trust file", jp: "あなた", tone: "you" })
    add("scanner", { id: "scanner", text: "static-scanner · a rater you chose", jp: "検査", tone: "rater" })
    add("real", { id: "real", text: "fact-check@0xe4da…4a7a · PASS", jp: "本物", tone: "pass" })
    add("fake", { id: "fake", text: "fact-check@0x7019…de92 · BLOCK", jp: "偽物", tone: "block" })
  }

  let w = 0, h = 0
  const resize = () => {
    const r = canvas.getBoundingClientRect()
    if (r.width === w && r.height === h) return
    w = r.width; h = r.height
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
    // Keep the constellation in frame on narrow screens.
    cluster.position.x = w < 720 ? 0.5 : 3.5
    camera.position.z = w < 720 ? 19 : 14
  }

  const mouse = { x: 0, y: 0 }
  addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5 }, { passive: true })

  const tmp = new THREE.Vector3()
  const clock = new THREE.Clock()
  let visible = true
  new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(canvas)

  const frame = () => {
    resize()
    const t = clock.getElapsedTime()
    grid.position.z = (t * 3.2) % CELL
    towers.children.forEach((c) => { c.position.z += 0.053; if (c.position.z > 20) c.position.z -= 240 })
    points.rotation.y = t * 0.006
    cluster.rotation.y = Math.sin(t * 0.15) * 0.18
    cluster.rotation.x = Math.sin(t * 0.11) * 0.05
    fakeHalo.scale.setScalar(3.2 + Math.sin(t * 3) * 0.9)
    fakeBeam.dashSize = 0.25; (fakeBeam as any).dashOffset = -t
    camera.position.x += (mouse.x * 2.4 - camera.position.x) * 0.03
    camera.position.y += (2.2 - mouse.y * 1.4 - camera.position.y) * 0.03
    camera.lookAt(1.5, 1.2, -8)
    renderer.render(scene, camera)
    cluster.updateMatrixWorld()
    for (const [el, v] of labelEls) {
      tmp.copy(v).applyMatrix4(cluster.matrixWorld).project(camera)
      el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w + 12}px, ${(-tmp.y * 0.5 + 0.5) * h - 9}px)`
      el.style.opacity = tmp.z < 1 ? "1" : "0"
    }
  }
  const loop = () => { if (visible) frame(); requestAnimationFrame(loop) }
  if (reduce) { frame(); addEventListener("resize", frame) } else loop()
}
