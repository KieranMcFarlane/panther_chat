# Intelligence Pages Standards Guide

## 🎯 **Overview**

This guide establishes the standards for creating and maintaining intelligence pages across all sports and divisions. It ensures consistency, quality, and scalability for the Yellow Panther AI platform.

## 📋 **Page Structure Standards**

### **1. File Organization**

```
src/app/[sport]-[division]-intel/linkedin-overview/page.tsx
src/lib/[sport][division]IntelligenceData.ts
```

**Examples:**
- `src/app/rugby-league-intel/linkedin-overview/page.tsx`
- `src/lib/rugbyLeagueIntelligenceData.ts`
- `src/app/premier-league-intel/linkedin-overview/page.tsx`
- `src/lib/premierLeagueIntelligenceData.ts`

### **2. Data Interface Standards**

```typescript
export interface [Sport][Division]Club {
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
  division: string;
  league: string;
}

export interface LinkedInContact {
  name: string;
  role: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  profileUrl?: string; // REQUIRED for all contacts
  connection: string;
  availability: string;
  relevance: string;
}

export interface ClubInsights {
  opportunityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedApproach: string;
  marketSignals: string[];
  estimatedBudget: string;
  timeline: string;
  digitalTransformationSignals: string[];
}
```

## 🔍 **Contact Verification Standards**

### **1. Contact Quality Requirements**

- **✅ VERIFIED CONTACTS ONLY**: Only include contacts with confirmed LinkedIn profiles
- **✅ Profile URLs**: All contacts must have `profileUrl` field populated
- **✅ Real Names**: Use actual names, not placeholder data
- **✅ Accurate Roles**: Verify current job titles and responsibilities
- **✅ Priority Levels**: Assign based on decision-making authority

### **2. LinkedIn Profile Verification Process**

**🔗 Related Documentation**: See `docs/intelligence-verification/INTELLIGENCE_LINKEDIN_VERIFICATION_COMPLETE.md` for detailed verification process.

#### **Verification Requirements:**
- **✅ No 404 Errors**: All LinkedIn profile URLs must be working
- **✅ Real Profile Format**: Use `/in/[name]-[unique-id]/` format
- **✅ No Placeholder URLs**: Never use fake or placeholder URLs
- **✅ 100% Success Rate**: All contacts must have verified profiles

#### **Verification Process:**
1. **Create verification script** to test all profile URLs
2. **Update placeholder URLs** with real LinkedIn profile URLs
3. **Test click functionality** on all contact cards
4. **Verify no 404 errors** when clicking contact cards
5. **Document verification results** with success/failure rates

#### **Example Verification Script:**
```javascript
// docs/intelligence-verification/verify-intelligence-linkedin-profiles.js
const INTELLIGENCE_CONTACTS = {
  'example-club-1': [
    {
      name: 'Contact Name',
      role: 'Chief Executive Officer',
      priority: 'CRITICAL',
      profileUrl: 'https://www.linkedin.com/in/contact-name-verified-id/',
      // ... other fields
    }
  ]
  // ... other clubs
};
```

### **3. Contact Priority Guidelines**

```typescript
// CRITICAL - Final decision makers
- Chief Executive Officer
- Chief Executive
- Managing Director
- Owner & Chief Executive
- Chairman & Owner

// HIGH - Budget holders and influencers
- Commercial Director
- Operations Director
- Head of Marketing
- Head of Digital
- Club Ambassador

// MEDIUM - Operational decision makers
- Head Coach
- Director of Rugby
- Performance roles

// LOW - Support roles
- Assistant positions
- Junior roles
```

### **4. Contact Removal Criteria**

- ❌ No verified LinkedIn profile
- ❌ Outdated or incorrect information
- ❌ Placeholder or fake data
- ❌ Non-decision making roles
- ❌ Inactive or inaccessible profiles

## 📊 **Data Population Standards**

### **1. Club Information**

```typescript
{
  clubName: 'Exact Club Name',
  website: 'https://www.clubwebsite.com',
  linkedinUrl: 'https://www.linkedin.com/company/club-name/',
  totalMembers: 1234, // Real LinkedIn member count
  digitalMaturity: 25, // 0-100 scale
  opportunityScore: 85, // 0-100 scale
  websiteStatus: 'VERIFIED', // Via MCP
  linkedinStatus: 'VERIFIED', // Via MCP
  division: 'Premier League', // Exact division name
  league: 'English Football', // Sport category
}
```

### **2. Contact Information**

```typescript
{
  name: 'Real Person Name',
  role: 'Exact Job Title',
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  profileUrl: 'https://www.linkedin.com/in/real-name-123456789/', // VERIFIED URL
  connection: '1st degree' | '2nd degree' | '3rd degree',
  availability: 'Open to partnerships' | 'Active on platform' | 'Performance focused',
  relevance: 'Strategic decision maker for technology investments'
}
```

### **3. Insights Data**

```typescript
{
  opportunityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  recommendedApproach: 'Detailed strategic approach description',
  marketSignals: [
    'Specific market signal 1',
    'Specific market signal 2',
    'Specific market signal 3'
  ],
  estimatedBudget: '£100K - £250K',
  timeline: '3-6 months',
  digitalTransformationSignals: [
    'Recent digital investment',
    'Technology hiring',
    'Partnership discussions'
  ]
}
```

## 🎨 **UI Component Standards**

### **1. Page Header**

```typescript
// Standard header format
<div className="text-center mb-8">
  <h1 className="text-4xl font-bold text-white mb-2">
    [Sport] [Division] Intelligence
  </h1>
  <p className="text-slate-300">
    All [X] [Division] Clubs Verified via Bright Data MCP
  </p>
</div>
```

### **2. Statistics Cards**

```typescript
// Standard statistics format
const summaryStats = {
  totalMembers: 12345,
  totalClubs: 20,
  criticalOpportunities: 8,
  verifiedWebsites: 20,
  verifiedLinkedIn: 20,
  avgDigitalMaturity: 25.5
};
```

### **3. Club Cards**

```typescript
// Standard club card structure
<div className="rounded-lg border text-card-foreground shadow-sm bg-custom-box border-custom-border hover:bg-custom-border/50 transition-all duration-300">
  <div className="flex flex-col space-y-1.5 p-6 pb-4">
    {/* Club header with icon, name, stats */}
    {/* Key contacts section */}
    {/* MCP intelligence section */}
    {/* Action buttons */}
  </div>
</div>
```

### **4. Contact Cards**

```typescript
// Clickable contact card with hover effects
<div 
  className="p-2 bg-custom-border/30 rounded text-sm hover:bg-custom-border/50 transition-colors cursor-pointer group relative"
  onClick={() => handleContactClick(contact, clubName)}
  onMouseEnter={() => setContactHover(`${clubKey}-${idx}`)}
  onMouseLeave={() => setContactHover(null)}
>
  {/* Contact content with priority badge */}
  {/* Hover effects with mouse pointer icon */}
</div>
```

## 🔗 **LinkedIn Integration Standards**

### **1. Company LinkedIn Links**

```typescript
// Standard LinkedIn link format with tracking
<a 
  href={`${club.linkedinUrl}?utm_source=yellow-panther-ai&utm_medium=mcp-verified&utm_campaign=${sport}-${division}-intelligence`}
  target="_blank" 
  rel="noopener noreferrer"
  className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 rounded-md px-3 bg-blue-600 hover:bg-blue-700 text-white group"
  title={`Visit ${club.clubName} on LinkedIn (MCP Verified)`}
>
  <LinkedIn className="h-4 w-4 mr-2" />
  LinkedIn
  <ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
</a>
```

### **2. Contact LinkedIn Integration**

```typescript
// Contact click handler with 404 error prevention
const handleContactClick = (contact: LinkedInContact, clubName: string) => {
  if (contact.profileUrl) {
    // Open direct LinkedIn profile (verified, no 404 errors)
    window.open(contact.profileUrl, '_blank');
  } else {
    // Fallback: Search LinkedIn for contact
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contact.name)}%20${encodeURIComponent(clubName)}`;
    window.open(searchUrl, '_blank');
  }
};
```

## 📈 **Scoring and Metrics Standards**

### **1. Opportunity Score Calculation**

```typescript
// Standard opportunity score factors
- Digital Maturity (inverse relationship)
- Total LinkedIn Members
- Number of Critical Contacts
- Market Signals
- Recent Activity
- Network Access
```

### **2. Digital Maturity Scale**

```typescript
// 0-100 scale where lower = higher opportunity
0-20: CRITICAL opportunity
21-40: HIGH opportunity  
41-60: MEDIUM opportunity
61-80: LOW opportunity
81-100: MINIMAL opportunity
```

### **3. Priority Color Coding**

```typescript
export function getOpportunityColor(level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-yellow-500';
    case 'LOW': return 'bg-green-500';
  }
}
```

## 🔧 **Helper Functions Standards**

### **1. Required Helper Functions**

```typescript
// All intelligence data files must include these helpers
export function getOpportunityLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export function getOpportunityColor(level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string
export function getTotalStats(): {
  totalMembers: number;
  totalClubs: number;
  criticalOpportunities: number;
  verifiedWebsites: number;
  verifiedLinkedIn: number;
  avgDigitalMaturity: number;
}
```

### **2. Statistics Calculation**

```typescript
export function getTotalStats() {
  const clubs = Object.values([SPORT]_[DIVISION]_INTELLIGENCE_DATA);
  const totalMembers = clubs.reduce((sum, club) => sum + club.totalMembers, 0);
  const totalClubs = clubs.length;
  const criticalOpportunities = clubs.filter(club => club.opportunityScore >= 80).length;
  const verifiedWebsites = clubs.filter(club => club.websiteStatus === 'VERIFIED').length;
  const verifiedLinkedIn = clubs.filter(club => club.linkedinStatus === 'VERIFIED').length;
  const avgDigitalMaturity = clubs.reduce((sum, club) => sum + club.digitalMaturity, 0) / totalClubs;

  return {
    totalMembers,
    totalClubs,
    criticalOpportunities,
    verifiedWebsites,
    verifiedLinkedIn,
    avgDigitalMaturity
  };
}
```

## 📝 **Implementation Checklist**

### **For New Sports/Divisions:**

- [ ] Create data file: `src/lib/[sport][division]IntelligenceData.ts`
- [ ] Create page file: `src/app/[sport]-[division]-intel/linkedin-overview/page.tsx`
- [ ] Implement standard interfaces
- [ ] Add verified contact data only
- [ ] Include all required helper functions
- [ ] Add MCP verification status
- [ ] Implement clickable contact cards
- [ ] Add LinkedIn integration with tracking
- [ ] **Verify LinkedIn profile URLs** (no 404 errors)
- [ ] Test page functionality
- [ ] Verify data quality (100% verified contacts)
- [ ] Update navigation if needed

### **For Existing Pages:**

- [ ] Verify all contacts have LinkedIn profile URLs
- [ ] **Test all LinkedIn profile URLs** for 404 errors
- [ ] Remove any unverified contacts
- [ ] Update contact priority levels
- [ ] Ensure clickable contact cards
- [ ] Verify MCP integration
- [ ] Test all interactive features
- [ ] Update statistics calculations
- [ ] Validate data consistency

## 🎯 **Quality Assurance Standards**

### **1. Data Quality Requirements**

- ✅ 100% verified LinkedIn profiles for all contacts
- ✅ **No 404 errors** when clicking LinkedIn profile links
- ✅ Accurate club information and statistics
- ✅ Real LinkedIn member counts
- ✅ Verified website and LinkedIn company pages
- ✅ Current job titles and roles
- ✅ Proper priority assignments

### **2. UI/UX Requirements**

- ✅ Responsive design across all devices
- ✅ Consistent styling with design system
- ✅ Smooth hover effects and transitions
- ✅ Accessible color contrast ratios
- ✅ Clear call-to-action buttons
- ✅ Professional presentation

### **3. Functionality Requirements**

- ✅ Clickable contact cards
- ✅ **Working LinkedIn profile integration** (no 404 errors)
- ✅ MCP verification indicators
- ✅ Export functionality
- ✅ Search and filter capabilities
- ✅ Real-time data updates

## 📊 **Success Metrics**

### **1. Data Quality Metrics**

- **Verification Rate**: 100% of contacts must be verified
- **Profile URL Coverage**: 100% of contacts must have LinkedIn profile URLs
- **404 Error Rate**: 0% - no LinkedIn profile links should return 404 errors
- **Data Accuracy**: All information must be current and accurate
- **Contact Relevance**: All contacts must be decision-makers

### **2. User Experience Metrics**

- **Page Load Time**: < 3 seconds
- **Interactive Response**: < 500ms for click events
- **Mobile Responsiveness**: 100% mobile compatibility
- **Accessibility Score**: WCAG 2.1 AA compliance
- **LinkedIn Click Success Rate**: 100% - all profile links must work

### **3. Business Metrics**

- **Click-through Rate**: LinkedIn link engagement
- **Contact Engagement**: Contact card click rates
- **Data Export Usage**: Export functionality usage
- **User Retention**: Return visitor rates

## 🚀 **Scaling Guidelines**

### **1. Multi-Sport Implementation**

```typescript
// Example for multiple sports
- Football: Premier League, Championship, League One
- Rugby: Super League, Championship, League One
- Cricket: County Championship, T20 Blast, One-Day Cup
- Basketball: BBL, WBBL
```

### **2. Division Hierarchy**

```typescript
// Priority order for implementation
1. Top Division (Premier League, Super League)
2. Second Division (Championship)
3. Third Division (League One)
4. Lower Divisions (as needed)
```

### **3. Data Management**

- **Centralized Data**: All sports data in `src/lib/`
- **Consistent Naming**: `[sport][division]IntelligenceData.ts`
- **Standard Interfaces**: Reusable across all sports
- **Quality Control**: Regular verification and updates
- **LinkedIn Verification**: Regular testing of profile URLs

## 📚 **Documentation Requirements**

### **1. Required Documentation**

- [ ] Data source documentation
- [ ] Contact verification process
- [ ] **LinkedIn profile verification documentation** (see `docs/intelligence-verification/INTELLIGENCE_LINKEDIN_VERIFICATION_COMPLETE.md`)
- [ ] MCP integration details
- [ ] UI component specifications
- [ ] Helper function documentation
- [ ] Quality assurance procedures

### **2. Update Procedures**

- [ ] Monthly contact verification
- [ ] **Monthly LinkedIn profile URL testing** (prevent 404 errors)
- [ ] Quarterly data accuracy review
- [ ] Annual comprehensive audit
- [ ] Real-time MCP verification
- [ ] User feedback integration

## 🔗 **Related Documentation**

### **LinkedIn Profile Verification:**
- **`docs/intelligence-verification/INTELLIGENCE_LINKEDIN_VERIFICATION_COMPLETE.md`** - Detailed verification process and results
- **`docs/intelligence-verification/verify-intelligence-linkedin-profiles.js`** - Verification script template
- **`docs/intelligence-verification/INTELLIGENCE_VERIFIED_CONTACTS_UPDATE.md`** - Contact verification and replacement process

### **Implementation Examples:**
- **Rugby League**: `src/lib/rugbyLeagueIntelligenceData.ts` - Verified implementation
- **Premier League**: `src/lib/premierLeagueIntelligenceData.ts` - Standardized implementation

This guide ensures consistent, high-quality intelligence pages across all sports and divisions while maintaining scalability and data integrity standards, with special emphasis on preventing 404 errors in LinkedIn profile links. 