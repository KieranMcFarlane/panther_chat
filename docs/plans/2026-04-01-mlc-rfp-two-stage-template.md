# MLC RFP Two-Stage Template

Date: 2026-04-01

## Purpose
Keep procurement discovery separate from the stable canary pack.

The first stage is a broad opener that tries to surface evidence quickly:
- `RFP`
- `tender`
- `procurement`

The second stage only runs if stage 1 yields a lead:
- `vendor`
- `digital transformation`
- `broadcast partner`
- `fan engagement platform`

## Stage 1
Use the broad opener source:
- [apps/signal-noise-app/backend/data/question_sources/mlc_rfp_stage1_broad.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_sources/mlc_rfp_stage1_broad.json)

Source order:
- `google_serp`
- `linkedin_posts`
- `news`
- `press_release`
- `official_site`

## Stage 2
Use the follow-up source:
- [apps/signal-noise-app/backend/data/question_sources/mlc_rfp_stage2_followups.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_sources/mlc_rfp_stage2_followups.json)

Run stage 2 only when stage 1 produces a real lead that can be promoted.

## Rule
Do not fold the procurement lane into the stable canary pack.
Treat the RFP flow as a separate discovery workflow that can be slow.
