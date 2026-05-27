import { readFile } from "node:fs/promises";

const apiUrl = process.env.SIGNAL_GRAPH_API_URL ?? "http://127.0.0.1:8810";
const question =
  process.argv.find((arg) => arg.startsWith("--query="))?.slice("--query=".length) ??
  "Find warm opportunities around clubs with tender activity where we know someone connected";
const shouldWriteTwenty = process.argv.includes("--write-twenty");

async function loadDotEnv() {
  const text = await readFile(".env", "utf8").catch(() => "");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function splitName(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Unknown",
    lastName: parts.slice(1).join(" "),
  };
}

function recommendationFromContext(context) {
  const warm = context.warmOpportunities?.[0];
  if (!warm) {
    return {
      title: "No warm graph opportunity found",
      nextAction: "Add more relationship data or broaden the query.",
      markdown: `No warm opportunity was found for: ${question}`,
    };
  }

  const markdown = [
    `Warm opportunity: ${warm.company} x ${warm.club}`,
    "",
    `- Known person: ${warm.person}`,
    `- Open activity: ${warm.tender}`,
    `- Tender status: ${warm.status}`,
    `- Last interaction: ${warm.lastInteraction ?? "unknown"}`,
    "",
    "Suggested next action: prepare a short follow-up referencing the club relationship and the open tender activity.",
  ].join("\n");

  return {
    title: `Warm opportunity: ${warm.company}`,
    person: warm.person,
    company: warm.company,
    nextAction: "Follow up through the known contact with tender-specific context.",
    markdown,
  };
}

async function createTwentyPersonWithNote(recommendation) {
  await loadDotEnv();
  const baseUrl = (process.env.TWENTY_BASE_URL ?? "http://127.0.0.1:3010").replace(/\/$/, "");
  const token = process.env.TWENTY_API_TOKEN ?? "";
  if (!token) throw new Error("TWENTY_API_TOKEN is not set");

  const { firstName, lastName } = splitName(recommendation.person);
  const personResponse = await fetch(`${baseUrl}/rest/people`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: { firstName, lastName },
    }),
  });

  if (!personResponse.ok) {
    throw new Error(`Twenty person create failed ${personResponse.status}: ${await personResponse.text()}`);
  }

  const personPayload = await personResponse.json().catch(() => null);
  const personId = personPayload?.data?.createPerson?.id ?? personPayload?.data?.id ?? personPayload?.id;
  if (!personId) throw new Error("Twenty did not return a person id");

  const noteResponse = await fetch(`${baseUrl}/rest/notes`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: recommendation.title,
      bodyV2: {
        markdown: recommendation.markdown,
        blocknote: "",
      },
    }),
  });

  if (!noteResponse.ok) {
    throw new Error(`Twenty note create failed ${noteResponse.status}: ${await noteResponse.text()}`);
  }

  const notePayload = await noteResponse.json().catch(() => null);
  const noteId = notePayload?.data?.createNote?.id ?? notePayload?.data?.id ?? notePayload?.id;

  if (noteId) {
    await fetch(`${baseUrl}/rest/noteTargets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ noteId, targetPersonId: personId }),
    }).catch(() => undefined);
  }

  return { personId, noteId };
}

const contextResponse = await fetch(`${apiUrl}/graph/context`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: question, limit: 5 }),
});

if (!contextResponse.ok) {
  throw new Error(`Graph context failed ${contextResponse.status}: ${await contextResponse.text()}`);
}

const context = await contextResponse.json();
const recommendation = recommendationFromContext(context);

console.log(recommendation.markdown);

if (shouldWriteTwenty) {
  const crm = await createTwentyPersonWithNote(recommendation);
  console.log("\nTwenty write:");
  console.log(JSON.stringify(crm, null, 2));
} else {
  console.log("\nDry run only. Re-run with --write-twenty to create a Twenty person + note.");
}
