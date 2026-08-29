import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePackDirectory } from "@peekling/cli";
import { PNG } from "pngjs";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const PACK_ID = /^[a-z][a-z0-9-]{1,63}$/;
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const ACCEPTED_LICENSES = new Set([
  "Apache-2.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
]);
const ROSTER_START = "<!-- COMMUNITY_ROSTER_START -->";
const ROSTER_END = "<!-- COMMUNITY_ROSTER_END -->";

function fail(message) {
  throw new Error(message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
}

function assertClosed(value, allowed, label) {
  assertRecord(value, label);
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) {
    fail(`${label} contains unexpected fields: ${unexpected.join(", ")}`);
  }
}

function assertString(value, label, minimum, maximum) {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`${label} must be ${minimum}-${maximum} visible characters`);
  }
}

function assertHttpsUrl(value, label) {
  assertString(value, label, 8, 500);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} must be a valid HTTPS URL`);
  }
  if (url.protocol !== "https:") fail(`${label} must be a valid HTTPS URL`);
}

export async function readJson(target, label = path.relative(ROOT, target)) {
  const text = await readFile(target, "utf8").catch(() => {
    fail(`${label} is missing`);
  });
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

export function validateRights(rights, label = "RIGHTS.json") {
  assertClosed(
    rights,
    ["$schema", "format", "creator", "artwork", "license", "statement"],
    label,
  );
  if (rights.$schema !== "../../schemas/rights.schema.json") {
    fail(`${label} must reference ../../schemas/rights.schema.json`);
  }
  if (rights.format !== 1) fail(`${label} format must be 1`);

  assertClosed(rights.creator, ["name", "github", "url"], `${label} creator`);
  assertString(rights.creator.name, `${label} creator.name`, 1, 120);
  if (
    typeof rights.creator.github !== "string" ||
    !GITHUB_LOGIN.test(rights.creator.github)
  ) {
    fail(`${label} creator.github must be a valid GitHub login`);
  }
  if (rights.creator.url !== undefined) {
    assertHttpsUrl(rights.creator.url, `${label} creator.url`);
  }

  assertClosed(
    rights.artwork,
    ["origin", "source", "generativeAI"],
    `${label} artwork`,
  );
  if (
    !["original", "commissioned", "adapted"].includes(rights.artwork.origin)
  ) {
    fail(`${label} artwork.origin must be original, commissioned, or adapted`);
  }
  assertString(rights.artwork.source, `${label} artwork.source`, 3, 500);
  if (rights.artwork.origin !== "original") {
    assertHttpsUrl(rights.artwork.source, `${label} artwork.source`);
  }

  const disclosure = rights.artwork.generativeAI;
  assertClosed(disclosure, ["used", "tools"], `${label} artwork.generativeAI`);
  if (typeof disclosure.used !== "boolean") {
    fail(`${label} artwork.generativeAI.used must be true or false`);
  }
  if (
    !Array.isArray(disclosure.tools) ||
    disclosure.tools.length > 10 ||
    disclosure.tools.some(
      (tool) =>
        typeof tool !== "string" || tool.length < 1 || tool.length > 100,
    )
  ) {
    fail(`${label} artwork.generativeAI.tools must list up to 10 tool names`);
  }
  if (disclosure.used !== disclosure.tools.length > 0) {
    fail(`${label} generativeAI.used and tools must agree`);
  }

  if (!ACCEPTED_LICENSES.has(rights.license)) {
    fail(`${label} uses a license that this collection does not accept`);
  }
  assertString(rights.statement, `${label} statement`, 40, 500);
  return rights;
}

function atlasSources(manifest, label) {
  const single = manifest.assets?.atlas;
  const variants = manifest.assets?.atlases?.variants;
  const sources = single
    ? [single.src]
    : Array.isArray(variants)
      ? variants.map((variant) => variant?.src)
      : [];
  if (sources.length < 1 || sources.length > 3) {
    fail(`${label} must reference one to three PNG atlases`);
  }
  for (const source of sources) {
    if (
      typeof source !== "string" ||
      path.basename(source) !== source ||
      !source.toLowerCase().endsWith(".png")
    ) {
      fail(`${label} atlas paths must be flat PNG filenames`);
    }
  }
  if (new Set(sources).size !== sources.length) {
    fail(`${label} repeats an atlas filename`);
  }
  return sources;
}

async function packFiles(root, id) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `peeklings/${id}/${entry.name}`;
    if (entry.isSymbolicLink()) fail(`${relative} must not be a symbolic link`);
    if (!entry.isFile()) fail(`${relative} must be a regular file`);
    files.push(entry.name);
  }
  return files.sort();
}

export async function listPackDirectories() {
  const root = path.join(ROOT, "peeklings");
  const entries = await readdir(root, { withFileTypes: true });
  const directories = [];
  for (const entry of entries) {
    if (entry.name === "README.md" && entry.isFile()) continue;
    if (entry.isSymbolicLink()) {
      fail(`peeklings/${entry.name} must not be a symbolic link`);
    }
    if (!entry.isDirectory()) {
      fail(`peeklings/${entry.name} does not belong beside Pack directories`);
    }
    if (!PACK_ID.test(entry.name)) {
      fail(`peeklings/${entry.name} must use a lowercase Pack ID`);
    }
    directories.push(entry.name);
  }
  return directories.sort((left, right) => left.localeCompare(right, "en"));
}

export async function validateCommunityPack(root, reserved = new Set()) {
  const id = path.basename(root);
  const label = `peeklings/${id}`;
  if (!PACK_ID.test(id)) fail(`${label} must use a lowercase Pack ID`);
  if (reserved.has(id)) fail(`${label} uses an official reserved identifier`);

  const info = await lstat(root);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    fail(`${label} must be a real directory`);
  }

  const manifest = await readJson(
    path.join(root, "character.json"),
    `${label}/character.json`,
  );
  const rights = validateRights(
    await readJson(path.join(root, "RIGHTS.json"), `${label}/RIGHTS.json`),
    `${label}/RIGHTS.json`,
  );
  const sources = atlasSources(manifest, `${label}/character.json`);
  const required = [
    "character.json",
    ...sources,
    "thumbnail.png",
    "README.md",
    "LICENSE",
    "RIGHTS.json",
    ...(manifest.license === "Apache-2.0" ? ["NOTICE"] : []),
  ].sort();
  const allowed = new Set([...required, "NOTICE"]);
  const files = await packFiles(root, id);

  for (const file of required) {
    if (!files.includes(file)) fail(`${label} is missing ${file}`);
  }
  const unexpected = files.filter((file) => !allowed.has(file));
  if (unexpected.length) {
    fail(
      `${label} contains files outside the community boundary: ${unexpected.join(", ")}`,
    );
  }

  const result = await validatePackDirectory(root).catch((error) => {
    fail(`${label} failed the Peekling Pack validator: ${error.message}`);
  });
  if (manifest.name !== id || result.name !== id) {
    fail(`${label} and character.json must use the same ID`);
  }
  if (!isRecord(manifest.metadata)) {
    fail(`${label}/character.json metadata is required`);
  }
  for (const [field, maximum] of [
    ["title", 120],
    ["author", 120],
    ["description", 500],
  ]) {
    assertString(
      manifest.metadata[field],
      `${label}/character.json metadata.${field}`,
      1,
      maximum,
    );
  }
  if (manifest.metadata.author !== rights.creator.name) {
    fail(`${label} manifest author and RIGHTS.json creator.name must match`);
  }
  if (manifest.license !== rights.license) {
    fail(`${label} manifest and RIGHTS.json licenses must match`);
  }

  const thumbnailBytes = await readFile(path.join(root, "thumbnail.png"));
  if (thumbnailBytes.length > 512 * 1024) {
    fail(`${label}/thumbnail.png exceeds 512 KiB`);
  }
  let thumbnail;
  try {
    thumbnail = PNG.sync.read(thumbnailBytes);
  } catch {
    fail(`${label}/thumbnail.png is not a valid PNG`);
  }
  if (thumbnail.width !== 64 || thumbnail.height !== 64) {
    fail(`${label}/thumbnail.png must be 64 by 64 pixels`);
  }

  const readme = await readFile(path.join(root, "README.md"), "utf8");
  if (!readme.startsWith(`# ${manifest.metadata.title}\n`)) {
    fail(`${label}/README.md must begin with the character display name`);
  }
  if (!/^## License$/m.test(readme)) {
    fail(`${label}/README.md must include a License section`);
  }
  const licenseText = await readFile(path.join(root, "LICENSE"), "utf8");
  if (licenseText.trim().length < 100) {
    fail(`${label}/LICENSE must contain the full license text`);
  }

  return {
    id,
    title: manifest.metadata.title,
    description: manifest.metadata.description,
    creator: rights.creator.name,
    github: rights.creator.github,
    version: manifest.version,
    license: manifest.license,
    path: `peeklings/${id}`,
    thumbnail: `peeklings/${id}/thumbnail.png`,
  };
}

export function createCatalog(peeklings) {
  return {
    $schema: "./schemas/catalog.schema.json",
    format: 1,
    repository: "https://github.com/peekling/awesome-peeklings",
    peeklings,
  };
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderRoster(peeklings) {
  if (!peeklings.length) {
    return "No community Peeklings have been accepted yet. The first one could be yours. Read [how to contribute a Pack](CONTRIBUTING.md) when you are ready.";
  }
  const rows = [
    "| Preview | Peekling | Creator | Description | Version | License |",
    "| :---: | --- | --- | --- | --- | --- |",
  ];
  for (const peekling of peeklings) {
    rows.push(
      `| ![${escapeCell(peekling.title)}](${peekling.thumbnail}) | [${escapeCell(peekling.title)}](${peekling.path}) | [${escapeCell(peekling.creator)}](https://github.com/${peekling.github}) | ${escapeCell(peekling.description)} | \`${peekling.version}\` | \`${peekling.license}\` |`,
    );
  }
  return rows.join("\n");
}

export function withRoster(readme, peeklings) {
  const start = readme.indexOf(ROSTER_START);
  const end = readme.indexOf(ROSTER_END);
  if (start < 0 || end < 0 || end <= start) {
    fail("README.md is missing the community roster markers");
  }
  const before = readme.slice(0, start + ROSTER_START.length);
  const after = readme.slice(end);
  return `${before}\n\n${renderRoster(peeklings)}\n${after}`;
}

export async function collectPeeklings() {
  const reservedRecord = await readJson(
    path.join(ROOT, "reserved-identifiers.json"),
    "reserved-identifiers.json",
  );
  if (
    !isRecord(reservedRecord) ||
    !Array.isArray(reservedRecord.identifiers) ||
    reservedRecord.identifiers.some(
      (id) => typeof id !== "string" || !PACK_ID.test(id),
    )
  ) {
    fail("reserved-identifiers.json contains an invalid identifier list");
  }
  const sorted = [...reservedRecord.identifiers].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (
    new Set(sorted).size !== sorted.length ||
    JSON.stringify(sorted) !== JSON.stringify(reservedRecord.identifiers)
  ) {
    fail("reserved-identifiers.json identifiers must be unique and sorted");
  }
  const reserved = new Set(sorted);
  const directories = await listPackDirectories();
  const peeklings = [];
  for (const id of directories) {
    peeklings.push(
      await validateCommunityPack(path.join(ROOT, "peeklings", id), reserved),
    );
  }
  return peeklings;
}
