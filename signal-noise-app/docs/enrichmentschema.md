This is one of those places where **schema design** determines how intuitive (or messy) the whole system feels. Since you’ve got **clubs, sportspeople, and persons of interest (POIs)**, the trick is to find a **shared schema baseline** while still allowing **specialised fields**.

Here’s how I’d design it:

---

# ⚽ Intuitive Entity Schema Design

### 1. **Base Entity Model** (`Entity`)

All Clubs, Sportspeople, and POIs inherit from this.

```yaml
Entity:
  id: UUID
  type: [Club | Sportsperson | PersonOfInterest]
  name: string
  image/logo_url: string
  description: text
  location: string
  country: string
  sport: string (nullable for non-sports POIs)
  tags: [string]
  created_at: datetime
  updated_at: datetime
```

This guarantees that **every entity has a shared identity** → works for vector search, graph, and enrichment pipelines.

---

### 2. **Club Schema** (extends `Entity`)

```yaml
Club:
  parent: Entity
  division: string (e.g. Premier League)
  stadium: string
  founded_year: int
  revenue_est: float (nullable)
  website: string
  socials: 
    twitter: string
    instagram: string
    linkedin: string
  squad: [Sportsperson.id]
  staff_contacts: [PersonOfInterest.id]
```

**Rationale:** Clubs are organisations, so they get firmographic + competition-level fields.

---

### 3. **Sportsperson Schema** (extends `Entity`)

```yaml
Sportsperson:
  parent: Entity
  club_id: Club.id (nullable if independent athlete)
  position/role: string (e.g. Striker, Forward, Goalkeeper)
  nationality: string
  date_of_birth: date
  stats: 
    appearances: int
    goals: int
    assists: int
    other_custom: json
  sponsorships: [PersonOfInterest.id] # e.g. Nike, Adidas contacts
  agent_id: PersonOfInterest.id
```

**Rationale:** Sportspeople are individuals tied to performance metrics + affiliations (clubs, agents, sponsors).

---

### 4. **Person of Interest Schema** (extends `Entity`)

```yaml
PersonOfInterest:
  parent: Entity
  role: string (e.g. Director of Marketing, Agent, Procurement Lead)
  organisation: Club.id or External_Org.id
  email: string
  phone: string
  linkedin_url: string
  connections: [Entity.id] # can link to clubs, sportspeople, other POIs
```

**Rationale:** POIs are *contacts*, so they carry communication + organisational alignment.

---

### 5. **Shared Enrichment Overlay**

Regardless of type, every entity can carry these overlays:

```yaml
Enrichment:
  facts: json   # structured metadata & scraped info
  connections: [Entity.id]
  tenders: [Tender.id]
  insights: [Insight.id]
  scores: 
    opportunity_score: float
    influence_score: float
    recency_score: float
```

So the UI can always display the **4 core tabs (Facts, Connections, Tenders, Insights)**.

---

### 6. **Graph Alignment**

* Clubs connect → Leagues (Division nodes)
* Sportspersons connect → Clubs (or free agents in Division nodes)
* POIs connect → Clubs, Sportspersons, or External Orgs
* All → feed into tenders + opportunities

---

✅ This schema feels **intuitive** because:

* Users see the same dossier structure (facts, connections, tenders, insights) regardless of entity type.
* It handles both **team sports** and **individual sports** naturally.
* It supports **business contacts (POIs)** without breaking the sports-first navigation.
