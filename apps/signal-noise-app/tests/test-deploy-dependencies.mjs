import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJsonPath = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

test("better-auth deploy dependency versions are compatible", () => {
  assert.equal(
    packageJson.dependencies["better-auth"],
    "^1.4.19",
    "Test assumes the current Better Auth version",
  );

  assert.equal(
    packageJson.dependencies["better-sqlite3"],
    "^12.0.0",
    "better-sqlite3 should satisfy Better Auth's deploy-time peer expectation",
  );

  assert.equal(
    packageJson.dependencies["kysely"],
    "^0.28.8",
    "kysely should be present for Better Auth Postgres storage",
  );

  assert.equal(
    packageJson.dependencies["pg"],
    "^8.16.3",
    "pg should be present for Better Auth Postgres storage",
  );
});
