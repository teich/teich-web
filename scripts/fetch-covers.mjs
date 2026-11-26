// Fetches a cover for every book in content/reading-list.ts that doesn't have
// one yet, and writes content/covers.json (size, spine colour, page count).
//
//   npm run covers            fetch whatever is missing
//   npm run covers -- --force refetch everything
//
// Covers come from Apple Books (high resolution) with Open Library as the
// fallback; page counts come from Open Library. When the wrong edition turns
// up, pin one in content/cover-sources.json:
//   { "<slug>": { "url": "https://…" } }     any image
//   { "<slug>": { "isbn": "978…" } }         Open Library by ISBN
//   { "<slug>": { "id": 12345 } }            Open Library cover id
//   { "<slug>": { "pages": 320 } }           page count (sets the thickness)

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { books, slugForBook } from "../content/reading-list.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coverDir = path.join(root, "public", "covers");
const manifestPath = path.join(root, "content", "covers.json");
const sourcesPath = path.join(root, "content", "cover-sources.json");
const force = process.argv.includes("--force");
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);

const headers = { "User-Agent": "Mozilla/5.0 (reading-list-cover-fetcher)" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function search(book) {
  const params = new URLSearchParams({
    title: book.title.split(":")[0],
    author: book.author.replace(/\b[A-Z]\. ?/g, "").trim(),
    fields: "key,title,author_name,cover_i,number_of_pages_median,edition_count",
    limit: "8",
  });
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers,
  });
  if (!response.ok) throw new Error(`search ${response.status}`);
  const { docs } = await response.json();
  // Most-published work with a cover is nearly always the right one.
  return docs
    .filter((doc) => doc.cover_i)
    .sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0))[0];
}

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function appleBooks(book) {
  const title = normalize(book.title.split(":")[0]);
  const surname = normalize(book.author).split(" ").at(-1);
  const params = new URLSearchParams({
    term: `${book.title.split(":")[0]} ${book.author}`,
    media: "ebook",
    entity: "ebook",
    country: "us",
    limit: "12",
  });
  let response = await fetch(`https://itunes.apple.com/search?${params}`, { headers });
  if (!response.ok) {
    // Apple rate-limits bursts; one patient retry is usually enough.
    await sleep(8000);
    response = await fetch(`https://itunes.apple.com/search?${params}`, { headers });
  }
  if (!response.ok) return undefined;
  const { results } = await response.json();
  const match = results.find(
    (result) =>
      normalize(result.trackName ?? "").startsWith(title) &&
      normalize(result.artistName ?? "").includes(surname),
  );
  return match?.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/1400x1400bb.");
}

async function download(url) {
  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 2000) throw new Error(`placeholder image at ${url}`);
  return buffer;
}

function hex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

async function process_(buffer, file) {
  const image = sharp(buffer).rotate();
  const resized = await image
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  await writeFile(file, resized.data);

  // Spine colour: average of the cover's left edge, so the spine reads as a
  // continuation of the jacket.
  const { width, height } = resized.info;
  const strip = await sharp(resized.data)
    .extract({ left: 0, top: 0, width: Math.max(4, Math.round(width * 0.08)), height })
    .resize(1, 1, { fit: "fill" })
    .raw()
    .toBuffer();
  return { w: width, h: height, color: hex([strip[0], strip[1], strip[2]]) };
}

await mkdir(coverDir, { recursive: true });
const manifest = await readJson(manifestPath, {});
const sources = await readJson(sourcesPath, {});
const missing = [];

for (const book of books) {
  const slug = slugForBook(book);
  if (only && slug !== only) continue;
  const file = path.join(coverDir, `${slug}.jpg`);
  if (!force && !only && manifest[slug] && existsSync(file)) continue;

  try {
    const source = sources[slug] ?? {};
    let url = source.url;
    let pages = source.pages ?? manifest[slug]?.pages;
    if (!url && source.id) url = `https://covers.openlibrary.org/b/id/${source.id}-L.jpg`;
    if (!url && source.isbn)
      url = `https://covers.openlibrary.org/b/isbn/${source.isbn}-L.jpg?default=false`;
    let origin = url ? "pinned" : "";
    if (!url) {
      url = await appleBooks(book);
      if (url) origin = "apple";
    }
    if (!url || !pages) {
      const doc = await search(book).catch(() => undefined);
      pages ??= doc?.number_of_pages_median;
      if (!url && doc) {
        url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        origin = "openlibrary";
      }
    }
    if (!url) throw new Error("no cover found");

    const info = await process_(await download(url), file);
    info.origin = origin;
    const { origin: from, ...entry } = info;
    manifest[slug] = { ...entry, ...(pages ? { pages } : {}) };
    console.log(`✓ ${book.title}  ${info.w}×${info.h}  ${pages ?? "?"}pp  (${from})`);
  } catch (error) {
    missing.push(book.title);
    console.log(`✗ ${book.title}: ${error.message}`);
  }
  await sleep(350);
}

const sorted = Object.fromEntries(
  Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
);
await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`);

if (missing.length) {
  console.log(`\nNo cover for: ${missing.join(", ")}`);
  console.log("These render with a typeset cloth cover until one is added.");
}
