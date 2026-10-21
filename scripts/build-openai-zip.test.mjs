#!/usr/bin/env node
// Proves the build script passes the real package and exits non-zero on each
// violation from #494. Run: node scripts/build-openai-zip.test.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const script = path.join(here, "build-openai-zip.mjs");
const COPY = ["plugin.json", "mcp.json", "skills", "assets", "README.md", "LICENSE"];

const made = [];
function fixture(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "si-plugin-"));
  made.push(dir);
  for (const e of COPY) fs.cpSync(path.join(repo, e), path.join(dir, e), { recursive: true });
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const write = (f, v) => fs.writeFileSync(path.join(dir, f), JSON.stringify(v, null, 2));
  mutate?.({ dir, read, write, ui: (fn) => { const m = read("plugin.json"); fn(m.extensions["com.openai"].interface, m); write("plugin.json", m); } });
  return dir;
}

function run(dir, extra = []) {
  return spawnSync(process.execPath, [script, "--root", dir, "--out", path.join(dir, "dist"), ...extra], { encoding: "utf8" });
}

const server = (m) => m.mcpServers.shortsintel;
const cases = [
  ["shortDescription over 30", (f) => f.ui((ui) => (ui.shortDescription = "x".repeat(31))), "shortDescription"],
  ["displayName over 30", (f) => f.ui((ui) => (ui.displayName = "x".repeat(31))), "displayName"],
  ["displayName has Plugin", (f) => f.ui((ui) => (ui.displayName = "ShortsIntel Plugin")), "MCP\" or \"Plugin"],
  ["longDescription over 4000", (f) => f.ui((ui) => (ui.longDescription = "x".repeat(4001))), "longDescription"],
  ["four default prompts", (f) => f.ui((ui) => ui.defaultPrompt.push("One more prompt")), "limit 3"],
  ["prompt over 128", (f) => f.ui((ui) => (ui.defaultPrompt[0] = "x".repeat(129))), "defaultPrompt[0]"],
  ["http privacy URL", (f) => f.ui((ui) => (ui.privacyPolicyURL = "http://www.shortsintel.com/privacy")), "HTTPS"],
  ["missing support URL", (f) => f.ui((ui) => delete ui.supportURL), "supportURL"],
  ["non-semver version", (f) => f.ui((_, m) => (m.version = "1.0")), "semver"],
  ["low-contrast brandColor", (f) => f.ui((ui) => (ui.brandColor = "#FFEEDD")), "brandColor"],
  ["path without ./", (f) => f.ui((ui) => (ui.logo = "assets/logo.png")), "start with \"./\""],
  ["non-square icon", (f) => { fs.copyFileSync(path.join(repo, "assets/logo.png"), path.join(f.dir, "assets/wide.png")); const p = path.join(f.dir, "assets/wide.png"); const b = fs.readFileSync(p); b.writeUInt32BE(2048, 16); fs.writeFileSync(p, b); f.ui((ui) => (ui.logo = "./assets/wide.png")); }, "square"],
  ["icon under 48px", (f) => { const p = path.join(f.dir, "assets/tiny.png"); const b = fs.readFileSync(path.join(repo, "assets/logo.png")); b.writeUInt32BE(32, 16); b.writeUInt32BE(32, 20); fs.writeFileSync(p, b); f.ui((ui) => (ui.composerIcon = "./assets/tiny.png")); }, "at least 48"],
  ["icon over 5 MiB", (f) => { const p = path.join(f.dir, "assets/big.png"); fs.writeFileSync(p, Buffer.concat([fs.readFileSync(path.join(repo, "assets/logo.png")), Buffer.alloc(5 * 1024 * 1024)])); f.ui((ui) => (ui.logo = "./assets/big.png")); }, "5 MiB"],
  ["missing logo", (f) => f.ui((ui) => delete ui.logo), "interface.logo: required"],
  ["secret in a skill", (f) => fs.appendFileSync(path.join(f.dir, "skills/tracking/SKILL.md"), "\nkey: sk-proj-abcdefghijklmnopqrstuvwx\n"), "secret"],
  ["mcp headers", (f) => { const m = f.read("mcp.json"); server(m).headers = { Authorization: "x" }; f.write("mcp.json", m); }, "headers"],
  ["mcp client secret", (f) => { const m = f.read("mcp.json"); server(m).extensions["com.openai"].auth.client.clientSecret = "x"; f.write("mcp.json", m); }, "secret"],
  ["mcp not streamable-http", (f) => { const m = f.read("mcp.json"); server(m).type = "sse"; f.write("mcp.json", m); }, "streamable-http"],
  ["hooks in manifest", (f) => f.ui((_, m) => (m.extensions["com.openai"].hooks = "./hooks/hooks.json")), "hooks"],
  ["hooks folder", (f) => { fs.mkdirSync(path.join(f.dir, "hooks")); fs.writeFileSync(path.join(f.dir, "hooks/hooks.json"), "{}"); }, "hooks"],
  [".app.json present", (f) => fs.writeFileSync(path.join(f.dir, ".app.json"), "{}"), ".app.json"],
  ["apps in manifest", (f) => f.ui((_, m) => (m.extensions["com.openai"].apps = "./.app.json")), "apps"],
  ["pricing in listing copy", (f) => f.ui((ui) => (ui.longDescription += " Plans from $29/month.")), "money price"],
  ["scraping in listing copy", (f) => f.ui((ui) => (ui.longDescription += " We scrape TikTok.")), "scraping"],
  [".DS_Store in package", (f) => fs.writeFileSync(path.join(f.dir, "assets/.DS_Store"), "x"), "not allowed"],
  ["invalid plugin.json", (f) => fs.writeFileSync(path.join(f.dir, "plugin.json"), "{ nope"), "invalid JSON"],
];

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failed++; };

const good = fixture();
const base = run(good);
ok(base.status === 0 && fs.existsSync(path.join(good, "dist")), `real package builds (exit ${base.status})${base.status ? "\n" + base.stderr : ""}`);

for (const [name, mutate, expect] of cases) {
  const dir = fixture(mutate);
  const r = run(dir);
  ok(r.status === 1 && r.stderr.includes(expect) && !fs.existsSync(path.join(dir, "dist")), `rejects ${name}${r.status === 1 && r.stderr.includes(expect) ? "" : `\n    exit ${r.status}, stderr: ${r.stderr.trim()}`}`);
}

console.log(failed ? `\n${failed} failed` : `\nall ${cases.length + 1} passed`);
for (const d of made) fs.rmSync(d, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
