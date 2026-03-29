# Curated Opportunity Linkage QA Report

Date: 2026-03-29T19:24:23.124Z

## Summary
- Imported curated rows reviewed: 72
- Likely correct links: 58
- Unlinked rows: 14
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
- None after the domain-aware override and forced curated-row re-link pass

## Unlinked Rows
- Tennis Australia | Tournament Digital Platform Overhaul
- French Football Federation (FFF) | Mobile Engagement & Digital Transformation
- Major League Baseball | Advanced Analytics & Fan Platform
- Korea Football Association | Digital Transformation & Fan Platform Development
- U.S. Soccer Federation | Digital Platform & Fan Engagement System
- Mexican Football Federation | Digital Transformation & Fan Engagement Platform
- Digital India Corporation | Comprehensive Digital Event and Engagement Solution with Multilingual Content Management
- Saudi Sports for All Federation (SFA) | ASICS Innovation Pitch in Collaboration with Saudi Sports for All Federation
- Unknown Organization | Untitled RFP
- USA Cricket | Cricket Development and Youth Programs Technology Platform
- USA Cycling | 2025-2028 USA Cycling Masters Road National Championships Hosting
- USA Cycling | 2025-2028 USA Cycling Gravity Mountain Bike National Championships
- AthletesCAN | 2026-2027 AthletesCAN Forum and Canadian Sport Awards
- USA Club Rugby | USA Club Rugby National Championship Events Hosting

## Recommended Next Matcher Fixes
- Add alias dictionaries for governing bodies and national federations that still remain unlinked, especially football federations and Olympic/NGB style operators.
- Keep domain-aware overrides for official hosts and extend them incrementally from observed failures, not speculative coverage.
- Preserve the forced curated-row re-link path so future matcher improvements can remediate existing imports in place.
- Keep the QA gate strict: if official-host evidence is absent and overlap is weak, leave the row unlinked.