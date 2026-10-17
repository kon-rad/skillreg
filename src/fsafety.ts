// S1, resolved part: the target must stay inside root (Node only).
import { resolve, sep } from "node:path"
import { checkRelPath, SafetyError } from "./safety.js"

export function resolveInside(root: string, p: string): string {
  checkRelPath(p)
  const base = resolve(root)
  const target = resolve(base, p)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new SafetyError("path", `path ${JSON.stringify(p)} escapes ${base}`)
  }
  return target
}
