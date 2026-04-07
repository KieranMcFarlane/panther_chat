# `q2` Deterministic Recovery and `q3/q4` Failure Taxonomy

## Scope

This phase did three things only:

1. Implemented a deterministic `q2_digital_stack` recovery pass for the selected miss subset.
2. Remeasured that subset against the recovered 25-entity baseline.
3. Reviewed representative exhausted `q3_procurement_signal` and `q4_decision_owner` artifacts to classify the failure mode and decide whether a weak-surface fallback policy should be introduced.

## `q2` Deterministic Recovery

### Code change

The deterministic `q2` path in [opencode_agentic_batch.mjs](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs) was upgraded to:

- recover known official domains for the selected weak-surface entities:
  - `ecb` -> `https://www.ecb.co.uk/`
  - `icf` -> `https://www.canoeicf.com/`
  - `mls` -> `https://www.mlssoccer.com/`
  - `world-athletics` -> `https://worldathletics.org/`
- preserve explicit deterministic URLs while still normalizing and deduping candidates
- expand deterministic candidates across likely official surfaces for leagues/federations:
  - root
  - `results.`
  - `events.`
  - `app.`
  - `membership.`
  - `rankings.` for federations
- retry deterministic Apify lookups across that ordered candidate list before giving up `q2`

New coverage was added in [test-opencode-agentic-batch.mjs](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs) for:

- federation/acronym official-domain recovery
- deterministic retry across official surface candidates

### Verification

Focused deterministic tests:

- `runDeterministicToolQuestion` suite: passed

Broader batch-script regression:

- [test-opencode-agentic-batch.mjs](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs): passed

### Selected rerun subset

Manifest:
- [question_first_rerun_q2_selected_batch.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_rerun_q2_selected_batch.json)

Run output:
- [/tmp/question-first-rerun-q2c/question_first_archetype_smoke.json](/tmp/question-first-rerun-q2c/question_first_archetype_smoke.json)
- [/tmp/question-first-rerun-q2c/question_first_archetype_smoke.md](/tmp/question-first-rerun-q2c/question_first_archetype_smoke.md)

### Result

Baseline selected miss set:
- `ecb`: `no_signal`
- `icf`: `no_signal`
- `mls`: `no_signal`
- `world-athletics`: `no_signal`

Post-fix rerun:
- `ecb`: `no_signal`
- `icf`: `no_signal`
- `mls`: `no_signal`
- `world-athletics`: `no_signal`

Aggregate:
- targeted entities: `4`
- validated after rerun: `0`
- uplift vs baseline: `0`

### What the artifacts show

The rerun completed cleanly and remained deterministic-only in routing terms:
- `deterministic_path_counts.q2_digital_stack = 4`

But the per-question artifacts still ended with:
- `validation_state = no_signal`
- empty `answer`
- empty `evidence_url`
- OpenCode fallback prompt trace with `exit_code = 1`

Representative artifact:
- [/tmp/question-first-rerun-q2c/ecb/ecb_opencode_batch_20260407_113100_question_001.json](/tmp/question-first-rerun-q2c/ecb/ecb_opencode_batch_20260407_113100_question_001.json)

Interpretation:
- the deterministic recovery widened the official-site candidate set correctly
- but it did not produce a validated tech-stack result for this weak subset
- the runs still fell through to the existing OpenCode path and ended `no_signal`

So the measured result is:
- the `q2` deterministic path is stronger and better covered
- but it did **not** recover the selected 4-entity miss set

## `q3/q4` Failure Taxonomy

### Reviewed artifacts

`q3_procurement_signal` representatives:
- [/tmp/question-first-rerun-q3c/celtic-fc/celtic-fc_opencode_batch_20260407_105536_question_first_run_v1.json](/tmp/question-first-rerun-q3c/celtic-fc/celtic-fc_opencode_batch_20260407_105536_question_first_run_v1.json)
- [/tmp/question-first-rerun-q3c/fifa/fifa_opencode_batch_20260407_105539_question_first_run_v1.json](/tmp/question-first-rerun-q3c/fifa/fifa_opencode_batch_20260407_105539_question_first_run_v1.json)
- [/tmp/question-first-rerun-q3c/fis/fis_opencode_batch_20260407_105543_question_first_run_v1.json](/tmp/question-first-rerun-q3c/fis/fis_opencode_batch_20260407_105543_question_first_run_v1.json)
- [/tmp/question-first-rerun-q3c/major-league-cricket/major-league-cricket_opencode_batch_20260407_105553_question_first_run_v1.json](/tmp/question-first-rerun-q3c/major-league-cricket/major-league-cricket_opencode_batch_20260407_105553_question_first_run_v1.json)
- [/tmp/question-first-rerun-q3c/nwsl/nwsl_opencode_batch_20260407_105556_question_first_run_v1.json](/tmp/question-first-rerun-q3c/nwsl/nwsl_opencode_batch_20260407_105556_question_first_run_v1.json)

`q4_decision_owner` representatives:
- [/tmp/question-first-rerun-q4e/fc-barcelona/fc-barcelona_opencode_batch_20260407_104705_question_first_run_v1.json](/tmp/question-first-rerun-q4e/fc-barcelona/fc-barcelona_opencode_batch_20260407_104705_question_first_run_v1.json)
- [/tmp/question-first-rerun-q4e/ecb/ecb_opencode_batch_20260407_104703_question_first_run_v1.json](/tmp/question-first-rerun-q4e/ecb/ecb_opencode_batch_20260407_104703_question_first_run_v1.json)
- [/tmp/question-first-rerun-q4e/fis/fis_opencode_batch_20260407_104708_question_first_run_v1.json](/tmp/question-first-rerun-q4e/fis/fis_opencode_batch_20260407_104708_question_first_run_v1.json)
- [/tmp/question-first-rerun-q4e/mls/mls_opencode_batch_20260407_104720_question_first_run_v1.json](/tmp/question-first-rerun-q4e/mls/mls_opencode_batch_20260407_104720_question_first_run_v1.json)
- [/tmp/question-first-rerun-q4e/psg/psg_opencode_batch_20260407_104725_question_first_run_v1.json](/tmp/question-first-rerun-q4e/psg/psg_opencode_batch_20260407_104725_question_first_run_v1.json)

### Common artifact pattern

All reviewed artifacts show the same upstream shape:

- `validation_state = tool_call_missing`
- `answer = ""`
- `evidence_url = ""`
- `reasoning.structured_output = {}`
- `prompt_trace.exit_code = 1`
- `prompt_trace.stdout_length = 0`
- `prompt_trace.stderr_length = 280`
- no candidates, no sources, no validated partial answer

This means the reviewed failures are **not** cases where the system produced a candidate and the validator rejected it. They are earlier execution-layer failures with no retained retrieval evidence in the artifact.

### Per-artifact classification

| Entity | Question | Surface type | Useful evidence in raw retrieval? | Candidate produced? | Primary bucket | Why it failed | Would best-available signal have been commercially useful? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `celtic-fc` | `q3` | weaker_public_surface_club | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | public partnership/commercial signals likely exist, but the run retained no evidence and produced no procurement/platform candidate | maybe |
| `fifa` | `q3` | commercial_global_federation | unknown; no raw retrieval captured | no | evidence is too weak/ambiguous for current thresholds | partner/platform surface is broad, but the question asks for buying/reshaping evidence and nothing concrete was retained | maybe |
| `fis` | `q3` | technical_tender_federation | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | tender/procurement intent may exist, but no captured evidence survived to candidate stage | maybe |
| `major-league-cricket` | `q3` | developing_or_fragmented_league | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | the public commercial and platform surface is still thin and the run retained nothing usable | maybe |
| `nwsl` | `q3` | developing_or_fragmented_league | unknown; no raw retrieval captured | no | evidence is too weak/ambiguous for current thresholds | partner/platform signals may exist, but not enough retained evidence mapped cleanly to procurement/opportunity | maybe |
| `fc-barcelona` | `q4` | global_elite_club | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | likely commercial owner exists publicly somewhere, but no people candidate was produced | yes |
| `ecb` | `q4` | commercial_global_federation | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | no named commercial/partnership owner was retained despite the likely existence of one | yes |
| `fis` | `q4` | technical_tender_federation | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | no secretariat/commercial owner candidate survived into output | maybe |
| `mls` | `q4` | top_commercial_league | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | a likely commercial/partnerships lead probably exists, but the run captured nothing usable | yes |
| `psg` | `q4` | global_elite_club | unknown; no raw retrieval captured | no | official site is too thin and fallback surfaces are insufficient | no commercial leadership candidate was retained in the artifact | yes |

### Dominant failure modes

`q3_procurement_signal`
- dominant pattern: weak-surface commercial/platform signals that did not survive into candidate output
- not enough evidence in the artifact to claim “validator rejected usable candidates”
- reviewed `q3` failures are mostly either:
  - official site too thin and fallback surfaces insufficient, or
  - evidence too weak/ambiguous for the current strict opportunity model

`q4_decision_owner`
- dominant pattern: likely-public people data exists, but no candidate survived into output
- reviewed `q4` failures lean heavily toward:
  - official site too thin and fallback surfaces insufficient

## Product Policy Recommendation

Chosen policy model:
- **Dual mode**

### Strict mode

Keep the current validated-only outputs as the system of record:
- baseline metrics stay unchanged
- 25-entity control-batch reporting stays strict
- no “best available” outputs count as validated

### Best-available signal mode

Do **not** implement it yet.

Reason:
- the reviewed `q3/q4` failures are not predominantly “useful candidate found but validator rejected it”
- they are predominantly upstream `tool_call_missing` / no-candidate artifacts
- adding a best-available path now would mostly manufacture weak outputs from runs that captured no evidence

Decision gate for revisiting best-available mode:
- only revisit after the artifact layer can reliably retain retrieval evidence or candidate fragments for weak-surface runs
- if later review shows repeated “useful but rejected” cases, add a visibly flagged fallback mode then

## Recommended next move

Do not run another broad batch yet.

Next:
1. inspect the execution layer that is producing `tool_call_missing` for weak-surface `q3/q4` runs
2. preserve raw retrieval evidence or partial candidate traces for those runs
3. only after that, decide whether:
   - strict mode can be improved enough, or
   - a flagged best-available mode is justified

For `q2`:
- keep the deterministic domain/surface improvements
- but treat the selected 4-entity rerun as a measured `0` uplift result
- do not spend more cycles on the same `q2` subset without a new evidence source or a clearer deterministic surface inventory
