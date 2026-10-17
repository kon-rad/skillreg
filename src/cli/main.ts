#!/usr/bin/env node
// skillreg: an open, permissionless registry for agent skills on Arkiv.
import { Command } from "commander"
import { VERSION } from "../version.js"
import { cmdAddress, cmdExtend, cmdInfo, cmdInstall, cmdPublish, cmdRate, cmdScan, cmdSearch, cmdVerify } from "./commands.js"
import { makeCtx, toCliError } from "./context.js"

const program = new Command()
program
  .name("skillreg")
  .description("Open, permissionless registry for agent skills on Arkiv. Signed, immutable, hash-checked, rated by whoever you trust.")
  .version(VERSION)
  .option("--rpc <url>", "Arkiv RPC URL (env SKILLREG_RPC)")
  .option("--chain <name>", "tiramisu or local (env SKILLREG_CHAIN)")
  .option("--trust <file>", "trust file (env SKILLREG_TRUST, else ~/.skillreg/trust.json, else the packaged default)")
  .option("--json", "machine-readable output")
  .showHelpAfterError()

const run = (fn: (ctx: ReturnType<typeof makeCtx>, ...a: any[]) => Promise<void>) =>
  async (...args: any[]) => {
    const opts = program.opts()
    let json = !!opts.json
    try {
      const ctx = makeCtx(opts)
      json = ctx.json
      await fn(ctx, ...args.slice(0, -1))
    } catch (e) {
      const err = toCliError(e)
      if (!err.data.quiet) {
        if (json) process.stdout.write(JSON.stringify({ error: err.message, exit: err.exit, ...err.data }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n")
        else process.stderr.write(err.message + "\n")
      }
      process.exitCode = err.exit
    }
  }

program.command("search").argument("<words...>").option("--limit <n>", "max results", "20").description("search skills; ranks locally and shows your trust verdict").action(run((ctx, words, o) => cmdSearch(ctx, words, o)))
program.command("info").argument("<ref>", "name@0xpublisher, a record key, or a name").description("show a skill, its files and ratings").action(run((ctx, ref) => cmdInfo(ctx, ref)))
program.command("install").argument("<ref>").option("--dir <dir>", "skills folder", ".agents/skills").option("--yes", "install a WARN skill").option("--force", "replace a folder skillreg did not install").description("verify and install a skill").action(run((ctx, ref, o) => cmdInstall(ctx, ref, o)))
program.command("verify").option("--dir <dir>", "skills folder", ".agents/skills").description("re-check installed skills: files, publication and ratings").action(run((ctx, o) => cmdVerify(ctx, o)))
program.command("publish").argument("<dir>").option("--keywords <list>", "comma-separated, up to 5").option("--yes", "confirm the first publish of a name").option("--dry-run", "validate and show the record without writing").description("publish a skill folder as an Arkiv record (needs SKILLREG_PRIVATE_KEY)").action(run((ctx, dir, o) => cmdPublish(ctx, dir, o)))
program.command("extend").argument("<key>").option("--days <n>", "days from now", "90").description("keep a skill alive: owners renew, anyone can sponsor").action(run((ctx, key, o) => cmdExtend(ctx, key, o)))
program.command("rate").argument("<key>").requiredOption("--verdict <v>", "clean, warn or malicious").option("--note <text>").option("--evidence <file>").description("post your own rating of an exact skill version").action(run((ctx, key, o) => cmdRate(ctx, key, o)))
program.command("scan").argument("[key]").option("--all", "scan every skill this wallet has not rated").option("--dry-run", "scan without posting").description("run the static scanner and post ratings").action(run((ctx, key, o) => cmdScan(ctx, key, o)))
program.command("address").description("print the address of SKILLREG_PRIVATE_KEY").action(run((ctx) => cmdAddress(ctx)))

program.parseAsync()
