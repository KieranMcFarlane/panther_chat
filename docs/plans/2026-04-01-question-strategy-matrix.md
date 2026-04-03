# Canonical Question Matrix

Date: 2026-04-01

## Purpose

This is the single source of truth for the question-first system.

It combines:

- the original 4-question universal atomic matrix
- the later per-question strategy notes
- the full-system extension to broader dossier, discovery, and inference coverage

The operating rule is:

- keep retrieval questions atomic
- broaden the queries underneath them, not the question wording
- use deterministic enrichment when the input is already known
- run graph and inference after retrieval, not inside the BrightData hop loop

## Execution Classes

Use these classes consistently:

- `atomic_retrieval`
  - hop-based
  - evidence-driven
  - returns `validated` or `no_signal`
- `deterministic_enrichment`
  - direct lookup
  - structured output
  - does not behave like a search question
- `derived_inference`
  - computed from prior outputs
  - not a BrightData search loop

## Baseline Rules

- atomic questions start with an 8-hop baseline
- evidence extension is allowed when strong evidence appears
- `no_signal` is a valid terminal state
- official sites are usually confirmation, not first-touch discovery
- LinkedIn is primary for people and relationship questions
- deterministic tools should run before search when the input is known

## Core Universal Atomic Matrix

These are the four universal questions that should exist for every entity:

1. `q1_foundation`
2. `q6_launch_signal`
3. `q7_procurement_signal`
4. `q11_decision_owner`

They are universal because they cover:

- identity
- public digital signal
- procurement / vendor-change signal
- likely commercial buyer

Everything else extends coverage around those core questions.

## Full Question Matrix

## q1_foundation

For foundation discovery, keep it deterministic and factual.

For `{entity}`, use this flow:

1. Start with direct identity lookup
   - Queries:
     - `"{entity}" official website`
     - `"{entity}" founded`
     - `"{entity}" headquarters`
     - `"{entity}" stadium`
     - `"{entity}" capacity`
     - `"{entity}" wikipedia`
   - Sources:
     - `google_serp`
     - `wikipedia`
     - `official_site`
2. Look for strong factual evidence
   - Wikipedia infobox
   - official profile page
   - league profile
3. Scrape only direct factual pages
   - official profile pages
   - Wikipedia page
   - league or team profile pages
4. Treat this as a cheap, stable canary

For the runner, the practical source priority should be:

```json
[
  "google_serp",
  "official_site",
  "wikipedia"
]
```

My recommendation:

- keep `q1_foundation` atomic
- do not broaden the question text
- use it as the universal grounding question

Classification:

- `atomic_retrieval`

## q2_digital_stack

For digital stack discovery, do not start as a pure search question. Start with deterministic enrichment, then narrow discovery only if needed.

For `{entity}`, use this flow:

1. Start with deterministic enrichment
   - Tools:
     - `wappalyzer`
   - Input:
     - canonical website or domain from `q1_foundation`
   - Output:
     - technologies
     - categories
     - likely vendors
2. Then run discovery only if enrichment is incomplete
   - Queries:
     - `"{entity}" CRM`
     - `"{entity}" analytics platform`
     - `"{entity}" ticketing platform`
     - `"{entity}" ecommerce`
     - `"{entity}" mobile app`
     - `"{entity}" technology partner`
   - Sources:
     - `google_serp`
     - `news`
     - `press_release`
     - `official_site`
3. Look for evidence types that indicate a real stack signal
   - Wappalyzer detection
   - vendor announcement
   - case study
   - implementation partner page
4. Use discovery to confirm or extend the deterministic result

For the runner, the practical source priority should be:

```json
[
  "wappalyzer",
  "google_serp",
  "news",
  "press_release",
  "official_site"
]
```

My recommendation:

- keep `q2_digital_stack` as one logical question family
- treat Wappalyzer as a deterministic pre-search step
- use search only for enrichment or confirmation

Classification:

- `deterministic_enrichment`
- then `atomic_retrieval` fallback

## q3_leadership

For leadership discovery, start with structured company and people resolution, then narrow to role relevance.

For `{entity}`, use this flow:

1. Start with company and people resolution
   - Queries:
     - `"{entity}" leadership team`
     - `"{entity}" executive team`
     - `"{entity}" commercial director`
     - `"{entity}" partnerships director`
     - `"{entity}" CTO`
     - `"{entity}" chief digital officer`
   - Sources:
     - `linkedin_company_profile`
     - `linkedin_people_search`
     - `linkedin_person_profile`
     - `google_serp`
     - `official_site`
2. Look for evidence types that identify a real leader
   - LinkedIn role and company match
   - official leadership page
   - executive bio page
3. Scrape only candidate pages that identify role and seniority
4. Use this question to build the leadership map, not the final buyer recommendation

For the runner, the practical source priority should be:

```json
[
  "linkedin_company_profile",
  "linkedin_people_search",
  "linkedin_person_profile",
  "google_serp",
  "official_site"
]
```

My recommendation:

- keep `q3_leadership` about leadership mapping
- do not overlap it with final commercial buyer selection
- use it to populate the people layer broadly

Classification:

- `atomic_retrieval`

## q4_performance

For sports performance context, use structured data first and treat web search as a fallback.

For `{entity}`, use this flow:

1. Start with structured sports sources
   - Queries:
     - `"{entity}" standings`
     - `"{entity}" table`
     - `"{entity}" results`
     - `"{entity}" points`
   - Sources:
     - `structured_sports_source`
     - `google_serp`
2. Look for evidence types that indicate real performance context
   - competition table
   - fixture pages
   - standings page
3. Scrape only when structured results are missing
4. Run this only for sports entities

For the runner, the practical source priority should be:

```json
[
  "structured_sports_source",
  "google_serp"
]
```

My recommendation:

- make `q4_performance` conditional
- do not run it for non-sports entities

Classification:

- `atomic_retrieval`
- sports-only

## q5_league_context

For league or ecosystem context, use structured competition data first, then general web search.

For `{entity}`, use this flow:

1. Start with ecosystem and peer discovery
   - Queries:
     - `"{entity}" competitors`
     - `"{entity}" league teams`
     - `"{league}" table`
     - `"{entity}" rivals`
   - Sources:
     - `structured_source`
     - `google_serp`
2. Look for evidence types that indicate real market context
   - league table
   - competition participants
   - official league directory
3. Use this question to identify peers, not to infer capability gaps directly
4. Run this only where league or ecosystem comparison matters

For the runner, the practical source priority should be:

```json
[
  "structured_source",
  "google_serp"
]
```

My recommendation:

- make `q5_league_context` conditional
- keep it separate from `q13_capability_gap`

Classification:

- `atomic_retrieval`
- sports or ecosystem comparison only

## q6_launch_signal

For launch discovery, do not ask one broad marketing-style question. Ask one focused question and broaden the search variants underneath it.

For `{entity}`, use this flow:

1. Start with broad web-first discovery
   - Queries:
     - `"{entity}" launch`
     - `"{entity}" new app`
     - `"{entity}" platform launch`
     - `"{entity}" digital product`
     - `"{entity}" fan platform`
   - Sources:
     - `google_serp`
     - `news`
     - `linkedin_posts`
     - `press_release`
2. Look for evidence types that indicate a real launch
   - product launch announcement
   - named platform
   - official rollout page
   - app store listing
3. Scrape only the pages that actually describe the product or launch
4. Treat official site as confirmation, not the only discovery path

For the runner, the practical source priority should be:

```json
[
  "google_serp",
  "news",
  "linkedin_posts",
  "press_release",
  "official_site"
]
```

My recommendation:

- keep `q6_launch_signal` atomic
- broaden the queries, not the question text
- this is one of the best fast opportunity-signal questions

Classification:

- `atomic_retrieval`

## q7_procurement_signal

For procurement discovery, do not start with a brand-specific site probe. Start broad, then narrow.

For `{entity}`, use this flow:

1. Start with search-engine discovery
   - Queries:
     - `"{entity}" RFP`
     - `"{entity}" tender`
     - `"{entity}" procurement`
     - `"{entity}" vendor`
     - `"{entity}" digital transformation`
     - `"{entity}" broadcast partner`
     - `"{entity}" fan engagement platform`
   - Sources:
     - `google_serp`
     - `linkedin_posts`
     - `news`
     - `press_release`
     - `official_site`
2. Look for evidence types that usually indicate procurement activity
   - named vendor
   - partnership tied to platform change
   - procurement language
   - platform migration signal
   - supplier selection announcement
3. Scrape only the candidates that look real
   - vendor announcement pages
   - partnership pages
   - LinkedIn posts if accessible
   - official pages if they look like real procurement evidence
4. Score evidence before extending the hop budget
   - Strong evidence:
     - named supplier
     - explicit procurement or tender language
     - recent date
     - direct association with the entity
   - Weak evidence:
     - generic vendor marketing
     - rumor posts
     - unrelated procurement pages
5. Keep official site as follow-up, not first touch

For the runner, the practical source priority should be:

```json
[
  "google_serp",
  "linkedin_posts",
  "news",
  "press_release",
  "official_site"
]
```

For a more procurement-focused second pass:

```json
[
  "google_serp",
  "news",
  "press_release",
  "linkedin_posts",
  "official_site"
]
```

My recommendation:

- keep `q7_procurement_signal` as the main broad procurement discovery lane
- do not start with `site:`
- use entity-first, web-first search

Classification:

- `atomic_retrieval`

## q8_explicit_rfp

For formal RFP discovery, run a stricter document-oriented pass after procurement signals suggest it is worth doing.

For `{entity}`, use this flow:

1. Start with strict procurement document search
   - Queries:
     - `"{entity}" RFP pdf`
     - `"{entity}" tender pdf`
     - `"{entity}" procurement document`
     - `"{entity}" invitation to tender`
   - Sources:
     - `google_serp`
     - `news`
     - `press_release`
2. Look for evidence types that indicate formal procurement
   - direct document
   - official tender page
   - procurement portal entry
3. Scrape only PDFs, tender pages, and official procurement listings
4. Treat this as a strict follow-up, not the main procurement discovery question

For the runner, the practical source priority should be:

```json
[
  "google_serp",
  "news",
  "press_release"
]
```

My recommendation:

- make `q8_explicit_rfp` conditional
- use it when `q7_procurement_signal` suggests something formal may exist
- do not run it universally if you want scale efficiency

Classification:

- `atomic_retrieval`
- conditional

## q9_news_signal

For recent-news discovery, search broadly for timing and priority signals rather than trying to infer opportunity directly.

For `{entity}`, use this flow:

1. Start with recent coverage discovery
   - Queries:
     - `"{entity}" news`
     - `"{entity}" press release`
     - `"{entity}" partnership`
     - `"{entity}" announcement`
     - `"{entity}" digital initiative`
   - Sources:
     - `news`
     - `press_release`
     - `linkedin_posts`
     - `google_serp`
2. Look for evidence types that indicate timing relevance
   - partnership announcement
   - launch announcement
   - internal change
   - digital initiative
   - infrastructure or sponsorship update
3. Scrape only recent and relevant pages
4. Use this as a timing and priority question, not as a duplicate procurement question

For the runner, the practical source priority should be:

```json
[
  "news",
  "press_release",
  "linkedin_posts",
  "google_serp"
]
```

My recommendation:

- keep `q9_news_signal` separate from `q6` and `q7`
- use it for timing hooks and current priorities

Classification:

- `atomic_retrieval`

## q10_hiring_signal

For hiring discovery, use job and hiring signals as evidence of investment or internal capability build-out.

For `{entity}`, use this flow:

1. Start with hiring and role discovery
   - Queries:
     - `"{entity}" jobs digital`
     - `"{entity}" jobs CRM`
     - `"{entity}" jobs data`
     - `"{entity}" jobs fan engagement`
     - `"{entity}" jobs transformation`
   - Sources:
     - `google_serp`
     - `linkedin_posts`
     - `linkedin_company_profile`
2. Look for evidence types that indicate active investment
   - open digital roles
   - CRM or data hiring
   - transformation hiring
   - platform or analytics team expansion
3. Scrape only real job pages or company hiring pages
4. Use this question for investment signals, not for people mapping

For the runner, the practical source priority should be:

```json
[
  "google_serp",
  "linkedin_posts",
  "linkedin_company_profile"
]
```

My recommendation:

- make `q10_hiring_signal` conditional
- use it when staffing is a useful proxy for budget or urgency

Classification:

- `atomic_retrieval`
- conditional

## q11_decision_owner

For decision-owner discovery, do not reuse the full leadership search. Start from commercial and sponsorship ownership directly.

For `{entity}`, use this flow:

1. Start with commercial owner discovery
   - Queries:
     - `"{entity}" commercial director`
     - `"{entity}" partnerships director`
     - `"{entity}" business development`
     - `"{entity}" sponsorship director`
   - Sources:
     - `linkedin_people_search`
     - `linkedin_person_profile`
     - `google_serp`
2. Look for evidence types that indicate buying relevance
   - role clearly tied to commercial, sponsorship, partnerships, or business development
   - seniority and scope visible in profile
   - public proof of remit
3. Scrape only candidate profiles and official bios
4. Use this question to pick the best commercial contact, not to rebuild the full org chart

For the runner, the practical source priority should be:

```json
[
  "linkedin_people_search",
  "linkedin_person_profile",
  "google_serp"
]
```

My recommendation:

- keep `q11_decision_owner` separate from `q3_leadership`
- `q3` builds the leadership map
- `q11` chooses the likely buyer

Classification:

- `atomic_retrieval`

## q12_connections

For connections analysis, do not run this as a generic web search question. Use graph and network resolution.

For `{entity}`, use this flow:

1. Start with relationship lookup
   - Queries:
     - `"{yp_person}" "{entity}"`
     - `"{yp_person}" "{target_person}"`
     - `"{yp_person}" mutual connections`
     - `"{bridge_contact}" "{entity}"`
   - Sources:
     - `linkedin_people_search`
     - `linkedin_person_profile`
2. Look for evidence types that indicate a usable route in
   - direct connection
   - strong second-degree path
   - shared organization or shared network bridge
3. Use this after leadership and decision-owner mapping, not before

For the runner, the practical source priority should be:

```json
[
  "linkedin_people_search",
  "linkedin_person_profile"
]
```

My recommendation:

- do not treat `q12_connections` as a universal search question
- run it after `q3` and `q11`
- it is better thought of as relationship resolution

Classification:

- `deterministic_enrichment`
- or graph lookup, depending on tooling

## q13_capability_gap

For capability-gap analysis, do not search the web first. Derive it from retrieved evidence and peer context.

For `{entity}`, use this flow:

1. Start with prior outputs
   - Inputs:
     - `q2_digital_stack`
     - `q5_league_context`
     - `q7_procurement_signal`
2. Add optional peer lookups only if needed
   - Queries:
     - `"{peer_entity}" CRM`
     - `"{peer_entity}" fan engagement platform`
3. Look for evidence types that indicate a gap
   - peer has named stack and target does not
   - peer has platform or vendor maturity signal and target does not
   - target shows underinvestment relative to peers

My recommendation:

- do not treat `q13_capability_gap` as a primary atomic search question
- derive it after retrieval

Classification:

- `derived_inference`

## q14_yp_fit

For Yellow Panther fit, do not search the web directly. Infer fit from the validated retrieval outputs.

For `{entity}`, use this flow:

1. Start with prior outputs
   - Inputs:
     - `q2_digital_stack`
     - `q6_launch_signal`
     - `q7_procurement_signal`
     - `q9_news_signal`
     - `q13_capability_gap`
2. Evaluate fit against Yellow Panther capabilities
   - digital transformation
   - fan engagement
   - CRM and data
   - commercial and platform work
3. Produce a reasoned fit judgement, not a raw search result

My recommendation:

- keep `q14_yp_fit` out of the BrightData hop loop
- this is an inference layer output

Classification:

- `derived_inference`

## q15_outreach_strategy

For outreach strategy, do not search the web as if this were another discovery question. Build it from people, timing, and fit.

For `{entity}`, use this flow:

1. Start with prior outputs
   - Inputs:
     - `q11_decision_owner`
     - `q12_connections`
     - `q14_yp_fit`
2. Evaluate
   - warm, lukewarm, or cold route
   - best first contact
   - best opening angle
   - timing signals
   - risks and pitfalls
3. Produce an engagement plan, not another evidence retrieval pass

My recommendation:

- keep `q15_outreach_strategy` post-retrieval
- it should synthesize, not search

Classification:

- `derived_inference`

## Recommended Operating Split

Use the full 15-question system, but do not run all 15 as equal atomic search questions.

Recommended breakdown:

- universal atomic retrieval:
  - `q1_foundation`
  - `q6_launch_signal`
  - `q7_procurement_signal`
  - `q11_decision_owner`
- supporting atomic retrieval:
  - `q3_leadership`
  - `q9_news_signal`
- deterministic enrichment:
  - `q2_digital_stack`
  - `q12_connections`
- conditional atomic retrieval:
  - `q4_performance`
  - `q5_league_context`
  - `q8_explicit_rfp`
  - `q10_hiring_signal`
- derived inference:
  - `q13_capability_gap`
  - `q14_yp_fit`
  - `q15_outreach_strategy`

## Archetype Validation

Use the same matrix family on three archetypes before scaling:

- Arsenal
  - club archetype
  - proves the baseline sport-entity path
- International Canoe Federation
  - federation archetype
  - proves the federation and procurement path
- Major League Cricket
  - procurement archetype
  - proves the broad discovery and procurement signal path

## Source Files

Canonical checked-in sources for the current universal atomic retrieval layer:

- `/apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json`
- `/apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json`
- `/apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json`

Generator:

- `/apps/signal-noise-app/backend/universal_atomic_matrix.py`

## Final Recommendation

Use one canonical matrix strategy for the whole system.

That does not mean every question runs the same way.

The correct interpretation is:

- atomic retrieval where evidence is needed
- deterministic enrichment where input is already known
- derived inference where the answer should be computed from prior outputs

This is the clean way to get full coverage without collapsing the system into one expensive, noisy retrieval loop.
