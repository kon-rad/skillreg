// Local ranking over skill attributes (spec section 7). Pure functions.
import type { ParsedSkill } from "./records.js"

export function tokenize(q: string[]): string[] {
  const out: string[] = []
  for (const t of q.join(" ").toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []) if (!out.includes(t)) out.push(t)
  return out
}

export function score(s: ParsedSkill, terms: string[]): number {
  const words = new Set(tokenize([s.summary]))
  let n = 0
  for (const t of terms) {
    if (s.name === t) n += 100
    else if (s.name.startsWith(t)) n += 60
    else if (s.name.includes(t)) n += 40
    if (s.keywords.includes(t)) n += 50
    if (words.has(t)) n += 10
  }
  return n
}

export function latestPerName(skills: ParsedSkill[]): ParsedSkill[] {
  const best = new Map<string, ParsedSkill>()
  for (const s of skills) {
    const id = `${s.name}@${s.creator}`
    const cur = best.get(id)
    if (!cur || s.createdAt > cur.createdAt) best.set(id, s)
  }
  return [...best.values()]
}

export function rank(skills: ParsedSkill[], terms: string[], limit: number): ParsedSkill[] {
  const newer = (a: ParsedSkill, b: ParsedSkill) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0)
  const latest = latestPerName(skills)
  if (terms.length === 0) return latest.sort(newer).slice(0, limit)
  return latest
    .map((s) => ({ s, n: score(s, terms) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || newer(a.s, b.s))
    .slice(0, limit)
    .map((x) => x.s)
}
