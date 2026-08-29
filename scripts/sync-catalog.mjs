import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ROOT, collectPeeklings, createCatalog, withRoster } from "./lib.mjs";

const peeklings = await collectPeeklings();
await writeFile(
  path.join(ROOT, "catalog.json"),
  `${JSON.stringify(createCatalog(peeklings), null, 2)}\n`,
);

const readmePath = path.join(ROOT, "README.md");
const readme = await readFile(readmePath, "utf8");
await writeFile(readmePath, withRoster(readme, peeklings));

console.log(
  `Updated the catalog and gallery for ${peeklings.length} Pack${peeklings.length === 1 ? "" : "s"}.`,
);
