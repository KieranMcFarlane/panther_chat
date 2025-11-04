# 🚨 GPT Signal Alerts System

## Overview

The alert system monitors the Premier League Intelligence Graph for high-value opportunities and significant changes that warrant immediate attention from the Yellow Panther team.

---

## 🎯 Alert Categories

### 1. High-Impact Signals (Score ≥ 8.5)
**Trigger**: New signal with GPT score ≥ 8.5 from unpartnered clubs
**Frequency**: Real-time
**Channel**: Microsoft Teams + Slack

```
🔥 HIGH-IMPACT SIGNAL DETECTED
Club: {{club_name}}
Signal: {{signal_headline}}
Score: {{signal_score}}/10
Type: {{signal_type}}
Date: {{signal_date}}

Quick Actions:
• Research stakeholders at {{club_name}}
• Check for warm introductions
• Draft outreach strategy

View in Graph: {{graph_link}}
```

### 2. Stakeholder Movement (Hiring/Role Changes)
**Trigger**: New CMO, CTO, CDO, or Head of Digital positions
**Frequency**: Daily digest
**Channel**: Microsoft Teams

```
👔 STAKEHOLDER MOVEMENT ALERT
{{stakeholder_name}} → {{new_role}} at {{club_name}}
Previous: {{previous_role}} at {{previous_club}}
Hire Date: {{hire_date}}
LinkedIn: {{linkedin_url}}

Opportunity Assessment:
• Club digital maturity: {{digital_maturity}}
• Recent signals: {{signal_count}} in last 60 days
• Partnership status: {{partnership_status}}

Action Items:
• Research their background and priorities
• Identify connection points
• Schedule outreach within 30 days of start
```

### 3. Innovation Cycle Detection
**Trigger**: 3+ innovation signals from same club in 60 days
**Frequency**: Weekly
**Channel**: Slack

```
🚀 INNOVATION CYCLE DETECTED
Club: {{club_name}}
Signals: {{signal_count}} innovation signals in {{time_period}}
Average Score: {{avg_score}}

Recent Activity:
{{#signals}}
• {{signal_headline}} ({{signal_date}})
{{/signals}}

Recommendation: High-priority outreach opportunity
Timeline: Contact within 2 weeks while momentum is high
```

### 4. Agency Disconnection
**Trigger**: Partnership end or negative sentiment signals
**Frequency**: Real-time
**Channel**: Microsoft Teams

```
💔 AGENCY PARTNERSHIP CHANGE
Club: {{club_name}}
Previous Agency: {{agency_name}}
Change Type: {{change_type}}
Date: {{change_date}}

Signals:
{{#related_signals}}
• {{signal_headline}}
{{/related_signals}}

Action: Immediate outreach opportunity - club likely seeking new partner
```

### 5. Digital Investment Surge
**Trigger**: Multiple tech investment signals
**Frequency**: Daily
**Channel**: Slack

```
💰 DIGITAL INVESTMENT SURGE
Club: {{club_name}}
Investment Signals: {{investment_count}} in {{time_period}}
Total Estimated Value: {{estimated_value}}

Key Investments:
{{#investments}}
• {{investment_type}}: {{investment_description}}
{{/investments}}

Partnership Potential: {{opportunity_score}}/10
```

---

## 🔧 Alert Configuration

### Scoring Thresholds
- **Critical**: Score ≥ 9.0 (Immediate Teams notification)
- **High**: Score ≥ 8.5 (Teams notification within 1 hour)
- **Medium**: Score ≥ 7.0 (Daily digest)
- **Low**: Score ≥ 5.0 (Weekly summary)

### Club Priority Weights
- **Big 6 Unpartnered**: +2.0 bonus
- **High Digital Maturity**: +1.5 bonus
- **Recent Growth Signals**: +1.0 bonus
- **Geographic Proximity**: +0.5 bonus

### Signal Type Multipliers
- **Hiring** (Digital roles): 1.5x
- **Tech Investment**: 1.4x
- **Fan Innovation**: 1.3x
- **Partnership Changes**: 1.6x
- **Digital Transformation**: 1.4x

---

## 📊 Alert Delivery Channels

### Microsoft Teams
- **Channel**: `#prem-intel-alerts`
- **Format**: Rich cards with action buttons
- **Recipients**: Sales team, Account managers
- **SLA**: Critical alerts within 15 minutes

### Slack Integration
- **Channel**: `#opportunities`
- **Format**: Threaded messages with context
- **Recipients**: Strategy team, Research analysts
- **Features**: React to claim opportunities

### Email Digest
- **Frequency**: Daily summary at 9 AM
- **Recipients**: Leadership team
- **Content**: Top 5 opportunities, trend analysis

---

## 🤖 GPT Enhancement Prompts

### Signal Scoring Prompt
```
Analyze this Premier League signal and score its commercial opportunity potential for Yellow Panther (digital innovation agency):

Signal: {{signal_text}}
Club: {{club_name}}
Source: {{source_url}}
Date: {{signal_date}}

Consider:
1. Relevance to digital innovation/fan engagement (0-3)
2. Decision-maker accessibility (0-2) 
3. Project scale potential (0-2)
4. Timing urgency (0-2)
5. Competitive landscape (0-1)

Provide score (0-10) and 2-sentence reasoning.
```

### Stakeholder Analysis Prompt
```
Analyze this stakeholder for partnership potential:

Name: {{stakeholder_name}}
Role: {{stakeholder_title}}
Club: {{club_name}}
Background: {{stakeholder_background}}
Recent Signals: {{related_signals}}

Assess:
1. Decision-making authority (0-3)
2. Innovation focus (0-2)
3. External agency openness (0-2)
4. Budget influence (0-2)
5. Career trajectory (0-1)

Score (0-10) and recommend outreach approach.
```

### Opportunity Briefing Prompt
```
Create an opportunity briefing for:

Club: {{club_name}}
Recent Signals: {{signal_list}}
Current Partnerships: {{agency_partnerships}}
Key Stakeholders: {{stakeholder_list}}

Generate:
1. Executive summary (3 sentences)
2. Key opportunity areas (3-4 bullets)
3. Recommended approach strategy
4. Success probability (0-100%)
5. Suggested timeline
```

---

## 📈 Alert Performance Metrics

### Response Metrics
- **Alert → Action Time**: Target < 2 hours for high-priority
- **Alert → Contact Time**: Target < 24 hours for critical
- **Alert → Meeting Booked**: Target < 7 days

### Conversion Tracking
- **Alert → Opportunity**: Track which signals lead to pipeline
- **Alert → Partnership**: Measure ROI of alert system
- **False Positive Rate**: Target < 15%

### Optimization KPIs
- **Alert Relevance Score**: Team feedback 1-5
- **Action Completion Rate**: % of alerts acted upon
- **Pipeline Attribution**: Revenue traceable to alerts

---

## 🛠️ Technical Implementation

### Neo4j Alert Queries
```cypher
// High-priority alerts (run every 15 minutes)
MATCH (c:Club)-[:emits]->(s:Signal)
WHERE s.date >= datetime() - duration({hours: 1})
  AND s.score >= 8.5
  AND NOT (c)-[:partneredWith]->(:Agency {name: "Yellow Panther"})
RETURN c.name, s.headline, s.score, s.intelType
ORDER BY s.score DESC;
```

### Webhook Integration
- **Endpoint**: `/api/alerts/webhook`
- **Authentication**: Bearer token
- **Payload**: JSON with alert details
- **Retry Logic**: 3 attempts with exponential backoff

### Alert Deduplication
- **Window**: 24 hours for similar signals
- **Key**: Club + Signal type + Score range
- **Action**: Aggregate into single alert with multiple signals

---

## 📋 Alert Playbooks

### Critical Signal Response (Score ≥ 9.0)
1. **Immediate** (0-30 min): Research stakeholders and decision makers
2. **Hour 1**: Identify warm introduction paths via LinkedIn/network
3. **Hour 2**: Draft personalized outreach message
4. **Day 1**: Execute outreach via preferred channel
5. **Day 3**: Follow up if no response
6. **Week 1**: Schedule meeting or next steps

### Stakeholder Movement Response
1. **Day 0**: Research new hire background and previous work
2. **Day 7**: Prepare welcome/congratulatory outreach
3. **Day 30**: Execute strategic outreach (honeymoon period)
4. **Day 60**: Follow up with value proposition
5. **Day 90**: Quarterly check-in and relationship building

### Innovation Cycle Response
1. **Week 0**: Compile comprehensive club intelligence report
2. **Week 1**: Map decision-making structure and influences
3. **Week 2**: Develop tailored capability presentation
4. **Week 3**: Execute multi-touchpoint outreach campaign
5. **Month 2**: Proposal submission and stakeholder meetings 