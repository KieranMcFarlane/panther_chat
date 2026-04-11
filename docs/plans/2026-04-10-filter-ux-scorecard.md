# Filter UX Scorecard

## Scope
This scorecard evaluates the shared filter/search system across:
- `entity-browser`
- `opportunities`
- `rfps`

The current implementation is contract-verified, but this scorecard is for UX review, not code correctness.

## Pass Criteria
Each area should score at least `4/5` for the system to feel coherent:
- discoverability
- search clarity
- facet clarity
- state visibility
- result explanation
- reset behavior

## Scorecard

### Entity Browser
- Discoverability: `4/5`
- Search clarity: `4/5`
- Facet clarity: `3/5`
- State visibility: `4/5`
- Result explanation: `4/5`
- Reset behavior: `5/5`

Notes:
- Strongest surface for canonical search because it supports name, sport, country, and role lookup.
- `Competition` and `Entity Role` are probably understandable to power users, but they are not self-evident to casual users.
- The browser likely needs stronger result metadata, not more filters.

### Opportunities
- Discoverability: `3/5`
- Search clarity: `4/5`
- Facet clarity: `3/5`
- State visibility: `4/5`
- Result explanation: `3/5`
- Reset behavior: `5/5`

Notes:
- The shared filter shell is good, but the page still mixes entity taxonomy with business taxonomy.
- `Competition`, `Entity Role`, `Opportunity Kind`, and `Theme` are useful, but the page risks showing too many abstract labels at once.
- Result cards need to answer “what is this, and why is it here?” faster.

### RFPs
- Discoverability: `3/5`
- Search clarity: `4/5`
- Facet clarity: `3/5`
- State visibility: `4/5`
- Result explanation: `3/5`
- Reset behavior: `5/5`

Notes:
- The RFP surface is simpler than opportunities, so the same facet set may be slightly over-specified.
- If users mostly search by entity or sport, the additional taxonomies may be secondary rather than primary.
- This page is the best candidate for reducing visible controls if the UX feels crowded.

## Likely UX Improvements
1. Rename `Entity Role` to `Type` or `Entity Type` if the audience is non-technical.
2. Show one line of canonical context in result cards: `Name · Sport · Country · Competition`.
3. Reduce visible facets on `rfps` unless users actively need all four axes.
4. Keep `Competition` only if it consistently maps to a recognizable league/federation/competition hierarchy.
5. Make empty-state copy explicit about which filter is active and why results disappeared.

## Questions To Resolve In Browser Smoke
- Can a user understand the difference between `Sport` and `Competition` without prompting?
- Does `Entity Role` help more than it hurts?
- Are `opportunities` and `rfps` carrying too many facets for the amount of data on screen?
- Is the active filter state obvious enough when chips are not present?
- Do the result cards show enough canonical context to avoid duplicate confusion?

## Recommendation
Keep the shared filter system. Improve the labels and the result summaries before adding more filter behavior.

The highest-value next UX change is likely:
- clearer labels
- stronger result metadata
- fewer visible controls on the lighter pages

