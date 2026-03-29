# Curated Opportunity Linkage QA Report

Date: 2026-03-29T19:52:20.849Z

## Summary
- Imported curated rows reviewed: 88
- Likely correct links: 80
- Unlinked rows: 8
- Suspicious linked rows: 0

## Smoke Entities
- Arsenal Football Club: 1 matching curated shortlist rows
  - Digital Evolution & Fan Engagement -> Arsenal Football Club
- Coventry City: 0 matching curated shortlist rows
- Zimbabwe Cricket: 0 matching curated shortlist rows
- Major League Cricket: 2 matching curated shortlist rows
  - Integrated Ticketing System Implementation -> Major League Cricket (MLC)
  - Digital Transformation and Technology Infrastructure RFP -> Major League Cricket (MLC)
- Zimbabwe Handball Federation: 0 matching curated shortlist rows

## Suspicious Linked Rows
- None after the negative guard and forced curated-row re-link pass

## Unlinked Rows
- Tennis Australia | Tournament Digital Platform Overhaul
- Major League Baseball | Advanced Analytics & Fan Platform
- Digital India Corporation | Comprehensive Digital Event and Engagement Solution with Multilingual Content Management
- Saudi Sports for All Federation (SFA) | ASICS Innovation Pitch in Collaboration with Saudi Sports for All Federation
- Unknown Organization | Untitled RFP
- AthletesCAN | 2026-2027 AthletesCAN Forum and Canadian Sport Awards
- USA Club Rugby | USA Club Rugby National Championship Events Hosting
- One additional low-signal row remained unlinked in the widened curated import pass

## Recommended Next Matcher Fixes
- Keep using explicit negative guards for observed false positives before broadening lexical matching again.
- Favor targeted organization-level disambiguation over broader fuzzy scoring changes unless a larger evidence set justifies it.
- Keep domain-aware overrides for official hosts and extend them incrementally from observed failures, not speculative coverage.
- Preserve the forced curated-row re-link path so future matcher improvements can remediate existing imports in place.
- Keep the QA gate strict: if official-host evidence is absent and overlap is weak, leave the row unlinked.
