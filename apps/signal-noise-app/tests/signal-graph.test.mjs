import assert from "node:assert/strict";
import test from "node:test";

const SERVICE_URL = process.env.SIGNAL_GRAPH_TEST_URL ?? "http://127.0.0.1:8810";

async function post(path, body) {
  const response = await fetch(`${SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  assert.equal(response.status, 200);
  return response.json();
}

test("signal graph service is healthy and seeded", async () => {
  const response = await fetch(`${SERVICE_URL}/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.status, "healthy");
  assert.equal(health.graph, "signal_noise_poc");
  assert.ok(health.nodes >= 10);
});

test("graph search finds tender and opportunity context", async () => {
  const result = await post("/graph/search", {
    query: "Northstar club tender",
    limit: 5,
  });

  assert.equal(result.results[0].label, "Opportunity");
  assert.equal(result.results[0].id, "opportunity:northstar-clubhouse-upgrade");
  assert.ok(result.results.some((item) => item.id === "tender:clubhouse-energy-upgrade"));
});

test("graph context returns warm relationship intelligence", async () => {
  const result = await post("/graph/context", {
    query: "Find warm opportunities around clubs with tender activity where we know someone connected",
    limit: 5,
  });

  assert.ok(result.seeds.some((item) => item.id === "opportunity:northstar-clubhouse-upgrade"));
  assert.ok(result.relationships.some((item) => item.type === "WORKS_WITH"));
  assert.ok(result.relationships.some((item) => item.type === "HAS_TENDER"));
  assert.deepEqual(result.warmOpportunities[0], {
    person: "Alex Rivera",
    company: "Northstar Facilities",
    club: "Warwickshire Athletic Club",
    tender: "Clubhouse Energy Upgrade Tender",
    status: "open",
    lastInteraction: "2026-02-12",
  });
});
