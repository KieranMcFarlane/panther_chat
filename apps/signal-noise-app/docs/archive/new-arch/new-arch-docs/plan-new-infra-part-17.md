1️⃣ Setup
from uuid import uuid4
from datetime import datetime
from copilotkit_sdk import ClaudeAgent, GraphitiMCP, PersonaPlex
from rlm_tools import list_sources, search_source, open_fragment, refine_search

# Initialize agents
claude_rlm = ClaudeAgent(model="claude-3-5-sonnet")
claude_reason = ClaudeAgent(model="claude-3-opus")  # reasoning over graph
graphiti = GraphitiMCP(db_uri="falkor://localhost:7687")
persona = PersonaPlex(model_path="NATF2.pt")


2️⃣ Traversal / RLM Loop
MAX_ATTEMPTS = 3
MAX_DEPTH = 6
MAX_TOOL_CALLS = 12

def traverse_entity(entity_id):
    session_id = str(uuid4())
    traversal_steps = []
    tool_calls = 0
    depth = 0

    # initial sources
    sources = list_sources(entity_id=entity_id)

    while depth < MAX_DEPTH and tool_calls < MAX_TOOL_CALLS:
        for source in sources:
            # ask RLM to explore source
            response = claude_rlm.run(
                entity_id=entity_id,
                tools=[search_source, open_fragment, refine_search],
                inputs={"source": source, "query": "candidate signals"}
            )
            traversal_steps.append({
                "session_id": session_id,
                "step": depth,
                "tool": response.tool_used,
                "input": response.tool_input,
                "result_hash": response.result_hash,
                "signal_hints": response.signal_hints
            })
            tool_calls += 1

            # check if candidate signals ready for graph
            if response.eligible_for_graph:
                promote_to_graph(entity_id, response)
            
            # stop early if budgets exhausted
            if tool_calls >= MAX_TOOL_CALLS:
                break

        depth += 1

    # cache session
    cache_traversal(session_id, entity_id, traversal_steps)


3️⃣ Ralph Loop Enforcement (Minimum Requirements)
def promote_to_graph(entity_id, exploration_result):
    coverage = exploration_result.coverage_report
    if coverage["evidence_count"] >= 2 and len(coverage["evidence_types"]) >= 2:
        # upsert entity, signals, evidence, relationships
        graphiti.upsert_entity(entity_id)
        for signal in exploration_result.candidate_signals:
            graphiti.upsert_signal(entity_id, signal)
        for evidence in exploration_result.evidence:
            graphiti.upsert_evidence(entity_id, evidence)
    else:
        # mark for retry or insufficient
        print(f"[Ralph loop] Entity {entity_id} does not meet minimum requirements")


4️⃣ CopilotKit Reasoning Agent Example
def answer_user_question(entity_id, question):
    # only query validated graph
    return claude_reason.run(
        entity_id=entity_id,
        tools=[
            graphiti.query_entity,
            graphiti.query_subgraph,
            graphiti.find_signals,
            graphiti.trace_evidence
        ],
        inputs={"question": question}
    )


5️⃣ PersonaPlex Voice Layer
def speak_answer(answer_text):
    persona.speak(
        text=answer_text,
        voice="NATF2",
        style="friendly_teacher"
    )


✅ End-to-End Example
entity_id = "AC_MILAN"
traverse_entity(entity_id)
response = answer_user_question(entity_id, "Why is AC Milan modernizing digitally?")
speak_answer(response)


Notes:
TraversalSteps update the subgraph cache automatically.


Tool budgets + depth limits prevent runaway recursion.


Ralph loop ensures minimum evidence before writing to Graphiti.


CopilotKit agent never touches the RLM search tools.


PersonaPlex provides real-time spoken answers, no reasoning.



I can next produce:
n8n / Temporal DAGs for this pipeline


Automatic batching and parallelization for 4k+ entities


Traversal session visualizer for audits


Do you want me to do that next?
yes
Perfect — here’s a developer-ready blueprint for scaling your pipeline to 4k+ entities with parallelism, batching, orchestration, and auditability, using n8n / Temporal-style DAGs concepts.

