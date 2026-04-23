# Question-First Strategy Rules

These rules define how question-first search questions should behave so runtime semantics do not drift.

## Core rules

- Keep the stable pack small:
  - `q1_foundation`
  - the best fast positive discovery opener
- Use procurement as a two-stage workflow:
  - stage 1 broad opener
  - stage 2 confirmation only after a real lead
- Use LinkedIn-heavy strategy for owner and point-of-interest questions.
- Use `official_site` last unless a strong lead already exists.
- Reserve `tool_call_missing` for true execution failure:
  - CLI/process failure
  - timeout
  - malformed or aborted run
- If the retrieval path executed successfully and no credible public evidence was found, resolve to `no_signal`.

## Question roles

### `q7_procurement_signal`

- Role: `stage_1_broad_opener`
- Purpose: find public evidence that an entity is changing vendors, adding capability, or reshaping its digital or commercial stack.
- Strategy:
  - broad web-first discovery
  - short, high-recall queries
  - `google_serp`, `news`, `press_release`, `linkedin_posts`, `official_site`
- Expected outcomes:
  - `validated`
  - `provisional`
  - `no_signal`

### `q8_explicit_rfp`

- Role: `negative_confirmation`
- Purpose: confirm whether there is explicit public procurement evidence after a broader lead exists.
- Strategy:
  - treat as a fragile follow-up question, not a main canary
  - `google_serp`, `news`, `press_release`, `linkedin_posts`, `official_site`
- Expected outcomes:
  - `validated` if a public RFP/tender/procurement notice exists
  - `no_signal` if none is publicly visible after bounded search
- Do not treat lack of tender evidence as `tool_call_missing`.

### `q10_hiring_signal`

- Role: `supplementary_signal_probe`
- Purpose: infer investment priorities from public hiring evidence.
- Strategy:
  - prefer hiring-specific lanes first:
    - `careers`
    - `linkedin_jobs`
  - then `google_serp`, `linkedin_posts`, `news`, `official_site`
- Expected outcomes:
  - `validated`
  - `provisional`
  - `no_signal`
- If no meaningful public hiring signal is visible after bounded search, resolve to `no_signal`.

## Practical interpretation

- `tool_call_missing` means the runner failed to execute meaningfully.
- `no_signal` means the runner executed meaningfully and found no credible evidence.
- Negative-canary and supplementary-signal questions should normally degrade to `no_signal`, not to broken-run states.
