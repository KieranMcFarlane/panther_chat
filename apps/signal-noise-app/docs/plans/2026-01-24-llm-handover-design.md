# LLM Handover Iteration 04 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce a layered, context-efficient handover set that enables an LLM to align with the full system quickly and safely.

**Architecture:** A strict reading order with a small index and modular files. Each module is short and uses the same template (purpose, TL;DR, invariants, contracts, failure modes, next steps) so the LLM can load only what it needs without losing invariants.

**Tech Stack:** Markdown docs derived from plan-new-infra.md and repo facts.

## Scope
- Create a new folder under `new-arch-docs/iteration-04/`.
- Generate 10–13 modular Markdown files optimized for LLM context efficiency.
- Distill high-signal content (allowed in this iteration).

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
- 99-GLOSSARY.md

## Template (per file)
1) Purpose
2) TL;DR
3) Invariants / Non-negotiables
4) Interfaces / Contracts
5) Failure modes & mitigations
6) Where to go next

## Success Criteria
- LLM can read 00-INDEX and load only relevant modules for a task.
- Global invariants are easy to find and hard to miss.
- Each file is short and consistent in format.
