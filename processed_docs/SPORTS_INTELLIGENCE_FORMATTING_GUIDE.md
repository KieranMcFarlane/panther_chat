# 🏆 **Sports Intelligence Data Formatting Guide**

## 📋 **Overview**

This guide establishes consistent formatting standards for sports intelligence data across all sports and divisions. It ensures uniform structure, naming conventions, and data organization for easy maintenance and scalability.

---

## **🏗️ Data Structure Standards**

### **📁 File Organization**

```
src/lib/
├── sportsIntelligenceData/
│   ├── premierLeagueIntelligenceData.ts
│   ├── rugbyLeagueIntelligenceData.ts
│   ├── rugbyUnionIntelligenceData.ts
│   ├── championshipIntelligenceData.ts
│   └── [sport][division]IntelligenceData.ts
```

### **📄 File Naming Convention**

**Format**: `[sport][division]IntelligenceData.ts`

**Examples**:
- `premierLeagueIntelligenceData.ts`
- `rugbyLeagueIntelligenceData.ts`
- `championshipIntelligenceData.ts`
- `laLigaIntelligenceData.ts`
- `bundesligaIntelligenceData.ts`

---

## **📊 Data Interface Standards**

### **🏢 Club/Team Interface**

```typescript
export interface SportsClub {
  clubName: string;
  website: string;
  linkedinUrl: string;
  totalMembers: number;
  digitalMaturity: number; // 0-100, lower = higher opportunity
  opportunityScore: number; // 0-100, higher = better opportunity
  keyContacts: LinkedInContact[];
  websiteStatus: 'VERIFIED' | 'ACCESSIBLE' | 'INACCESSIBLE';
  linkedinStatus: 'VERIFIED' | 'ACCESSIBLE' | 'INACCESSIBLE';
  insights: ClubInsights;
  division: string; // e.g., "Premier League", "Championship"
  league: string; // e.g., "English Football", "Rugby League"
}
```

### **👥 Contact Interface**

```typescript
export interface LinkedInContact {
  name: string;
  role: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  profileUrl?: string;
  connection: string; // "1st degree", "2nd degree", "3rd degree"
  availability: string; // "Open to partnerships", "Active on platform", etc.
  relevance: string; // Why this contact is important
}
```

### **💡 Insights Interface**

```typescript
export interface ClubInsights {
  opportunityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedApproach: string;
  marketSignals: string[];
  estimatedBudget: string; // e.g., "£150K - £300K"
  timeline: string; // e.g., "6-12 months"
  digitalTransformationSignals: string[];
}
```

---

## **🏆 Division Organization Standards**

### **📋 Division Priority Order**

1. **Top Division** (e.g., Premier League, Super League)
2. **Second Division** (e.g., Championship, Championship)
3. **Third Division** (e.g., League One, League One)
4. **Lower Divisions** (as requested)

### **🎯 Division Data Structure**

```typescript
export const [SPORT]_[DIVISION]_INTELLIGENCE_DATA: Record<string, SportsClub> = {
  // Division 1 - Top Tier
  'division1-club1': {
    clubName: 'Club Name',
    division: 'Premier League',
    league: 'English Football',
    // ... other fields
  },
  
  // Division 2 - Second Tier
  'division2-club1': {
    clubName: 'Club Name',
    division: 'Championship',
    league: 'English Football',
    // ... other fields
  }
};
```

---

## **📊 Data Population Standards**

### **🏢 Club Information**

**Required Fields**:
- `clubName`: Official club name
- `website`: Official website URL
- `linkedinUrl`: LinkedIn company page URL
- `totalMembers`: LinkedIn member count
- `digitalMaturity`: 0-100 score (lower = higher opportunity)
- `opportunityScore`: 0-100 score (higher = better opportunity)
- `division`: Current division name
- `league`: Sport/league name

**Optional Fields**:
- `stadiumCapacity`: Stadium capacity
- `founded`: Year founded
- `location`: City/region
- `owner`: Club owner information

### **👥 Contact Information**

**Priority Levels**:
- **CRITICAL**: CEO, Owner, Chief Executive, Managing Director
- **HIGH**: Commercial Director, Head of Digital, Operations Director
- **MEDIUM**: Head Coach, Marketing Director, Technical Director
- **LOW**: Assistant roles, junior positions

**Connection Types**:
- **1st degree**: Direct connection
- **2nd degree**: Mutual connection
- **3rd degree**: Extended network

### **💡 Intelligence Insights**

**Opportunity Levels**:
- **CRITICAL**: Score 80-100, immediate action required
- **HIGH**: Score 60-79, strong potential
- **MEDIUM**: Score 40-59, moderate opportunity
- **LOW**: Score 0-39, limited opportunity

**Budget Ranges**:
- **Top Division**: £150K - £500K
- **Second Division**: £100K - £300K
- **Third Division**: £50K - £200K
- **Lower Divisions**: £25K - £150K

---

## **🎨 UI Component Standards**

### **📱 Dashboard Page Structure**

```typescript
// Page location: src/app/[sport]-[division]-intel/linkedin-overview/page.tsx

export default function [Sport][Division]LinkedInOverview() {
  // Standard imports and interfaces
  // Standard state management
  // Standard data processing
  // Standard UI components
}
```

### **📊 Statistics Cards**

**Standard 4-Card Layout**:
1. **Total Network**: Total LinkedIn members across all clubs
2. **Division Clubs**: Number of clubs in division
3. **Critical Opportunities**: Number of critical priority clubs
4. **Avg Digital Maturity**: Average digital maturity score

### **🏢 Club Cards**

**Standard Card Layout**:
- Club logo/icon
- Club name and basic stats
- Opportunity level badge
- Opportunity score
- Key contacts preview
- AI insights
- Action buttons (View Details, LinkedIn)

---

## **🔧 Helper Functions Standards**

### **📊 Utility Functions**

```typescript
// Opportunity level calculation
export function getOpportunityLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

// Color coding for opportunity levels
export function getOpportunityColor(level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-yellow-500';
    case 'LOW': return 'bg-green-500';
  }
}

// Total statistics calculation
export function getTotalStats() {
  const clubs = Object.values([SPORT]_[DIVISION]_INTELLIGENCE_DATA);
  return {
    totalClubs: clubs.length,
    totalMembers: clubs.reduce((sum, club) => sum + club.totalMembers, 0),
    avgDigitalMaturity: clubs.reduce((sum, club) => sum + club.digitalMaturity, 0) / clubs.length,
    criticalOpportunities: clubs.filter(club => club.insights.opportunityLevel === 'CRITICAL').length,
    verifiedWebsites: clubs.filter(club => club.websiteStatus === 'VERIFIED').length,
    verifiedLinkedIn: clubs.filter(club => club.linkedinStatus === 'VERIFIED').length
  };
}
```

---

## **📋 Implementation Checklist**

### **✅ New Sport/Division Setup**

1. **Create Data File**
   - [ ] Create `src/lib/[sport][division]IntelligenceData.ts`
   - [ ] Define interfaces and data structure
   - [ ] Populate club data for all teams
   - [ ] Add key contacts for each club
   - [ ] Generate insights and recommendations

2. **Create Dashboard Page**
   - [ ] Create `src/app/[sport]-[division]-intel/linkedin-overview/page.tsx`
   - [ ] Import data and helper functions
   - [ ] Implement standard UI components
   - [ ] Add sorting and filtering functionality
   - [ ] Include verification status indicators

3. **Add Navigation**
   - [ ] Update navigation menu
   - [ ] Add breadcrumb links
   - [ ] Include in sitemap

4. **Testing & Verification**
   - [ ] Test all URLs with Bright Data MCP
   - [ ] Verify LinkedIn profiles are accessible
   - [ ] Test dashboard functionality
   - [ ] Validate data accuracy

---

## **🏆 Sport-Specific Standards**

### **⚽ Football (Soccer)**

**Divisions**:
1. **Premier League** (Top 20 clubs)
2. **Championship** (24 clubs)
3. **League One** (24 clubs)
4. **League Two** (24 clubs)

**Key Roles**:
- CEO/Chief Executive
- Commercial Director
- Head of Digital/Technology
- Operations Director

### **🏉 Rugby League**

**Divisions**:
1. **Super League** (12 clubs)
2. **Championship** (14 clubs)
3. **League One** (10 clubs)

**Key Roles**:
- Chief Executive
- Commercial Director
- Head of Digital & Communications
- Operations Director

### **🏉 Rugby Union**

**Divisions**:
1. **Premiership** (13 clubs)
2. **Championship** (12 clubs)
3. **National League** (various divisions)

**Key Roles**:
- Chief Executive
- Commercial Director
- Head of Marketing
- Director of Rugby

### **🏀 Basketball**

**Divisions**:
1. **British Basketball League** (10 clubs)
2. **National Basketball League** (various divisions)

**Key Roles**:
- Chief Executive
- Commercial Director
- Head of Operations
- Performance Director

---

## **📊 Data Quality Standards**

### **✅ Verification Requirements**

**Website Verification**:
- [ ] All club websites accessible
- [ ] Contact information available
- [ ] Social media links present
- [ ] Technology stack identifiable

**LinkedIn Verification**:
- [ ] All LinkedIn company pages accessible
- [ ] Key contact profiles verified
- [ ] Member counts accurate
- [ ] Company information current

### **📈 Data Accuracy**

**Member Counts**:
- Update monthly via Bright Data MCP
- Cross-reference with official sources
- Flag discrepancies for manual review

**Contact Information**:
- Verify quarterly via LinkedIn searches
- Update role changes promptly
- Track connection changes

**Opportunity Scores**:
- Recalculate monthly based on new data
- Adjust for market changes
- Consider seasonal factors

---

## **🚀 Scaling Guidelines**

### **📈 Adding New Sports**

1. **Research Phase**
   - Identify all divisions and clubs
   - Map key decision makers
   - Assess digital maturity levels
   - Estimate market opportunities

2. **Data Collection**
   - Use Bright Data MCP for verification
   - Gather LinkedIn intelligence
   - Research company information
   - Analyze market signals

3. **Implementation**
   - Follow standard file structure
   - Implement consistent interfaces
   - Use standard UI components
   - Add to navigation system

### **📊 Adding New Divisions**

1. **Priority Assessment**
   - Evaluate market size
   - Assess digital maturity
   - Consider commercial potential
   - Review competitive landscape

2. **Data Population**
   - Follow division priority order
   - Maintain consistent formatting
   - Include all required fields
   - Generate comprehensive insights

---

## **📋 Maintenance Standards**

### **🔄 Regular Updates**

**Monthly**:
- Update LinkedIn member counts
- Refresh contact information
- Recalculate opportunity scores
- Verify website accessibility

**Quarterly**:
- Comprehensive data audit
- Update key contact roles
- Refresh market insights
- Validate budget estimates

**Annually**:
- Full data refresh
- Market opportunity reassessment
- Technology stack updates
- Competitive analysis refresh

### **🔧 Quality Assurance**

**Data Validation**:
- Cross-reference with official sources
- Verify URL accessibility
- Validate contact information
- Check for data consistency

**Performance Monitoring**:
- Track dashboard usage
- Monitor API response times
- Validate data accuracy
- Assess user feedback

---

## **✅ Success Metrics**

### **📊 Implementation Success**

- **100% URL Verification**: All club websites and LinkedIn pages accessible
- **Complete Data Population**: All required fields populated for every club
- **Consistent Formatting**: Standard structure across all sports and divisions
- **Real-time Updates**: Live data integration with Bright Data MCP
- **User Experience**: Intuitive navigation and interaction

### **🎯 Business Impact**

- **Market Coverage**: Comprehensive intelligence across all major sports
- **Opportunity Identification**: Clear prioritization of high-value targets
- **Decision Support**: Actionable insights for strategic planning
- **Scalability**: Easy addition of new sports and divisions

---

## **📞 Quick Reference**

### **🔧 File Structure**
```
src/lib/[sport][division]IntelligenceData.ts
src/app/[sport]-[division]-intel/linkedin-overview/page.tsx
```

### **📊 Standard Interfaces**
```typescript
SportsClub, LinkedInContact, ClubInsights
```

### **🎯 Helper Functions**
```typescript
getOpportunityLevel(), getOpportunityColor(), getTotalStats()
```

### **📋 Implementation Checklist**
- [ ] Data file created
- [ ] Dashboard page implemented
- [ ] Navigation updated
- [ ] Testing completed
- [ ] Verification passed

**This guide ensures consistent, scalable sports intelligence across all divisions and sports!** 🏆📊 