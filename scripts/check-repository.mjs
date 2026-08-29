import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  ROOT,
  collectPeeklings,
  createCatalog,
  readJson,
  withRoster,
} from "./lib.mjs";

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function checkNoLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    const info = await lstat(target);
    const relative = path.relative(ROOT, target);
    if (info.isSymbolicLink())
      failures.push(`${relative} must not be a symbolic link`);
    else if (info.isDirectory()) await checkNoLinks(target);
  }
}

async function checkMarkdown(target) {
  const relative = path.relative(ROOT, target);
  const text = await readFile(target, "utf8");
  check(!/[—–]/.test(text), `${relative} contains a long dash`);
  check(!text.includes(";"), `${relative} contains a semicolon`);

  const link = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(link)) {
    const destination = match[1]
      .trim()
      .replace(/^<|>$/g, "")
      .split(/\s+['\"]/)[0];
    if (
      !destination ||
      destination.startsWith("#") ||
      /^(?:https?:|mailto:)/.test(destination)
    ) {
      continue;
    }
    const pathname = decodeURIComponent(destination.split("#")[0]);
    if (!pathname) continue;
    const resolved = path.resolve(path.dirname(target), pathname);
    await lstat(resolved).catch(() => {
      failures.push(`${relative} links to missing ${destination}`);
    });
  }
}

await checkNoLinks(ROOT);

const packageManifest = await readJson(path.join(ROOT, "package.json"));
check(
  packageManifest.private === true,
  "package.json must keep the repository private from npm",
);
check(
  packageManifest.scripts?.prepublishOnly?.includes("not publishable"),
  "package.json must refuse root publication",
);

let peeklings = [];
try {
  peeklings = await collectPeeklings();
} catch (error) {
  failures.push(error.message);
}

const expectedCatalog = `${JSON.stringify(createCatalog(peeklings), null, 2)}\n`;
const catalogText = await readFile(path.join(ROOT, "catalog.json"), "utf8");
check(
  catalogText === expectedCatalog,
  "catalog.json is stale, run npm run sync",
);

const readmePath = path.join(ROOT, "README.md");
const readme = await readFile(readmePath, "utf8");
let expectedReadme = readme;
try {
  expectedReadme = withRoster(readme, peeklings);
} catch (error) {
  failures.push(error.message);
}
check(
  readme === expectedReadme,
  "README.md gallery is stale, run npm run sync",
);
check(
  readme.includes(
    "https://cdn.peekling.com/v1/community/peekling-community-banner.png",
  ),
  "README.md must use the shared CDN banner",
);
check(
  readme.includes(
    "https://cdn.peekling.com/v1/community/peekling-ground-footer-v1.png",
  ),
  "README.md must use the shared CDN footer",
);

for (const relative of [
  "AGENTS.md",
  "CODE_OF_CONDUCT.md",
  "COMMUNITY_GUIDELINES.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  "peeklings/README.md",
  ".github/pull_request_template.md",
]) {
  await checkMarkdown(path.join(ROOT, relative));
}

if (failures.length) {
  throw new Error(failures.join("\n"));
}

console.log(
  `Community repository checks passed for ${peeklings.length} Pack${peeklings.length === 1 ? "" : "s"}.`,
);
