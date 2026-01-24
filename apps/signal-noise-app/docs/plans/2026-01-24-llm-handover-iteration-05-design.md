# LLM Handover Iteration 05 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce an expanded, context-efficient handover set with deeper operational detail, explicit contracts, and concrete artifacts.

**Architecture:** Same layered skeleton as iteration 04, but each module is expanded with concrete artifacts (file paths, endpoints, config keys) and known failure modes. The format is still consistent for fast scanning by an LLM.

**Tech Stack:** Markdown docs derived from plan-new-infra.md and repo facts.

## Scope
- Create `new-arch-docs/iteration-05/`.
- Expand every module with concrete artifacts and failure modes.
- Keep each file readable and task-oriented.

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

## Template
1) Purpose
2) TL;DR
3) Invariants / Non-negotiables
4) Interfaces / Contracts
5) Failure modes & mitigations
6) Concrete artifacts
7) Where to go next

## Success Criteria
- Each file can stand alone for a specific task.
- Invariants are explicit and repeated only where necessary.
- Concrete artifacts reduce repo scanning for an LLM agent.
