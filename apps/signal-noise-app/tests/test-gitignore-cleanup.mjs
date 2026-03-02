import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gitignorePath = new URL("../.gitignore", import.meta.url);
const gitignore = readFileSync(gitignorePath, "utf8");

test("app gitignore excludes local runtime data and generated dossier artifacts", () => {
  const expectedPatterns = [
    ".data/",
    ".next/",
    "tsconfig.tsbuildinfo",
    "backend/data/dossiers/",
    "data/dossiers/",
    "docs/data/demo_steps/",
    "docs/data/end_to_end_results.json",
    "end_to_end_demo_results.json",
  ];

  for (const pattern of expectedPatterns) {
    assert.match(
      gitignore,
      new RegExp(`(^|\\n)${pattern.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\n|$)`),
      `Expected .gitignore to contain ${pattern}`,
    );
  }
});
