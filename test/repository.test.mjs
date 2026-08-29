import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createPack } from "@peekling/cli";
import { PNG } from "pngjs";

import { validateCommunityPack, validateRights } from "../scripts/lib.mjs";

function rights(overrides = {}) {
  return {
    $schema: "../../schemas/rights.schema.json",
    format: 1,
    creator: {
      name: "Example Artist",
      github: "example-artist",
    },
    artwork: {
      origin: "original",
      source: "Created by the named artist for this validator fixture.",
      generativeAI: {
        used: false,
        tools: [],
      },
    },
    license: "CC0-1.0",
    statement:
      "I created or control this fixture artwork and may redistribute it under the declared license.",
    ...overrides,
  };
}

async function validFixture() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "awesome-peeklings-"));
  const root = path.join(temporary, "sample");
  await createPack(root, "sample");
  await unlink(path.join(root, "PROVENANCE.md"));

  const manifestPath = path.join(root, "character.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.metadata.title = "Sample";
  manifest.metadata.author = "Example Artist";
  manifest.metadata.description =
    "A small synthetic character used to test community validation.";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const thumbnail = new PNG({ width: 64, height: 64 });
  thumbnail.data.fill(255);
  await writeFile(path.join(root, "thumbnail.png"), PNG.sync.write(thumbnail));
  await writeFile(
    path.join(root, "README.md"),
    "# Sample\n\nA synthetic Pack used only by the repository test suite.\n\n## License\n\nThe test artwork is available under CC0-1.0.\n",
  );
  await writeFile(
    path.join(root, "RIGHTS.json"),
    `${JSON.stringify(rights(), null, 2)}\n`,
  );
  return { root, temporary };
}

test("accepts a complete data-only community Pack", async () => {
  const fixture = await validFixture();
  try {
    const entry = await validateCommunityPack(fixture.root);
    assert.equal(entry.id, "sample");
    assert.equal(entry.creator, "Example Artist");
    assert.equal(entry.license, "CC0-1.0");
  } finally {
    await rm(fixture.temporary, { recursive: true, force: true });
  }
});

test("rejects a file outside the data-only boundary", async () => {
  const fixture = await validFixture();
  try {
    await writeFile(
      path.join(fixture.root, "surprise.js"),
      "export default true;\n",
    );
    await assert.rejects(
      validateCommunityPack(fixture.root),
      /outside the community boundary/,
    );
  } finally {
    await rm(fixture.temporary, { recursive: true, force: true });
  }
});

test("requires a consistent generative-tool disclosure", () => {
  const record = rights();
  record.artwork.generativeAI.used = true;
  assert.throws(
    () => validateRights(record),
    /generativeAI.used and tools must agree/,
  );
});
