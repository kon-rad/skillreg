import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { beforeAll, describe, expect, test } from "vitest"
import { cli, DEV, nodeUp, project, trustFile, uniqueSkill } from "./devnode.js"

const PUBLISHER = DEV[0], IMPOSTOR = DEV[1], SCANNER = DEV[2], SPONSOR = DEV[3]
let up = false
beforeAll(async () => { up = await nodeUp(); if (!up) console.warn("local Arkiv dev node not reachable; integration tests skipped") })

describe.skipIf(!process.env.SKILLREG_IT)("end to end on the local Arkiv dev node", () => {
  test("publish → search → WARN → scan → PASS install → verify → tamper detected", async () => {
    if (!up) return
    const { dir, name } = uniqueSkill("clean-hello")
    const trust = trustFile([PUBLISHER.addr], [SCANNER.addr, SPONSOR.addr]) // two raters: exercises the OR query

    const first = cli(["publish", dir], { key: PUBLISHER.key })
    expect(first.code).toBe(3) // first publish needs --yes
    const pub = cli(["publish", dir, "--yes"], { key: PUBLISHER.key })
    expect(pub.code, pub.stdout + pub.stderr).toBe(0)
    const key = pub.json.key

    const again = cli(["publish", dir, "--yes"], { key: PUBLISHER.key })
    expect(again.json.alreadyPublished).toBe(true)
    expect(again.json.key).toBe(key)

    const found = cli(["search", name], { trust })
    expect(found.json.results[0]).toMatchObject({ name, creator: PUBLISHER.addr, verdict: "WARN", trusted_publisher: true })

    const p = project()
    const warn = cli(["install", `${name}@${PUBLISHER.addr}`], { trust, cwd: p })
    expect(warn.code).toBe(3)
    expect(existsSync(join(p, ".agents/skills", name))).toBe(false)

    const scan = cli(["scan", key], { key: SCANNER.key, trust })
    expect(scan.code, scan.stdout + scan.stderr).toBe(0)
    expect(scan.json.results[0].verdict).toBe("clean")

    const inst = cli(["install", name], { trust, cwd: p }) // bare name resolves: one trusted publisher
    expect(inst.code, inst.stdout + inst.stderr).toBe(0)
    expect(inst.json.verdict).toBe("PASS")
    expect(readFileSync(join(p, ".agents/skills", name, "SKILL.md"), "utf8")).toContain(`name: ${name}`)
    const lock = JSON.parse(readFileSync(join(p, ".agents/skills.lock.json"), "utf8"))
    expect(lock.skills[name].key).toBe(key)

    expect(cli(["verify"], { trust, cwd: p }).code).toBe(0)
    writeFileSync(join(p, ".agents/skills", name, "SKILL.md"), "tampered")
    const v = cli(["verify"], { trust, cwd: p })
    expect(v.code).toBe(4)
    expect(v.json.results[0].ok).toBe(false)
  })

  test("impostor with the same name is scanned malicious and BLOCKED", async () => {
    if (!up) return
    const { dir, name } = uniqueSkill("impostor-fact-check")
    const trust = trustFile([PUBLISHER.addr], [SCANNER.addr])
    const pub = cli(["publish", dir, "--yes"], { key: IMPOSTOR.key })
    expect(pub.code, pub.stdout + pub.stderr).toBe(0)
    const scan = cli(["scan", "--all"], { key: SCANNER.key, trust })
    expect(scan.code, scan.stdout + scan.stderr).toBe(0)
    const mine = scan.json.results.find((r: any) => r.key === pub.json.key)
    expect(mine.verdict).toBe("malicious")
    // --all again finds nothing new for this skill
    expect(cli(["scan", "--all"], { key: SCANNER.key, trust }).json.results.find((r: any) => r.key === pub.json.key)).toBeUndefined()

    const p = project()
    const inst = cli(["install", `${name}@${IMPOSTOR.addr}`, "--yes"], { trust, cwd: p })
    expect(inst.code).toBe(2)
    expect(inst.json.verdict_reasons.join(" ")).toMatch(/credential-exfil|exfil-raw-ip/)
    expect(existsSync(join(p, ".agents/skills", name))).toBe(false)

    const bare = cli(["install", name], { trust: trustFile([], [SCANNER.addr]), cwd: p }) // untrusted publisher: no auto-resolve
    expect(bare.code).toBe(3)
  })

  test("anyone can extend a skill; a clean rating cannot be extended by a stranger", async () => {
    if (!up) return
    const { dir } = uniqueSkill("clean-hello")
    const pub = cli(["publish", dir, "--yes"], { key: PUBLISHER.key })
    const before = BigInt(pub.json.expiresAt)
    const ext = cli(["extend", pub.json.key, "--days", "120"], { key: SPONSOR.key })
    expect(ext.code, ext.stdout + ext.stderr).toBe(0)
    expect(BigInt(ext.json.expiresAt)).toBeGreaterThan(before)

    const rate = cli(["rate", pub.json.key, "--verdict", "clean", "--note", "looks fine"], { key: SCANNER.key })
    expect(rate.code, rate.stdout + rate.stderr).toBe(0)
    const ext2 = cli(["extend", rate.json.key, "--days", "400"], { key: SPONSOR.key })
    expect(ext2.code).toBe(5)
  })

  test("leak check refuses a secret before any network write", async () => {
    if (!up) return
    const { dir } = uniqueSkill("clean-hello")
    writeFileSync(join(dir, ".env"), "TOKEN=x")
    const r = cli(["publish", dir, "--yes"], { key: PUBLISHER.key })
    expect(r.code).toBe(4)
    expect(r.json.code).toBe("leak")
  })
})
