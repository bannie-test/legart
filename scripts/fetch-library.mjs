#!/usr/bin/env node
/**
 * Downloads the 20 public-domain library paintings from Wikimedia Commons and writes
 * public/library/<id>.jpg (max 1600 px) and <id>.thumb.jpg (480 px).
 *
 * - Files already present in public/library are skipped (use --force to redo).
 * - A file in library-src/<id>.(jpg|jpeg|png|webp) is used instead of downloading.
 * - If the exact Commons file name fails, the script falls back to a Commons search.
 *
 * Usage: node scripts/fetch-library.mjs [--force] [--strict]
 *   --strict  exit with code 1 if any painting could not be fetched
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "library");
const srcDir = path.join(root, "library-src");
const force = process.argv.includes("--force");
const strict = process.argv.includes("--strict");
const UA = "LegartLibraryFetcher/1.0 (self-hosted puzzle game; contact: site owner)";

async function readManifest() {
  const ts = await fs.readFile(path.join(root, "src", "content", "artworks.ts"), "utf8");
  const items = [];
  const re = /id: "([a-z0-9-]+)",\s*\n\s*title: l\("((?:[^"\\]|\\.)*)"[\s\S]*?artist: "((?:[^"\\]|\\.)*)"[\s\S]*?commons: "((?:[^"\\]|\\.)*)"/g;
  for (const m of ts.matchAll(re)) {
    items.push({ id: m[1], title: JSON.parse(`"${m[2]}"`), artist: JSON.parse(`"${m[3]}"`), commons: JSON.parse(`"${m[4]}"`) });
  }
  return items;
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
  return Buffer.from(await res.arrayBuffer());
}

async function searchCommons(query) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.search = new URLSearchParams({
    action: "query", format: "json", list: "search", srnamespace: "6", srlimit: "5",
    srsearch: `${query} filetype:bitmap`,
  }).toString();
  const res = await fetch(u, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json = await res.json();
  return (json.query?.search ?? []).map((r) => r.title.replace(/^File:/, ""));
}

const filePathUrl = (name) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1600`;

async function fetchOne(item) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const local = path.join(srcDir, `${item.id}.${ext}`);
    if (await exists(local)) return { buf: await fs.readFile(local), from: path.relative(root, local) };
  }
  try {
    return { buf: await download(filePathUrl(item.commons)), from: item.commons };
  } catch (err) {
    console.warn(`  ! ${item.commons}: ${err.message}; searching Commons…`);
  }
  for (const name of await searchCommons(`${item.title} ${item.artist}`)) {
    try {
      return { buf: await download(filePathUrl(name)), from: name };
    } catch {
      /* try next */
    }
  }
  throw new Error("no usable image found");
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const items = await readManifest();
  if (items.length === 0) throw new Error("could not read src/content/artworks.ts");
  const credits = {};
  let failed = 0;
  for (const item of items) {
    const out = path.join(outDir, `${item.id}.jpg`);
    const thumb = path.join(outDir, `${item.id}.thumb.jpg`);
    if (!force && (await exists(out)) && (await exists(thumb))) {
      console.log(`= ${item.id} (already present)`);
      continue;
    }
    try {
      const { buf, from } = await fetchOne(item);
      await sharp(buf).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toFile(out);
      await sharp(buf).rotate().resize(480, 480, { fit: "inside" }).jpeg({ quality: 78, mozjpeg: true }).toFile(thumb);
      credits[item.id] = from;
      console.log(`✓ ${item.id} <- ${from}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${item.id}: ${err.message}`);
    }
  }
  if (Object.keys(credits).length) {
    const creditsFile = path.join(outDir, "sources.json");
    const prev = (await exists(creditsFile)) ? JSON.parse(await fs.readFile(creditsFile, "utf8")) : {};
    await fs.writeFile(creditsFile, JSON.stringify({ ...prev, ...credits }, null, 2));
  }
  console.log(`\nDone: ${items.length - failed}/${items.length} paintings available in public/library.`);
  if (failed && strict) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
