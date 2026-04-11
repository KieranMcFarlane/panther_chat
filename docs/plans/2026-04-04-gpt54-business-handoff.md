# GPT-5.4 Business Handoff

Date: 2026-04-04

## Purpose

This note explains the current `question-first` system in business terms so another LLM can reason about the project without reconstructing the architecture from code history.

This document is about the **implemented system state**, not just the target design.

## Business Goal

The business goal is to turn noisy web discovery into a repeatable commercial intelligence pipeline for Yellow Panther.

Yellow Panther wants to:

- identify sports organizations and adjacent entities worth pursuing
- understand their digital maturity, procurement signals, and likely buyers
- turn raw retrieval into business-ready opportunities, outreach angles, and account strategy
- scale this across thousands of entities without treating every question as an expensive open-ended research task

The key business constraint is cost and repeatability:

- deterministic lookups should be used when possible
- search should be used only where true discovery is needed
- inference should happen after retrieval, not inside the retrieval loop

## Current System Shape

The current system is a `question-first` pipeline built around:

- a **universal atomic matrix**
- an **OpenCode + BrightData** execution loop
- a **dossier runner** that launches and waits for terminal artifacts
- a **promotion/merge layer** that turns validated answers into dossier-ready outputs

The system is intentionally moving away from one broad dossier prompt and toward:

1. ask bounded questions
2. collect evidence
3. validate or mark `no_signal`
4. merge structured outputs into downstream business views

## Three Execution Classes

The design is split into three execution classes:

### 1. `atomic_retrieval`

Use this for questions that truly need discovery and evidence collection.

Characteristics:

- hop-based
- uses OpenCode + BrightData
- returns `validated` or `no_signal`
- should answer one business signal only

### 2. `deterministic_enrichment`

Use this when the input is already known and the result should be structured.

Characteristics:

- should run before search
- should be cheap and predictable
- should not behave like a fuzzy search question

### 3. `derived_inference`

Use this after retrieval and enrichment are complete.

Characteristics:

- no search hops
- computed from earlier outputs
- used for fit, gaps, and outreach strategy

## What Is Actually Implemented Now

The current live matrix in code is **five questions**, not the full fifteen-question future matrix.

Implemented in:

- [apps/signal-noise-app/backend/universal_atomic_matrix.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/universal_atomic_matrix.py)

The five live question families are:

1. `q1_foundation`
2. `q2_digital_stack`
3. `q3_procurement_signal`
4. `q4_decision_owner`
5. `q5_related_pois`

This is the important distinction:

- the **canonical strategy doc** describes the broader full-system direction
- the **live runner** currently executes the five-question matrix above

## Current Business Meaning Of Each Live Question

### `q1_foundation`

Business purpose:

- anchor the entity identity
- get the official site and core factual grounding
- reduce ambiguity before downstream discovery

Why it matters:

- the rest of the pipeline is weaker if the entity is misresolved
- `q2_digital_stack` depends on `q1` to provide the canonical website/domain

### `q2_digital_stack`

Business purpose:

- detect visible technology choices and external vendors
- understand whether the organization looks modern, underinvested, fragmented, or partner-led
- create evidence for digital maturity and service fit

Current execution model:

- deterministic first via `apify_techstack`
- retrieval fallback second via OpenCode/BrightData
- optional secondary deterministic enrichment on extra discovered digital domains

Why it matters:

- this is the bridge from technical evidence to commercial relevance
- stack signals can route later reasoning toward ecommerce, mobile, CRM, analytics, fan engagement, or rebuild opportunities

### `q3_procurement_signal`

Business purpose:

- detect buying motion
- find vendor change, RFP, tender, procurement, sponsor, or broadcast signals

Why it matters:

- procurement and vendor-change evidence is stronger for business development than generic “digital maturity” alone

### `q4_decision_owner`

Business purpose:

- identify the **best likely buyer**
- not the whole org chart

Current execution model:

- company-first LinkedIn resolution
- candidate pool first
- title-specific search only as fallback
- returns `primary_owner` plus `supporting_candidates`

Why it matters:

- outbound quality depends on selecting the right buyer, not just the most senior name

### `q5_related_pois`

Business purpose:

- return the broader set of commercially relevant contacts
- support outreach routing and account mapping

Current execution model:

- similar evidence surface to `q4`
- different contract: ranked list of 3 to 5 relevant people

Why it matters:

- `q4` is for best buyer selection
- `q5` is for supporting contact coverage

## Current Runtime Flow

The operational flow today is:

1. build an entity-specific atomic source JSON from the universal matrix
2. run the question batch through OpenCode
3. use BrightData for search and scrape when discovery is needed
4. validate each question or finish with `no_signal`
5. write state, per-question artifacts, rollup artifacts, and a `question_first_run_v1` artifact
6. merge promoted outputs into the dossier runner

Key execution files:

- batch runner:
  - [apps/signal-noise-app/scripts/opencode_agentic_batch.mjs](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs)
- dossier wrapper:
  - [apps/signal-noise-app/backend/question_first_dossier_runner.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py)
- promoter:
  - [apps/signal-noise-app/backend/question_first_promoter.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_promoter.py)

## Important Operational Rules

These rules are intentional and should not be “optimized away” casually.

### `8` hops is a ceiling, not a promise

A question may terminate before all 8 hops if:

- it validates early
- it times out
- it produces no useful evidence

This is desirable for cost control.

### `no_signal` is a valid business outcome

`no_signal` does **not** always mean “nothing was found.”

It can mean:

- weak evidence was found but did not cross the validation threshold
- a plausible candidate existed but lacked enough support
- the question was not resolved cleanly enough to trust

From a business perspective, that is still useful:

- it tells Yellow Panther where the account is ambiguous
- it shows which signals are fragile and may need a different discovery strategy

### Official site is usually confirmation, not first-touch discovery

For procurement and opportunity signals especially:

- vendor pages
- news
- LinkedIn posts
- press releases

often surface the signal before the official site does.

### Decision-owner logic is company-first

Do not reduce `q4` back to a short fixed title list.

The current design intentionally prefers:

1. company anchor
2. broad candidate pool
3. ranking by buying relevance
4. title search as fallback only

## Current Strategic Direction

The broader target architecture is documented in:

- [docs/plans/2026-04-01-question-strategy-matrix.md](/Users/kieranmcfarlane/Downloads/panther_chat/docs/plans/2026-04-01-question-strategy-matrix.md)

That target architecture expands beyond the current five-question matrix into:

- more retrieval questions
- more deterministic enrichment
- more derived inference

But the important truth for GPT-5.4 is:

- the **live code** is still centered on the five-question universal matrix
- the **full 15-question model** is currently a strategy direction, not the full live runtime contract

## Current Apify Status

`q2_digital_stack` has been rewired from Wappalyzer to Apify because Apify is cheaper and more suitable for batch enrichment.

Current intended behavior:

1. use the canonical domain from `q1_foundation`
2. run deterministic `apify_techstack`
3. if needed, use OpenCode/BrightData fallback to find extra digital properties
4. if extra domains are discovered, run Apify again on those domains

This logic is implemented and covered by targeted tests.

However, there is still a live-integration issue:

- the direct external Apify actor call is not yet stable in the live canary
- earlier raw probes returned:
  - `400 invalid-input`
  - then later `502`
- the runner now supports:
  - correct question wiring
  - `APIFY_PASSWORD` as an alias for `APIFY_TOKEN`
  - additional domain enrichment

So the remaining blocker is not the matrix design. It is the live Apify actor contract and/or upstream actor behavior.

## Current Validation Status

What has already been validated in tests:

- the universal matrix emits `q2_digital_stack`
- deterministic Apify enrichment runs before search
- `APIFY_PASSWORD` can stand in for `APIFY_TOKEN`
- `q2` prompts now ask OpenCode for `additional_domains`
- fallback search results can be enriched with Apify on those additional domains

What is **not** yet fully validated live:

- a clean real-world Apify-backed `q2_digital_stack` canary against Arsenal

## What GPT-5.4 Should Understand

If GPT-5.4 works on this codebase, it should start with these assumptions:

1. The project is about scalable commercial intelligence for Yellow Panther, not generic research.
2. The system should minimize noisy search wherever deterministic enrichment is possible.
3. The current live matrix is five questions.
4. The full 15-question framework is a design north star, not the full runtime yet.
5. `q2_digital_stack` is the main active area of transition right now.
6. `q4_decision_owner` and `q5_related_pois` are intentionally separated.
7. `no_signal` is acceptable and should not be “fixed away” by forcing weak answers.

## What GPT-5.4 Should Optimize For Next

The highest-value near-term goals are:

1. make the live Apify actor call stable for `q2_digital_stack`
2. run a real one-question `q2` canary to completion
3. confirm whether `additional_domains` show up in live retrieval
4. only then broaden the matrix further

The wrong next step would be:

- adding more question families before `q2` is stable in live execution

## Short Version

This repo contains a question-first commercial intelligence system for Yellow Panther.

The live implementation currently runs a five-question universal matrix:

- foundation
- digital stack
- procurement signal
- decision owner
- related POIs

The system is deliberately split into:

- atomic retrieval
- deterministic enrichment
- derived inference

The key current business transition is that `q2_digital_stack` is moving to:

- Apify first
- search fallback second
- multi-domain enrichment when extra digital properties are discovered

Most of that logic is now implemented and tested. The main unresolved issue is the live Apify actor behavior, not the business design.
