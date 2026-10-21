#!/usr/bin/env node
// Builds the OpenAI Agent Plugins ZIP (plugin.json at the ZIP root) and checks
// the listing and package limits from platform.openai.com/plugins first.
// No dependencies: Node 18+ only.
//
//   node scripts/build-openai-zip.mjs [--root <dir>] [--out <dir>] [--check]
//
// Exits 1 and prints every problem when a check fails; nothing is written then.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const MCP_URL = "https://www.shortsintel.com/api/mcp";

/** What goes in the ZIP. Claude-only files (.claude-plugin/, .mcp.json) stay out. */
const PACKAGE_ENTRIES = ["plugin.json", "mcp.json", "skills", "assets", "README.md", "LICENSE"];
const ALLOWED_EXT = new Set([".json", ".md", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".txt", ""]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ICON_FIELDS = ["logo", "composerIcon", "logoDark", "composerIconDark"];
const REQUIRED_ICONS = ["logo", "composerIcon"];
const URL_FIELDS = ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"];

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bsk-(?:proj-|live_|test_)?[A-Za-z0-9_-]{16,}/, "API secret key (sk-...)"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{20,}/, "bearer token"],
  [/"(?:clientSecret|client_secret|apiKey|api_key|password|test_credentials|reviewer_instructions)"\s*:/, "credential field"],
];

// Listing copy must not sell, compare or call the data "scraped" (#488).
const COPY_BANNED = [
  [/\$\s?\d|\b\d+\s?(?:usd|eur|gbp)\b|€|£/i, "money price"],
  [/\b(?:pricing|price plans?|subscription|subscribe|upgrade|discount|promo(?:tion)?|coupon|free trial|top up|checkout|billing)\b/i, "pricing or promotion"],
  [/\b(?:better than|cheaper than|alternative to|vs\.?|versus|compared to)\b/i, "comparison"],
  [/\bscrap(?:e|es|ed|er|ers|ing)\b/i, "\"scraping\""],
];

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const NAME = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;

// ---------- helpers ----------

function readJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${path.basename(file)}: missing or invalid JSON (${e.message})`);
    return null;
  }
}

function walk(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) out.push({ rel: path.relative(base, full), symlink: true });
    else if (ent.isDirectory()) out.push(...walk(full, base));
    else out.push({ rel: path.relative(base, full) });
  }
  return out;
}

/** Package files, relative to root, with forward slashes, sorted. */
export function listPackageFiles(root) {
  const files = [];
  for (const entry of PACKAGE_ENTRIES) {
    const full = path.join(root, entry);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isDirectory()) {
      for (const f of walk(full, root)) files.push({ ...f, rel: f.rel.split(path.sep).join("/") });
    } else files.push({ rel: entry });
  }
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

function httpsUrl(value, label, errors, max = 1024) {
  if (typeof value !== "string" || !value) return errors.push(`${label}: required HTTPS URL is missing`);
  let u;
  try {
    u = new URL(value);
  } catch {
    return errors.push(`${label}: not a valid URL (${value})`);
  }
  if (u.protocol !== "https:") errors.push(`${label}: must use HTTPS (${value})`);
  if (u.username || u.password) errors.push(`${label}: must not embed credentials`);
  if (value.length > max) errors.push(`${label}: longer than ${max} characters`);
}

function maxLen(value, max, label, errors, required = true) {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${label}: required`);
    return;
  }
  if (typeof value !== "string") return errors.push(`${label}: must be a string`);
  if (value.length > max) errors.push(`${label}: ${value.length} characters, limit ${max}`);
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Width and height of a PNG, JPEG, WebP or SVG, or null. */
export function imageSize(buf, ext) {
  if (ext === ".png") {
    if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (ext === ".webp") {
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (ext === ".svg") {
    const s = buf.toString("utf8");
    const tag = s.match(/<svg\b[^>]*>/i)?.[0] ?? "";
    const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (vb) return { width: Number(vb[1]), height: Number(vb[2]) };
    const w = tag.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i);
    const h = tag.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);
    if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
    return null;
  }
  return null;
}

function checkRelPath(root, value, label, errors) {
  if (typeof value !== "string" || !value.startsWith("./"))
    return errors.push(`${label}: path must start with "./" (${value})`), null;
  const full = path.resolve(root, value);
  if (!full.startsWith(path.resolve(root) + path.sep))
    return errors.push(`${label}: path leaves the plugin root (${value})`), null;
  if (!fs.existsSync(full)) return errors.push(`${label}: file not found (${value})`), null;
  const rel = path.relative(root, full).split(path.sep).join("/");
  if (!PACKAGE_ENTRIES.some((e) => rel === e || rel.startsWith(e + "/")))
    errors.push(`${label}: file is outside the packaged folders (${value})`);
  return full;
}

function checkIcon(root, value, label, errors) {
  const full = checkRelPath(root, value, label, errors);
  if (!full) return;
  const ext = path.extname(full).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return errors.push(`${label}: must be PNG, JPEG, WebP or SVG (${value})`);
  const buf = fs.readFileSync(full);
  if (buf.length > MAX_IMAGE_BYTES) errors.push(`${label}: ${buf.length} bytes, limit 5 MiB`);
  const size = imageSize(buf, ext);
  if (!size) return errors.push(`${label}: cannot read image dimensions (${value})`);
  if (size.width !== size.height) errors.push(`${label}: must be square, is ${size.width}x${size.height}`);
  if (Math.min(size.width, size.height) < 48) errors.push(`${label}: must be at least 48x48, is ${size.width}x${size.height}`);
  if (ext !== ".svg" && Math.max(size.width, size.height) > 4096) errors.push(`${label}: larger than 4096px`);
}

function checkCopy(text, label, errors) {
  if (typeof text !== "string") return;
  for (const [re, what] of COPY_BANNED) if (re.test(text)) errors.push(`${label}: contains ${what} ("${text.match(re)[0]}")`);
}

function frontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

// ---------- the check ----------

/** Every problem with the package at `root`, as strings. Empty means it is fine to build. */
export function check(root) {
  const errors = [];
  const manifest = readJson(path.join(root, "plugin.json"), errors);
  const mcp = readJson(path.join(root, "mcp.json"), errors);

  if (manifest) {
    if (manifest.$schema !== PLUGIN_SCHEMA) errors.push(`plugin.json: $schema must be ${PLUGIN_SCHEMA}`);
    if (typeof manifest.name !== "string" || manifest.name.length > 64 || !NAME.test(manifest.name))
      errors.push("plugin.json: name must be 1-64 lowercase letters, digits and single hyphens");
    if (typeof manifest.version !== "string" || !SEMVER.test(manifest.version))
      errors.push(`plugin.json: version must be explicit semver (got ${JSON.stringify(manifest.version)})`);
    maxLen(manifest.description, 4000, "plugin.json: description", errors);
    maxLen(manifest.author?.name, 120, "plugin.json: author.name", errors);
    maxLen(manifest.author?.email, 320, "plugin.json: author.email", errors, false);
    if (manifest.author?.url !== undefined) httpsUrl(manifest.author.url, "plugin.json: author.url", errors, 2048);
    if (manifest.homepage !== undefined) httpsUrl(manifest.homepage, "plugin.json: homepage", errors, 2048);
    if ("hooks" in manifest) errors.push("plugin.json: hooks are not allowed");

    const openai = manifest.extensions?.["com.openai"];
    if (!openai || typeof openai !== "object") errors.push("plugin.json: extensions.com.openai is missing");
    else {
      if (openai.hooks !== undefined) errors.push("plugin.json: extensions.com.openai.hooks is not allowed");
      if (openai.apps !== undefined) errors.push("plugin.json: extensions.com.openai.apps (.app.json) is not allowed");
      if (openai.review?.test_credentials !== undefined || openai.review?.reviewer_instructions !== undefined)
        errors.push("plugin.json: reviewer credentials must not be in the package");
      if (openai.onboardingSkill !== undefined) checkRelPath(root, openai.onboardingSkill, "onboardingSkill", errors);

      const ui = openai.interface;
      if (!ui || typeof ui !== "object") errors.push("plugin.json: extensions.com.openai.interface is missing");
      else {
        maxLen(ui.displayName, 30, "interface.displayName", errors);
        if (/\b(mcp|plugin)\b/i.test(ui.displayName ?? "")) errors.push('interface.displayName: must not contain "MCP" or "Plugin"');
        maxLen(ui.shortDescription, 30, "interface.shortDescription", errors);
        maxLen(ui.longDescription, 4000, "interface.longDescription", errors);
        maxLen(ui.developerName, 80, "interface.developerName", errors);
        maxLen(ui.category, 80, "interface.category", errors);
        if (!Array.isArray(ui.capabilities)) errors.push("interface.capabilities: required array");
        else {
          if (ui.capabilities.length > 20) errors.push("interface.capabilities: more than 20 items");
          ui.capabilities.forEach((c, i) => maxLen(c, 120, `interface.capabilities[${i}]`, errors));
        }
        for (const f of URL_FIELDS) httpsUrl(ui[f], `interface.${f}`, errors);

        const prompts = ui.defaultPrompt === undefined ? [] : [].concat(ui.defaultPrompt);
        if (prompts.length > 3) errors.push(`interface.defaultPrompt: ${prompts.length} prompts, limit 3`);
        if (new Set(prompts).size !== prompts.length) errors.push("interface.defaultPrompt: prompts must be unique");
        prompts.forEach((p, i) => {
          maxLen(p, 128, `interface.defaultPrompt[${i}]`, errors);
          if (/(^|\s)@[A-Z]/.test(p ?? "")) errors.push(`interface.defaultPrompt[${i}]: must not @mention an app`);
          checkCopy(p, `interface.defaultPrompt[${i}]`, errors);
        });

        if (!HEX.test(ui.brandColor ?? "")) errors.push("interface.brandColor: must be #RRGGBB");
        else if (contrast(ui.brandColor, "#FFFFFF") < 2)
          errors.push(`interface.brandColor: contrast ${contrast(ui.brandColor, "#FFFFFF").toFixed(2)}:1 against white, need 2:1`);
        if (ui.brandColorDark !== undefined) {
          if (!HEX.test(ui.brandColorDark)) errors.push("interface.brandColorDark: must be #RRGGBB");
          else if (contrast(ui.brandColorDark, "#212121") < 2)
            errors.push(`interface.brandColorDark: contrast ${contrast(ui.brandColorDark, "#212121").toFixed(2)}:1 against #212121, need 2:1`);
        }

        for (const f of REQUIRED_ICONS) if (ui[f] === undefined) errors.push(`interface.${f}: required`);
        for (const f of ICON_FIELDS) if (ui[f] !== undefined) checkIcon(root, ui[f], `interface.${f}`, errors);
        for (const [i, s] of (ui.screenshots ?? []).entries()) checkRelPath(root, s, `interface.screenshots[${i}]`, errors);

        for (const f of ["displayName", "shortDescription", "longDescription"]) checkCopy(ui[f], `interface.${f}`, errors);
      }
    }
  }

  if (mcp) {
    if (mcp.$schema !== MCP_SCHEMA) errors.push(`mcp.json: $schema must be ${MCP_SCHEMA}`);
    const servers = Object.entries(mcp.mcpServers ?? {});
    if (servers.length !== 1) errors.push(`mcp.json: exactly one server required, found ${servers.length}`);
    for (const [name, s] of servers) {
      const label = `mcp.json: ${name}`;
      if (s.type !== "streamable-http") errors.push(`${label}: type must be streamable-http`);
      if (s.url !== MCP_URL) errors.push(`${label}: url must be ${MCP_URL}`);
      httpsUrl(s.url, `${label}.url`, errors);
      if (s.headers && Object.keys(s.headers).length) errors.push(`${label}: headers are not allowed`);
      if (s.command || s.args || s.env) errors.push(`${label}: local servers are not allowed`);
      const auth = s.extensions?.["com.openai"]?.auth;
      if (auth?.type !== "oauth") errors.push(`${label}: auth.type must be oauth`);
      if (auth?.client?.mode !== "cimd") errors.push(`${label}: auth.client.mode must be cimd`);
      if (auth?.client && ("clientId" in auth.client || "clientSecret" in auth.client))
        errors.push(`${label}: no client ID or secret allowed with cimd`);
    }
  }

  // Forbidden files anywhere in the repo that would ship or confuse the scan.
  if (fs.existsSync(path.join(root, ".app.json"))) errors.push(".app.json: not allowed");
  if (fs.existsSync(path.join(root, "hooks"))) errors.push("hooks/: lifecycle hooks are not allowed");

  const files = listPackageFiles(root);
  for (const f of files) {
    const base = path.posix.basename(f.rel);
    const ext = path.extname(base).toLowerCase();
    if (f.symlink) { errors.push(`${f.rel}: symlinks are not allowed`); continue; }
    if (base.startsWith(".") || base === "hooks.json" || base.endsWith(".app.json"))
      errors.push(`${f.rel}: file not allowed in the package`);
    else if (!ALLOWED_EXT.has(ext)) errors.push(`${f.rel}: file type ${ext} not allowed in the package`);
    if (/\s/.test(f.rel)) errors.push(`${f.rel}: file names must not contain spaces`);
    const buf = fs.readFileSync(path.join(root, f.rel));
    if (IMAGE_EXT.has(ext) && buf.length > MAX_IMAGE_BYTES) errors.push(`${f.rel}: image over 5 MiB`);
    if (!IMAGE_EXT.has(ext) || ext === ".svg") {
      const text = buf.toString("utf8");
      for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) errors.push(`${f.rel}: looks like it contains a secret (${what})`);
    }
  }

  // Skills: each needs a SKILL.md with name and description, and no billing links.
  const skillsDir = path.join(root, "skills");
  const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory()) : [];
  if (!skills.length) errors.push("skills/: at least one skill required");
  for (const d of skills) {
    const file = path.join(skillsDir, d, "SKILL.md");
    if (!fs.existsSync(file)) { errors.push(`skills/${d}: SKILL.md missing`); continue; }
    const md = fs.readFileSync(file, "utf8");
    const fm = frontmatter(md);
    if (!fm?.name || !fm?.description) errors.push(`skills/${d}/SKILL.md: frontmatter needs name and description`);
    if (/\/billing|\/pricing|\/checkout|top up/i.test(md)) errors.push(`skills/${d}/SKILL.md: must not link to billing, pricing or checkout`);
  }

  return errors;
}

// ---------- ZIP writer (deflate, fixed timestamps for reproducible builds) ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(entries) {
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(useDeflate ? 8 : 0, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ---------- CLI ----------

function main(argv) {
  const arg = (flag, def) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : def; };
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(arg("--root", path.join(here, "..")));
  const outDir = path.resolve(arg("--out", path.join(root, "dist")));

  const errors = check(root);
  if (errors.length) {
    console.error(`✖ ${errors.length} problem(s) in ${root}:`);
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
  const files = listPackageFiles(root);
  if (argv.includes("--check")) {
    console.log(`✔ Checks passed (${files.length} files, version ${manifest.version})`);
    return 0;
  }
  const buf = zip(files.map((f) => ({ name: f.rel, data: fs.readFileSync(path.join(root, f.rel)) })));
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${manifest.name}-openai-${manifest.version}.zip`);
  fs.writeFileSync(out, buf);
  console.log(`✔ Checks passed. Wrote ${path.relative(process.cwd(), out) || out} (${buf.length} bytes, ${files.length} files):`);
  for (const f of files) console.log(`  ${f.rel}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
