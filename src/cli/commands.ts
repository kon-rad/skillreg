// The eight skillreg commands (spec section 7).
import { readFileSync } from "node:fs"
import { basename, resolve } from "node:path"
import type { Hex } from "viem"
import { createRatings, createSkill, extend, getSkillFull, hasDuplicate, findSkill, listSkills, ratingsBy, ratingsFor, walletClient, type RatingInput } from "../arkiv.js"
import { parseFrontmatter } from "../frontmatter.js"
import { installFiles, readLock, verifyInstalled } from "../install.js"
import { readSkillDir } from "../manifest.js"
import { buildSkillRecord, VERDICTS, type ParsedSkill, type Verdict } from "../records.js"
import { checkSkillName, leakCheck } from "../safety.js"
import { RULES_HASH, scan } from "../scanner.js"
import { rank, tokenize } from "../search.js"
import { evaluate, isTrustedPublisher } from "../trust.js"
import { VERSION } from "../version.js"
import { CliError, daysLeft, emit, EXIT, isKey, resolveSkill, short, type Ctx } from "./context.js"

const id = (s: Pick<ParsedSkill, "name" | "creator">) => `${s.name}@${s.creator}`

export async function cmdAddress(ctx: Ctx) {
  const wc = walletClient(ctx.net)
  emit(ctx, wc.account.address, { address: wc.account.address })
}

export async function cmdPublish(ctx: Ctx, dir: string, o: { keywords?: string; yes?: boolean; dryRun?: boolean }) {
  const abs = resolve(dir)
  const files = readSkillDir(abs)
  const fm = parseFrontmatter(files.find((f) => f.path === "SKILL.md")!.text)
  checkSkillName(fm.name)
  if (basename(abs) !== fm.name) {
    throw new CliError(EXIT.invalid, `folder ${basename(abs)} must have the same name as the skill (${fm.name})`, { code: "name" })
  }
  const leaks = files.flatMap((f) => leakCheck(f.path, f.text))
  if (leaks.length) {
    throw new CliError(EXIT.invalid, ["refusing to publish: records are public and permanent, and this looks like it contains a secret:", ...leaks.map((l) => `  ${l}`)].join("\n"), { code: "leak", leaks })
  }
  const rec = buildSkillRecord({ files, fm, keywords: o.keywords?.split(",") })
  const summary = { name: fm.name, version: fm.version, sha: rec.sha, files: files.length, bytes: rec.payload.length }
  if (o.dryRun) return emit(ctx, `dry run: ${fm.name} v${fm.version}, ${files.length} files, ${rec.payload.length} bytes, sha ${rec.sha}`, { dryRun: true, ...summary })
  const wc = walletClient(ctx.net)
  const me = wc.account.address.toLowerCase() as Hex
  const dup = await hasDuplicate(ctx.pc, rec.sha, me)
  if (dup) return emit(ctx, `already published: ${fm.name}@${me} key ${dup}`, { alreadyPublished: true, key: dup, ...summary })
  if (!o.yes && !(await findSkill(ctx.pc, fm.name, me))) {
    throw new CliError(EXIT.confirm, `first publish of ${fm.name} from ${me}. Records are public and permanent. Re-run with --yes to publish.`, { code: "confirm", ...summary })
  }
  const r = await createSkill(wc, rec)
  emit(ctx, [`published ${fm.name}@${me} v${fm.version}`, `  key     ${r.entityKey}`, `  tx      ${r.txHash}`, `  expires block ${r.expiresAt} (90 days; anyone can extend)`], {
    published: true, id: `${fm.name}@${me}`, key: r.entityKey, txHash: r.txHash, expiresAt: r.expiresAt, ...summary,
  })
}

async function verdictFor(ctx: Ctx, s: Pick<ParsedSkill, "key" | "sha" | "creator">) {
  return evaluate(s, await ratingsFor(ctx.pc, s.sha, ctx.trust.raters), ctx.trust)
}

export async function cmdSearch(ctx: Ctx, words: string[], o: { limit?: string }) {
  const terms = tokenize(words)
  const top = rank(await listSkills(ctx.pc), terms, Number(o.limit ?? 20), ctx.trust.publishers)
  const block = await ctx.pc.getBlockNumber()
  const results = await Promise.all(
    top.map(async (s) => {
      const ev = await verdictFor(ctx, s)
      return {
        id: id(s), name: s.name, creator: s.creator, key: s.key, version: s.version, summary: s.summary, keywords: s.keywords,
        trusted_publisher: isTrustedPublisher(ctx.trust, s.creator), verdict: ev.verdict, verdict_reasons: ev.reasons,
        expires_in_days: Math.max(0, Math.round((Number(s.expiresAt - block) * 2) / 86400)),
      }
    }),
  )
  const lines = results.length
    ? results.map((r) => `${r.verdict.padEnd(5)} ${r.name}@${short(r.creator)} v${r.version}${r.trusted_publisher ? " (trusted)" : ""}  ${r.summary}\n      install: skillreg install ${r.id}`)
    : [`no skills match ${terms.join(" ")}`]
  emit(ctx, lines, { query: terms, results })
}

export async function cmdInfo(ctx: Ctx, ref: string) {
  const s = await resolveSkill(ctx, ref)
  const ev = await verdictFor(ctx, s)
  const days = await daysLeft(ctx, s.expiresAt)
  const lines = [
    `${s.name}@${s.creator} v${s.version}  ${ev.verdict}`,
    `  ${s.description}`,
    `  key ${s.key}`,
    `  sha ${s.sha}`,
    `  licence ${s.license}, ${s.fileCount} files, ${s.size} bytes, expires in ${days} days`,
    `  publisher ${isTrustedPublisher(ctx.trust, s.creator) ? "is" : "is not"} in your trust list`,
    `  files: ${s.files!.map((f) => f.path).join(", ")}`,
    ...ev.reasons.map((r) => `  rating: ${r}`),
  ]
  emit(ctx, lines, {
    id: id(s), ...s, files: s.files!.map((f) => ({ path: f.path, mode: f.mode, bytes: Buffer.byteLength(f.text) })),
    skillmd: s.files!.find((f) => f.path === "SKILL.md")!.text, verdict: ev.verdict, verdict_reasons: ev.reasons, ratings: ev.counted, expires_in_days: days,
  })
}

export async function cmdInstall(ctx: Ctx, ref: string, o: { dir?: string; yes?: boolean; force?: boolean }) {
  const dir = resolve(o.dir ?? ".agents/skills")
  const s = await resolveSkill(ctx, ref)
  const ev = await verdictFor(ctx, s)
  if (ev.verdict === "BLOCK") throw new CliError(EXIT.blocked, [`BLOCKED ${id(s)}:`, ...ev.reasons.map((r) => `  ${r}`)].join("\n"), { code: "blocked", id: id(s), verdict: ev.verdict, verdict_reasons: ev.reasons })
  if (ev.verdict === "WARN" && !o.yes) throw new CliError(EXIT.confirm, [`WARN ${id(s)}:`, ...ev.reasons.map((r) => `  ${r}`), "Re-run with --yes to install anyway."].join("\n"), { code: "confirm", id: id(s), verdict: ev.verdict, verdict_reasons: ev.reasons })
  const path = installFiles(dir, s.name, s.files!, { creator: s.creator, key: s.key, sha: s.sha, version: s.version }, { force: o.force })
  emit(ctx, [`installed ${id(s)} v${s.version} (${ev.verdict}) to ${path}`, `  ${s.files!.length} files, all hashes match; pinned in the lockfile`, "  your agent loads it in a new session"], {
    installed: id(s), key: s.key, version: s.version, path, files: s.files!.length, bytes: s.size, hashes: "all match", verdict: ev.verdict, verdict_reasons: ev.reasons, restart_needed: true,
  })
}

export async function cmdVerify(ctx: Ctx, o: { dir?: string }) {
  const dir = resolve(o.dir ?? ".agents/skills")
  const lock = readLock(dir)
  const results = []
  for (const [name, e] of Object.entries(lock.skills)) {
    const local = verifyInstalled(dir, name, e)
    let published = true
    try { await getSkillFull(ctx.pc, e.key) } catch { published = false }
    const ev = await verdictFor(ctx, { key: e.key, sha: e.sha, creator: e.creator })
    results.push({ name, id: `${name}@${e.creator}`, ok: local.ok, problems: local.problems, published, verdict: ev.verdict, verdict_reasons: ev.reasons })
  }
  const blocked = results.some((r) => r.verdict === "BLOCK")
  const broken = results.some((r) => !r.ok)
  const lines = results.length
    ? results.map((r) => `${r.ok ? "ok  " : "FAIL"} ${r.verdict.padEnd(5)} ${r.name}${r.published ? "" : " (no longer published)"}${[...r.problems, ...(r.verdict !== "PASS" ? r.verdict_reasons : [])].map((p) => `\n      ${p}`).join("")}`)
    : ["no skills installed by skillreg here"]
  emit(ctx, lines, { dir, results })
  if (blocked) throw new CliError(EXIT.blocked, "an installed skill is now BLOCKED by a rater you trust", { quiet: true })
  if (broken) throw new CliError(EXIT.invalid, "installed files changed or are missing", { quiet: true })
}

export async function cmdExtend(ctx: Ctx, key: string, o: { days?: string }) {
  if (!isKey(key)) throw new CliError(EXIT.usage, "extend needs a record key (0x + 64 hex)")
  const days = Number(o.days ?? 90)
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new CliError(EXIT.usage, "--days must be 1 to 3650")
  const r = await extend(walletClient(ctx.net), key as Hex, days)
  emit(ctx, `extended ${key}: now expires at block ${r.expiresAt} (${days} days from now)`, { key, txHash: r.txHash, expiresAt: r.expiresAt })
}

export async function cmdRate(ctx: Ctx, key: string, o: { verdict: string; note?: string; evidence?: string }) {
  if (!isKey(key)) throw new CliError(EXIT.usage, "rate needs a skill record key (0x + 64 hex)")
  if (!VERDICTS.includes(o.verdict as Verdict)) throw new CliError(EXIT.usage, "--verdict must be clean, warn or malicious")
  const s = await getSkillFull(ctx.pc, key as Hex)
  const evidence = o.evidence ? readFileSync(o.evidence, "utf8") : ""
  const note = [o.note, evidence].filter(Boolean).join("\n\n")
  const [res] = await createRatings(walletClient(ctx.net), [{ skillKey: s.key, sha: s.sha, verdict: o.verdict as Verdict, kind: "human", raterVer: "human", findings: [], rulesHash: null, note }])
  emit(ctx, `rated ${id(s)} ${o.verdict}: rating ${res.keys[0]} tx ${res.txHash}`, { rated: id(s), verdict: o.verdict, key: res.keys[0], txHash: res.txHash })
}

export async function cmdScan(ctx: Ctx, key: string | undefined, o: { all?: boolean; dryRun?: boolean }) {
  if (!key && !o.all) throw new CliError(EXIT.usage, "give a skill key, or --all")
  const wc = o.dryRun && !process.env.SKILLREG_PRIVATE_KEY ? undefined : walletClient(ctx.net)
  let targets: Hex[] = []
  if (key) {
    if (!isKey(key)) throw new CliError(EXIT.usage, "scan needs a record key (0x + 64 hex)")
    targets = [key.toLowerCase() as Hex]
  } else {
    const skills = await listSkills(ctx.pc)
    const done = wc ? new Set((await ratingsBy(ctx.pc, wc.account.address.toLowerCase() as Hex)).map((r) => `${r.skill}:${r.sha}`)) : new Set<string>()
    targets = skills.filter((s) => !done.has(`${s.key}:${s.sha}`) && s.creator !== wc?.account.address.toLowerCase()).map((s) => s.key)
  }
  const inputs: (RatingInput & { id: string })[] = []
  const skipped: { key: string; reason: string }[] = []
  for (const k of targets) {
    try {
      const s = await getSkillFull(ctx.pc, k)
      const r = scan(s.files!)
      inputs.push({ id: id(s), skillKey: s.key, sha: s.sha, verdict: r.verdict, kind: "static", raterVer: VERSION, findings: r.findings, rulesHash: RULES_HASH })
    } catch (e) {
      skipped.push({ key: k, reason: (e as Error).message })
    }
  }
  const txs = !o.dryRun && wc && inputs.length ? await createRatings(wc, inputs) : []
  const lines = [
    ...inputs.map((i) => `${i.verdict.padEnd(9)} ${i.id}${i.findings.filter((f) => f.severity !== "info").slice(0, 3).map((f) => `\n      ${f.severity} ${f.rule} ${f.file}:${f.line}  ${f.excerpt.slice(0, 90)}`).join("")}`),
    ...skipped.map((s) => `skipped  ${s.key}: ${s.reason}`),
    o.dryRun ? "dry run: nothing posted" : `posted ${inputs.length} ratings in ${txs.length} transaction(s)`,
  ]
  emit(ctx, inputs.length || skipped.length ? lines : ["nothing new to scan"], {
    dryRun: !!o.dryRun, rater: wc?.account.address, rulesHash: RULES_HASH, version: VERSION,
    results: inputs.map(({ id, verdict, findings, skillKey }) => ({ id, key: skillKey, verdict, findings })), skipped, transactions: txs,
  })
}
