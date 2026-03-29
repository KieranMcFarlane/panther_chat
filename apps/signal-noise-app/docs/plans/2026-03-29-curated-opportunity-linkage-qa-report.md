# Curated Opportunity Linkage QA Report

Date: 2026-03-29T19:47:32.000Z

## Summary
- Imported curated rows reviewed: 88
- Likely correct links: 78
- Unlinked rows: 8
- Suspicious linked rows: 2

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
- Volleyball World | Digital Growth Partnership in China -> CBA (China)
- Australian Sports Commission | Participation Growth Funding 2024-25 and Investment Announcements -> Sporting CP

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
- Add organization-level disambiguation rules before widening coverage further again, especially where a governing body or commercial operator can be mistaken for an unrelated club or league.
- Add negative match guards for country/sport crossover cases such as:
  - Volleyball World vs CBA (China)
  - Australian Sports Commission vs Sporting CP
- Keep domain-aware overrides for official hosts and extend them incrementally from observed failures, not speculative coverage.
- Preserve the forced curated-row re-link path so future matcher improvements can remediate existing imports in place.
- Keep the QA gate strict: if official-host evidence is absent and overlap is weak, leave the row unlinked.
