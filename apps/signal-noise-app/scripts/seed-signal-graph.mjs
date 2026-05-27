import { readFile } from "node:fs/promises";
import path from "node:path";

const seedPath = process.env.SIGNAL_GRAPH_SEED_PATH ?? path.join(process.cwd(), "data", "signal-graph-seed.json");
const apiUrl = process.env.SIGNAL_GRAPH_API_URL ?? "http://127.0.0.1:8810";

const seed = JSON.parse(await readFile(seedPath, "utf8"));

const response = await fetch(`${apiUrl}/graph/upsert`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(seed),
});

if (!response.ok) {
  throw new Error(`Seed failed with ${response.status}: ${await response.text()}`);
}

const result = await response.json();
console.log(JSON.stringify(result, null, 2));
