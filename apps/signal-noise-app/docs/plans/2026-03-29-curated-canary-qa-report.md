# Curated Opportunity Canary QA Report

Date: 2026-03-29T19:56:00Z

## Scope
- Sample size: 40 live curated rows from `/api/tenders`
- Source filter: `metadata.import_source = curated-opportunity-library`
- Goal: decide whether curated import coverage is safe to widen again

## Canary Result
- Likely correct links: 26
- Acceptable unlinked rows: 6
- Suspicious linked rows: 8

## Verdict
- Do not widen curated import coverage further yet.
- The current matcher is strong enough for the smoke set, but not yet strong enough for a broader canary.
- The blocker is not missing routes or persistence. It is entity disambiguation for government agencies, governing bodies, and sport-adjacent operators.

## Suspicious Linked Rows
- Government of Odisha -> WTA Tour
  - `World Athletics Continental Tour Event Management Agency`
- Utah State University -> Athletic Club
  - `Exclusive Athletic Apparel Provider Contract`
- Hockey India -> Hockey
  - `LED Perimeter Boards & Replay Screens for Hero Hockey India League 2026`
- French Government Digital Services -> LNB Pro A (France)
  - `€210M IT & Cloud Services Digital Transformation Program`
- Department of Creative Industries, Tourism and Sport (WA) -> Sporting CP
  - `Community Sporting and Recreation Facilities Fund 2025/2026`
- Athletics Canada -> EFL Championship
  - `2025-2026 Canadian 10,000m and 10,000m Race Walk Championships Hosting`
- World Karate Federation (WKF) -> EFL Championship
  - `Digital Platform and Championships Technology Services`
- Hong Kong Volleyball Association -> Hong Kong Baseball Association
  - `VNL 2025 Press and Side Event Management Services`

## Acceptable Unlinked Rows
- Australian Sports Commission
- Digital India Corporation
- USA Club Rugby
- AthletesCAN
- Saudi Sports for All Federation (SFA)
- Tennis Australia

These are acceptable for now because the current evidence is either too weak or the domain alias remains intentionally unresolved when the preferred canonical entity is absent.

## What This Means
- The smoke flow is still valid.
- The broader canary reveals a new class of bad matches:
  - government agencies collapsing into clubs/leagues because of generic sport-language overlap
  - federation names collapsing into unrelated sports entities that share one token
  - geography-driven titles collapsing into unrelated China/France/athletic/sport brands

## Recommended Next Fixes
1. Add negative guards for the new bad families before importing more sources:
   - government agency -> club/league
   - national governing body -> unrelated generic sport entity
   - sport office / commission -> `Sporting CP` style lexical traps
2. Add a stricter “organization class” gate:
   - when the source organization reads like a government body, federation, or commission, do not allow fallback to club/league unless there is explicit name evidence
3. Re-run the same 40-row canary after those guards
4. Only widen import coverage again if suspicious links fall materially from 8

## Current Recommendation
- Keep the current smoke set and product flow.
- Pause further curated import widening.
- Spend the next slice on disambiguation quality, not UI.

## Targeted Resolution Rerun
Date: 2026-03-29T20:40:00Z

- Scope: direct Supabase verification of the 9 previously suspicious persisted curated rows
- Result:
  - Suspicious linked rows remaining: 0
  - Rows now intentionally unlinked: 9

Resolved rows:
- Government of Odisha
- Athletics Canada (2 rows)
- Utah State University
- Hockey India
- French Government Digital Services
- Department of Creative Industries, Tourism and Sport (WA)
- World Karate Federation (WKF)
- Hong Kong Volleyball Association

What changed:
- event-brand detection now treats names like `WTA Tour` as league/tour-style brands even when typed as `Organization`
- domain-aware unresolved-host guards now keep `athletics.ca` governing-body rows unlinked unless `Athletics Canada` exists in the canonical snapshot
- forced curated backfill now leaves the previous false-positive set unlinked in persisted data

Next recommendation:
1. Treat the previous 8-canary false-positive family as resolved
2. Run a fresh 40-row canary directly from persisted curated rows, not paginated API windows, before widening again

## Fresh Persisted Canary
Date: 2026-03-29T20:45:00Z

- Scope: first 40 curated rows queried directly from `rfp_opportunities`
- Sampling method: ordered by persisted `id`, not paginated API windows

### Result
- Likely correct links: 25
- Acceptable unlinked rows: 15
- Suspicious linked rows: 0

### Cleared Rows
- German Football League (DFL) -> unlinked
  - `Fan Technology Innovation Platform`
- Canada Soccer -> unlinked
  - `Digital Modernization & Fan Platform Enhancement`
- New Zealand Rugby -> unlinked
  - `Digital Transformation & Fan Platform`

### Verdict
- The governing-body, government-agency, and operator-brand false-positive families in the persisted canary are now resolved.
- The widening gate for this canary passes: the three suspicious rows dropped out without introducing new suspicious links in the same 40-row sample.
- Additional widening is now reasonable, but it should still happen in controlled batches with the same persisted-row QA check after each batch.

### Recommended Next Fixes
1. Widen curated coverage in the next controlled batch.
2. Re-run the same direct persisted 40-row canary after that batch lands.
3. Add new alias/guard rules only from fresh evidence, not proactively.
