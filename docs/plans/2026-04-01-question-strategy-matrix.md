# Question Strategy Matrix

Date: 2026-04-01

## Purpose
Freeze the current question strategy so the stable canary pack, fragile probes, and procurement workflow stop drifting in context.

This document is the operating guide for the current question-first setup:
- stable canary questions stay small and fast
- fragile questions stay isolated
- procurement discovery uses a two-stage workflow

## Stable

### q1_foundation
- Note: direct factual lookup; keep it deterministic and fast.
- Best sources: `google_serp`, `official_site`, `wikipedia`
- Status: stable

### q2a_app_launch
- Note: broad web-first discovery for public app/product launch evidence.
- Best sources: `google_serp`, `linkedin_posts`, `news`, `press_release`, `official_site`
- Status: stable if it stays fast

## Fragile

### q2b_public_procurement_or_tender
- Note: explicit procurement/tender probe; useful as a negative canary, but too slow to join the stable pack.
- Best sources: `google_serp`, `news`, `press_release`, `linkedin_posts`, `official_site`
- Status: fragile negative canary

### q3_decision_owner
- Note: leadership / partnerships / business development probe; use LinkedIn-first discovery.
- Best sources: `google_serp`, `linkedin_posts`, `linkedin_people_search`, `linkedin_person_profile`, `linkedin_company_profile`, `news`, `official_site`
- Status: fragile until it gives a reliable positive result

## Two-Stage Procurement

### Stage 1 Broad Opener
- Questions:
  - `q1_rfp`
  - `q2_tender`
  - `q3_procurement`
- Note: broad first-pass procurement discovery; start with entity + RFP/tender/procurement and let search lead.
- Best sources: `google_serp`, `linkedin_posts`, `news`, `press_release`, `official_site`
- Status: separate procurement lane

### Stage 2 Follow-Ups
- Questions:
  - `q4_vendor`
  - `q5_digital_transformation`
  - `q6_broadcast_partner`
  - `q7_fan_engagement_platform`
- Note: run only if stage 1 surfaces a real lead; use follow-up prompts to expand the signal.
- Best sources: `google_serp`, `linkedin_posts`, `news`, `press_release`, `official_site`
- Status: downstream from stage 1 only

## Rules

1. Keep the stable pack small.
2. Do not fold procurement or decision-owner questions back into the stable pack unless they become reliably fast.
3. Treat q2b and q3 as separate canaries.
4. Run MLC procurement as a two-stage workflow, not as part of the stable pack.
5. Do not widen the stable pack again until q3 gives one more reliable positive signal.

## Current Operating Split

- Stable pack:
  - q1_foundation
  - q2a_app_launch
- Fragile probes:
  - q2b_public_procurement_or_tender
  - q3_decision_owner
- Procurement workflow:
  - MLC stage 1 broad opener
  - MLC stage 2 follow-ups
