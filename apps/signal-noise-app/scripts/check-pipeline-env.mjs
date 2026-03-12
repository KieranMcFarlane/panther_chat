#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { config as loadDotEnv } from "dotenv";

const root = path.resolve(process.cwd());
const envPath = path.join(root, ".env");
const requiredPath = path.join(root, ".env.required");

loadDotEnv({ path: envPath });

function parseRequiredKeys(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0]?.trim())
    .filter(Boolean);
}

if (!fs.existsSync(requiredPath)) {
  console.error(`Missing required contract file: ${requiredPath}`);
  process.exit(1);
}

const keys = parseRequiredKeys(requiredPath);
const missing = [];
const empty = [];

for (const key of keys) {
  if (!(key in process.env)) {
    missing.push(key);
    continue;
  }
  const value = `${process.env[key] ?? ""}`.trim();
  if (!value) {
    empty.push(key);
  }
}

if (missing.length === 0 && empty.length === 0) {
  console.log("Pipeline env check passed.");
  console.log(`Validated ${keys.length} required variables from .env.required`);
  process.exit(0);
}

console.error("Pipeline env check failed.");
if (missing.length) {
  console.error(`Missing keys (${missing.length}):`);
  for (const key of missing) {
    console.error(`- ${key}`);
  }
}
if (empty.length) {
  console.error(`Empty keys (${empty.length}):`);
  for (const key of empty) {
    console.error(`- ${key}`);
  }
}
process.exit(2);
