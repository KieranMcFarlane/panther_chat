Nice — I’ve captured the product requirement and converted it into a complete, handoff-ready plan your coding model (or engineering team) can implement immediately.

Below you’ll find:

1. A high level summary of the feature you asked for.
2. The architecture & event flow (webhooks → Bright Data scraper → Claude Agent SDK headless reasoning/batch).
3. Data model (Neo4j + Supabase schemas + Redis keys).
4. The agent pipeline (subagents, MCPs, prompts, streaming shapes).
5. Scoring rubric & how to compute a club “opportunity score” and relative connection score.
6. Output format (CopilotKit-friendly hierarchical Markdown + streaming trace conventions).
7. Security & privacy considerations.
8. A ready-to-run FastAPI webhook handler + agent trigger example and a Claude subagent YAML.
9. A prioritized, granular TODO list you can hand to your coding model.

I kept everything concrete (code, JSON shapes, SQL) so it’s immediately actionable.

---

# 1 — Feature summary (single sentence)

For each club/entity we produce a live dossier that contains: context, star players, persons-of-interest (POI) with connection paths to your team, likely email/contactability, opportunity signals (live from Bright Data webhooks + batch enrichments), and an **opportunity + connection score** — all generated and updated by headless Claude Agent SDK agents and streamed into CopilotKit as tokenized reasoning traces + final formatted markdown dossier.

---

# 2 — Architecture & event flow (concise)

1. **Scraper / Bright Data watcher** detects events (funding, job changes, tenders, news, contract notices) → sends webhook to your FastAPI `/webhook/brightdata`.
2. **FastAPI Webhook Receiver**

   * Normalize payload → create `event` record in Supabase.
   * Update Neo4j graph (MERGE nodes/edges).
   * Enqueue a targeted agent job: `agent_queue.enqueue({entity_id, event_id, trigger_type=webhook})`.
3. **Job Worker(s) / Worker Pool**

   * Dequeue job → spin up or reuse `Claude Agent SDK` headless agent for owner user/team.
   * Agent uses **MCP** to fetch context: Neo4j relationships, Supabase event history, cached company crawl results, LinkedIn-like enrichment (email guesser), and optionally Perplexity-like deep research (MCP).
   * Agent performs agentic loop: gather context → run tools (grep/webfetch) → compute scores → produce markdown dossier and list of POIs + connection paths + likely contact methods.
   * Agent streams tokenized thoughts + tool use events back to FastAPI which forwards to CopilotKit frontend (SSE/WebSocket).
4. **Frontend (CopilotKit)**

   * Renders streaming trace (inner monologue & tool calls) in faded text and final structured dossier in hierarchical markdown.
   * Allows user to pin dossiers, request refresh, or request a manual deep-dive.
5. **Batch Enrichment**

   * Nightly/low-priority job processes entities not recently updated — same agent pipeline but in batch mode to create/refresh dossiers.

---

# 3 — Data model

### Supabase (relational) — simplified SQL

```sql
-- events from BrightData
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  source_id text,
  entity_id text,
  event_type text,
  payload jsonb,
  received_at timestamptz DEFAULT now()
);

-- chat / stream logs
CREATE TABLE chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text,
  user_id text,
  type text, -- 'thinking','tool','markdown'
  content text,
  timestamp timestamptz DEFAULT now()
);

-- pinned dossiers
CREATE TABLE dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text,
  title text,
  content text, -- markdown
  created_by text,
  created_at timestamptz DEFAULT now()
);
```

### Neo4j graph model (nodes & relationships)

```
(:Entity {entity_id, name, industry, sector, url, country})
(:Person {person_id, name, role, profile_url, email_guess, score})
(:Club {club_id, name, league, url})
(:TeamMember {user_id, name, role, email})
-- Relationships:
(:Person)-[:WORKED_AT {from,to}]->(:Entity)
(:Person)-[:CONNECTED_TO {strength:int}]->(:Person)
(:Entity)-[:ASSOCIATED_WITH]->(:Club)
(:Person)-[:LINKED_TO_TEAM {via, strength}]->(:TeamMember)
```

### Redis keys (session & queues)

```
session:{userId} => {workspace, agent_pid, last_active}
agent_queue (list) => job payloads
locks:entity:{entity_id} => lock TTL during processing
```

---

# 4 — Agent pipeline & tooling

## Subagents & MCPs

* **Subagents**

  * `entity-dossier` — orchestrates the dossier creation
  * `poi-finder` — extracts persons-of-interest and ranks them
  * `email-connector` — performs email guessing and best-channel inference
  * `opportunity-scorer` — calculates OpportunityScore & ConnectionScore
* **MCPs (Model Context Protocol servers)**

  * `neo4j-mcp` — fast graph queries
  * `supabase-mcp` — logs and dossier history
  * `perplexity-mcp` — external deep research (optional)
  * `email-verifier-mcp` — domain heuristics, smtp check (if used)

## Tools allowed to agent (least-privilege)

`Read`, `Grep`, `WebFetch`, `MCP__neo4j__query`, `MCP__supabase__query`, `mcp__email_verifier__guess`, `Write` (Write only when user approves edits)

## Agentic loop (structured)

1. **Summarize Trigger** — read incoming webhook and identify entity_id.
2. **Collect Context (MCP calls)** — Neo4j: relation paths; Supabase: event history; WebFetch: company site, news.
3. **Run POI Finder** — discover people (executives, influencers, board) from corp pages, LinkedIn-like profiles in scraped data, news mentions.
4. **Map Connection Paths** — find shortest path in Neo4j between team members and each POI (use Dijkstra-like traversal with `strength` weights).
5. **Email Guessing** — apply domain patterns `{first}.{last}@domain` etc. Rate-limit verification calls.
6. **Compute Scores** (details next).
7. **Draft Markdown** — produce final dossier + list of contact points + recommended action.
8. **Emit streaming events** — emit `thinking`, `tool_use`, `observation`, and final `markdown`.
9. **Persist** final markdown to Supabase + attach summary to Neo4j as node property (last_enrichment_at).

---

# 5 — Scoring: OpportunityScore & ConnectionScore

## Inputs

* `signal_strength` (from event): severity/importance (e.g., Series B funding = 10, job change senior hire = 4)
* `recency` (time decay): newer events weigh more (exponential decay)
* `relevance` (domain match to your product/service)
* `competition_risk` (public competitors signals)
* `team_connection_strength` (graph path sum of `strength` edges)
* `contactability` (email_guess probability + public email presence)

## Formula (example, implementable code)

```
OpportunityScore = normalize( w1*signal_strength + w2*relevance + w3*recency - w4*competition_risk )
ConnectionScore = normalize( team_connection_strength * (1 + 0.5*contactability) )
FinalScore = OpportunityScore * (0.6) + ConnectionScore * (0.4)
```

* Normalize = map to 0-100.
* Weights w1..w4 are tunable via config stored in Supabase.

## Ranking & Thresholds

* `FinalScore >= 70` → HOT lead, push immediate alert to chat + email
* `40 <= FinalScore < 70` → Warm lead, batch enrich
* `FinalScore < 40` → Low priority, batch nightly

---

# 6 — Output format (CopilotKit-friendly streaming + final markdown)

**Streaming event types (JSON)** — send via WebSocket/SSE:

```json
{ "type":"thinking", "content":"I will check Neo4j for connections to ACME Corp..." }
{ "type":"tool_use", "tool":"MCP.neo4j.query", "content":"MATCH path = shortestPath(...)" }
{ "type":"observation", "content":"Found CTO John Smith who previously worked with our Sales Lead" }
{ "type":"markdown", "content":"## 🚨 Dossier: ACME Corp\n\n### Summary\n- Industry: SaaS\n- Hot signal: Series B ($10M)\n\n### Top POIs\n1. John Smith — CTO — LinkedIn: ... — Email guess: john.smith@acme.com\n\n### Connection Paths\n- John Smith ← worked-with ← Sarah Jones (Sales Lead)\n\n### Opportunity Score: 82/100\n### Recommended Action\n- Call: Sarah Jones to get intro\n- Email: tailored intro template provided below\n"}
```

**Final Markdown template (agent must output this exactly)** — agent system prompt must enforce this template:

```markdown
## 🚨 Dossier: {entity_name} — {hot_tag}

### TL;DR
- One-sentence summary

### Signals
- 🔔 {Signal type} — {details} — {date}

### Top Persons of Interest (POI)
1. **{name}** — {role} — {source link}  
   - Email guess: `{email_guess}` (confidence: {0-1})  
   - Connection path: `{team_member} -> ... -> {name}`  
   - Notes: {short_note}

### Connection Paths & Strengths
- `{path}` — strength {score}

### Scores
- OpportunityScore: **{0-100}**
- ConnectionScore: **{0-100}**
- FinalScore: **{0-100}**

### Recommended Actions
- [ ] Action 1 (owner: team_member)
- [ ] Action 2

### Raw Evidence & Links
- - {link1}
- - {link2}

### Short Outreach Template (email)
> Subject: Quick intro re {opportunity}
> Hi {POI.first}, ... (custom template)

```

Agent must stream inner thought lines (prefixed as `thinking` events), but final output must be emitted as a single `markdown` event so CopilotKit can render it nicely.

---

# 7 — Security & compliance

* Respect robots.txt and data provider ToS (Bright Data) — log and surface if sources are forbidden.
* Email guessing is risky: never perform SMTP brute-force. Use pattern heuristics + third-party verification APIs (with consent).
* Redact PII from logs unless user role has permission. Keep an audit trail of who requested what dossiers.
* Run agents in sandbox containers, prevent arbitrary shell access or outbound network except via controlled MCP endpoints.
* Rate-limit external enrichment calls to avoid being blocked.

---

# 8 — Implementation snippets (ready to hand to a coding model)

## A. FastAPI webhook receiver (skeleton)

```python
# webhooks.py
from fastapi import APIRouter, Request
from task_queue import enqueue_agent_job
from db import supabase_client, neo4j_driver

router = APIRouter()

@router.post("/webhook/brightdata")
async def brightdata_webhook(req: Request):
    payload = await req.json()
    entity_id = payload.get("entity_id") or payload.get("company_domain")
    event_type = payload.get("type") or payload.get("event")
    # store event
    supabase_client.table("events").insert({
       "source":"brightdata","source_id":payload.get("id"),
       "entity_id":entity_id,"event_type":event_type,"payload":payload
    }).execute()
    # update graph (merge node)
    with neo4j_driver.session() as s:
        s.run("MERGE (e:Entity {entity_id:$id, name:$name})", id=entity_id, name=payload.get("company"))
    # enqueue targeted job
    enqueue_agent_job({"entity_id": entity_id, "trigger": "brightdata_webhook", "event": payload})
    return {"ok": True}
```

## B. Agent job runner (pseudo)

```python
# worker.py
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions, create_sdk_mcp_server
from mcp_clients import neo4j_mcp, supabase_mcp, email_mcp

async def handle_job(job):
    entity = job["entity_id"]
    workspace = ensure_workspace_for_entity(entity)
    opts = ClaudeCodeOptions(
       system_prompt = "You are an analyst producing dossiers. Use MCPs neo4j & supabase for context.",
       cwd = workspace,
       allowed_tools = ["Read","Grep","WebFetch","mcp__neo4j__query","mcp__supabase__query","mcp__email__guess"],
       permission_mode="manual"
    )
    async with ClaudeSDKClient(options=opts) as client:
        # stream events and forward to websocket/SSE
        prompt = f"Create a dossier for entity {entity}. Use neo4j for connections and supabase for history."
        async for ev in client.query(prompt):
            forward_event_to_frontend(job["owner_user_id"], ev)
        # after final markdown event, persist to supabase.dossiers
```

## C. Subagent example (`.claude/agents/poi-finder.md`)

```markdown
---
name: poi-finder
description: Identify top persons of interest for a company using scraped sources and graph edges.
allowed_tools: ["Read","Grep","mcp__neo4j__query","mcp__supabase__query","WebFetch"]
model: claude-3-sonnet
---
You are a POI extraction specialist. 1) Query neo4j for key execs and board. 2) Check supabase events for mentions. 3) Use WebFetch to reach official team pages. Output a JSON array of people:
[
  {"name":"", "role":"", "source":"", "profile_url":"", "email_guess":"", "confidence":0.0}
]
```

---

# 9 — Prioritized, granular TODO list (Handover-ready)

**Top-level**

* [ ] Build repo skeleton if not already (Next.js frontend, FastAPI backend, worker pool, Redis, Supabase, Neo4j)
* [ ] Add environment management (.env) + secrets management note

**Backend / infra**

* [ ] Implement `webhook/brightdata` receiver (store in Supabase + MERGE in Neo4j + enqueue job)
* [ ] Implement task queue (`agent_queue`) using Redis lists or RQ / BullMQ
* [ ] Implement worker `handle_job` that instantiates ClaudeSDKClient, wires MCPs, streams events to SSE/WebSocket
* [ ] Implement MCP servers: `neo4j-mcp` (fast cypher query wrapper), `supabase-mcp` (read logs), `email-mcp` (pattern guess + external verification)
* [ ] Implement `opportunity-scorer` module (functions to compute the scores and normalize)

**Agent / prompts**

* [ ] Create subagents: `entity-dossier`, `poi-finder`, `email-connector`, `scorer`
* [ ] System prompt: enforce streaming inner thought + final markdown template (exact format)
* [ ] Implement PreToolUse hook to block dangerous commands

**Persistence**

* [ ] Save final markdown to Supabase (`dossiers`) and chat logs stream
* [ ] Update Neo4j node properties (last_enriched_at, last_score)

**Frontend (CopilotKit)**

* [ ] Set up WebSocket/SSE stream to receive agent events
* [ ] Render `thinking` events (faded), `tool_use` (inline code/tool block), and `markdown` (render as hierarchical markdown)
* [ ] UI: pin dossier, view pinned dossiers (query Supabase)

**Ops & testing**

* [ ] Add unit tests for scoring functions
* [ ] Add end-to-end tests simulating a webhook + agent run
* [ ] Deploy worker in container with limited permissions; run in Kubernetes or Docker Compose dev
* [ ] Monitoring: log model tokens, job durations, queue depth

**Tuning & privacy**

* [ ] Configure weights for scoring in Supabase config table
* [ ] Implement rate limits for email verification and webfetch
* [ ] Add redaction option for PII

---

# Final notes / Handover checklist for your coding model

* Use the provided SQL and Neo4j snippets for schema initialization.
* Use the subagent YAML example to create `.claude/agents/` definitions.
* Enforce the Markdown template in the system prompt and ensure agent emits `thinking` and `tool_use` events while streaming tokens.
* Persist **final markdown only** once the agent signals `finish` (so partial streams do not create noisy dossiers).
* Provide a dev-mode flag so the worker can use `ClaudeClientStub` for quick local demos.

---

If you want I can now:

* (A) Generate the exact **FastAPI + worker + MCP** code files for the items in the TODO (ready to run locally with stubbed Claude and MCPs), or
* (B) Produce a **CopilotKit frontend page** that renders `thinking`, `tool_use`, and `markdown` events exactly as described (mocked stream), or
* (C) Draft the **system prompt + subagent suite** (full, copy-pasteable `.claude/agents/*.md`) and the initial scoring config in SQL for Supabase.

Pick A, B, or C and I’ll produce the code now in this conversation.
