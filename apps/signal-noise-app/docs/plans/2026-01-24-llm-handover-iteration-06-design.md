# LLM Handover Iteration 06 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a handover set that preserves all execution prompts verbatim while keeping the rest of the documentation context-efficient.

**Architecture:** Same layered module set as iteration-05, plus a dedicated verbatim prompt library extracted from plan-new-infra.md with no distillation.

**Tech Stack:** Markdown docs derived from plan-new-infra.md and repo facts.

## Scope
- Create `new-arch-docs/iteration-06/`.
- Copy iteration-05 modules as the base.
- Add `12-PROMPTS-VERBATIM.md` containing all prompt blocks verbatim.
- Update index to include the prompt library.

## Output Structure
- 00-INDEX.md
- 01-OVERVIEW.md
- 02-DATAFLOW.md
- 03-SIGNAL-LIFECYCLE.md
- 04-GRAPH-STACK.md
- 05-RUNTIME-COPILOTKIT.md
- 06-AGENTS-ROLES.md
- 07-RLM-RECURSION.md
- 08-ORCHESTRATION.md
- 09-SCHEMA-GOVERNANCE.md
- 10-OPS-TESTING.md
- 11-BUSINESS-POSITIONING.md
- 12-PROMPTS-VERBATIM.md
- 99-GLOSSARY.md

## Prompt Handling Rules
- Prompts are copied verbatim from plan-new-infra.md.
- No paraphrasing or distillation inside prompt blocks.

## Success Criteria
- All executable prompts are preserved exactly.
- Index points clearly to prompt library.
- Modules remain concise and task-oriented.
