import { execFileSync } from "node:child_process";

const [base, head] = process.argv.slice(2);
if (
  !/^[0-9a-f]{40}$/i.test(base ?? "") ||
  !/^[0-9a-f]{40}$/i.test(head ?? "")
) {
  throw new Error("Usage: npm run pr:check -- <base-sha> <head-sha>");
}

const output = execFileSync(
  "git",
  ["diff", "--name-status", "--find-renames", base, head],
  { encoding: "utf8" },
).trim();
const changed = output
  ? output.split("\n").flatMap((line) => line.split("\t").slice(1))
  : [];
const packIds = new Set();

for (const file of changed) {
  const parts = file.split("/");
  if (parts[0] === "peeklings" && parts.length > 2) packIds.add(parts[1]);
}

if (packIds.size > 1) {
  throw new Error(
    `A pull request may change one Peekling Pack, found: ${[...packIds].sort().join(", ")}`,
  );
}

if (packIds.size === 1) {
  const allowedRootFiles = new Set(["README.md", "catalog.json"]);
  const id = [...packIds][0];
  const unrelated = changed.filter(
    (file) =>
      !file.startsWith(`peeklings/${id}/`) && !allowedRootFiles.has(file),
  );
  if (unrelated.length) {
    throw new Error(
      `A Pack pull request cannot change policy, checks, or dependencies: ${unrelated.join(", ")}`,
    );
  }
  console.log(`Pull request scope is limited to community Pack ${id}.`);
} else {
  console.log("Pull request does not change a community Pack.");
}
