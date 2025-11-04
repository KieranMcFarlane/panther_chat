// Enhanced Arsenal-Style Club Analysis Prompt for Accordion UI
export const ARSENAL_STYLE_CLUB_PROMPT = `
You are a senior business intelligence analyst specializing in sports technology partnerships. Generate comprehensive, detailed analysis for {name} football club structured specifically for accordion-style UI components with nested expandable sections.

CLUB DETAILS:
Name: {name}
Type: {type}
Sport: {sport}
Current Data: {currentData}

REQUIREMENTS:
Generate structured JSON with highly detailed content suitable for multi-level accordion components. Each section should contain 3-5 subsections with specific, actionable intelligence. Include metrics, confidence scores, and strategic recommendations.

OUTPUT STRUCTURE:

{
  "sections": [
    {
      "id": "executive",
      "title": "Executive Summary",
      "defaultOpen": true,
      "overall_score": 85,
      "priority": "HIGH",
      "subsections": [
        {
          "title": "Overall Assessment",
          "content": [
            "Arsenal's digital structure is mature but rigid. Their reliance on NTT DATA constrains innovation velocity while providing stability.",
            "Commercial operations show strong performance but technology partnerships remain conservative.",
            "Brand strength provides platform for experimental digital initiatives."
          ],
          "metrics": [
            {"label": "Opportunity Score", "value": "99/100", "trend": "up"},
            {"label": "Digital Readiness", "value": "25/100", "trend": "neutral"},
            {"label": "Partnership Accessibility", "value": "60/100", "trend": "down"}
          ],
          "insights": [
            {
              "text": "Vendor lock-in with NTT DATA creates both stability and innovation barrier",
              "confidence": 90,
              "impact": "HIGH",
              "source": "Contract analysis & industry reports"
            }
          ],
          "recommendations": [
            {
              "action": "Position Yellow Panther as lightweight experimental R&D wing",
              "timeline": "3-6 months",
              "priority": "HIGH",
              "estimated_impact": "Quick wins to prove value for larger partnerships",
              "budget_indicator": "Low entry cost, high ROI potential"
            }
          ]
        },
        {
          "title": "Quick Action Items",
          "content": [
            "Target Juliet Slot (Commercial Director) with next-gen fan micro-experiences proposal",
            "Engage Mark Gonnella (Comms) for content intelligence and brand sentiment analysis",
            "Approach Josh Kroenke (Vice Chairman) with long-term technology partnership strategy"
          ],
          "recommendations": [
            {
              "action": "Schedule introductory meeting with Commercial Director",
              "timeline": "2-4 weeks",
              "priority": "HIGH"
            }
          ]
        }
      ]
    },
    {
      "id": "digital",
      "title": "Digital Infrastructure Analysis",
      "overall_score": 45,
      "priority": "HIGH",
      "subsections": [
        {
          "title": "Current Technology Stack",
          "content": [
            "NTT DATA serves as primary digital services vendor providing comprehensive infrastructure",
            "Website built on modern framework but constrained by vendor management processes",
            "Mobile app exists but feature development cycle is lengthy due to external dependencies",
            "Data infrastructure is centralized but access for third-party integrations is limited"
          ],
          "metrics": [
            {"label": "Website Modernness", "value": "7/10", "trend": "up"},
            {"label": "Integration Flexibility", "value": "3/10", "trend": "neutral"},
            {"label": "Innovation Velocity", "value": "2/10", "trend": "down"}
          ],
          "insights": [
            {
              "text": "NTT DATA partnership provides reliability but limits rapid innovation cycles",
              "confidence": 85,
              "impact": "HIGH"
            },
            {
              "text": "Technical team capability is high but decision authority is limited",
              "confidence": 75,
              "impact": "MEDIUM"
            }
          ]
        },
        {
          "title": "Digital Maturity Assessment",
          "content": [
            "Digital Transformation Score: 80/100 indicates strong foundational capabilities",
            "Digital Maturity Score: 25/100 reveals significant improvement opportunities",
            "Fan data collection is sophisticated but activation capabilities are limited",
            "Social media presence is strong but cross-platform integration needs enhancement"
          ],
          "metrics": [
            {"label": "Transformation Score", "value": "80/100"},
            {"label": "Maturity Score", "value": "25/100"},
            {"label": "Fan Data Quality", "value": "75/100", "trend": "up"},
            {"label": "Social Integration", "value": "60/100", "trend": "up"}
          ],
          "recommendations": [
            {
              "action": "Implement fan data integration layer for personalization AI",
              "timeline": "6-12 months",
              "priority": "MEDIUM",
              "estimated_impact": "Significant improvement in fan experience"
            }
          ]
        }
      ]
    },
    {
      "id": "opportunities",
      "title": "Strategic Opportunities",
      "overall_score": 90,
      "priority": "HIGH",
      "subsections": [
        {
          "title": "Immediate Launch Opportunities (0-6 months)",
          "content": [
            "Digital Twin of the Emirates Stadium - interactive data portal for fan engagement",
            "AI-powered RFP tracking dashboard deployed as white-label pilot program",
            "AR-enhanced supporter experiences for matchday and remote engagement",
            "Women's football digital ecosystem expansion building on record season ticket sales"
          ],
          "metrics": [
            {"label": "Implementation Speed", "value": "High", "trend": "up"},
            {"label": "Resource Requirements", "value": "Low-Medium", "trend": "neutral"},
            {"label": "Success Probability", "value": "85%", "trend": "up"}
          ],
          "recommendations": [
            {
              "action": "Prioritize Digital Twin Emirates project as flagship pilot",
              "timeline": "3-4 months",
              "priority": "HIGH",
              "estimated_impact": "High visibility, measurable fan engagement metrics"
            }
          ]
        },
        {
          "title": "Medium-Term Partnerships (6-18 months)",
          "content": [
            "Arsenal Women bilingual fan content testing and optimization platform",
            "Seasonal intelligence subscription service for commercial team",
            "Mental health and wellness platform integration leveraging 'Arsenal Mind' campaign",
            "Youth academy intelligence system for player development tracking"
          ],
          "metrics": [
            {"label": "Revenue Potential", "value": "High", "trend": "up"},
            {"label": "Strategic Alignment", "value": "90%", "trend": "up"},
            {"label": "Market Differentiation", "value": "Strong", "trend": "up"}
          ],
          "recommendations": [
            {
              "action": "Develop comprehensive proposal for Arsenal Women digital expansion",
              "timeline": "4-6 months",
              "priority": "MEDIUM",
              "budget_indicator": "Medium investment, high partnership value"
            }
          ]
        }
      ]
    },
    {
      "id": "leadership",
      "title": "Key Decision Makers",
      "overall_score": 80,
      "priority": "HIGH",
      "subsections": [
        {
          "title": "Juliet Slot - Commercial Director",
          "content": [
            "Controls global partnerships and brand activations with significant budget authority",
            "Professional, outcome-driven communication style focused on measurable ROI",
            "Values storytelling in commercial partnerships, emphasizes brand alignment",
            "Currently overseeing Emirates renewal and sustainability partnership expansion"
          ],
          "metrics": [
            {"label": "Influence Level", "value": "HIGH"},
            {"label": "Decision Scope", "value": "Global partnerships"},
            {"label": "Risk Profile", "value": "LOW"},
            {"label": "Budget Authority", "value": "Significant"}
          ],
          "insights": [
            {
              "text": "Likely receptive to data-driven proposals with clear ROI metrics",
              "confidence": 80,
              "impact": "HIGH"
            }
          ],
          "recommendations": [
            {
              "action": "Approach with formal proposal including case studies and ROI projections",
              "timeline": "2-4 weeks",
              "priority": "HIGH",
              "estimated_impact": "Gateway to larger commercial partnerships"
            }
          ]
        },
        {
          "title": "Mark Gonnella - Media & Communications Director",
          "content": [
            "Manages brand messaging, content strategy, and media relations",
            "Story-driven approach focused on audience engagement and brand consistency",
            "Overseeing content intelligence needs and brand sentiment analysis requirements",
            "Key stakeholder for 'Arsenal Mind' mental health campaign communications"
          ],
          "metrics": [
            {"label": "Influence Level", "value": "HIGH"},
            {"label": "Decision Scope", "value": "Brand messaging"},
            {"label": "Risk Profile", "value": "MEDIUM"},
            {"label": "Communication Style", "value": "Story-driven"}
          ],
          "recommendations": [
            {
              "action": "Propose brand sentiment analysis and content optimization tools",
              "timeline": "4-6 weeks",
              "priority": "MEDIUM",
              "estimated_impact": "Enhanced brand intelligence capabilities"
            }
          ]
        }
      ]
    },
    {
      "id": "risk",
      "title": "Risk Assessment & Mitigation",
      "overall_score": 60,
      "priority": "MEDIUM",
      "subsections": [
        {
          "title": "Business Risks",
          "content": [
            "Vendor lock-in with NTT DATA creates significant switching costs and integration challenges",
            "Change resistance within established technology team comfortable with current systems",
            "Budget constraints may prioritize core operations over experimental partnerships",
            "Conservative organizational culture may slow adoption of innovative solutions"
          ],
          "metrics": [
            {"label": "Lock-in Risk", "value": "HIGH", "trend": "neutral"},
            {"label": "Change Resistance", "value": "MEDIUM", "trend": "down"},
            {"label": "Budget Flexibility", "value": "LOW", "trend": "neutral"}
          ],
          "insights": [
            {
              "text": "Pilot projects with low commitment and measurable success metrics essential",
              "confidence": 90,
              "impact": "HIGH"
            }
          ],
          "recommendations": [
            {
              "action": "Design phased engagement starting with low-risk, high-visibility pilots",
              "timeline": "3 months",
              "priority": "HIGH",
              "estimated_impact": "Build trust and demonstrate value"
            }
          ]
        }
      ]
    },
    {
      "id": "competitive",
      "title": "Competitive Intelligence",
      "overall_score": 75,
      "priority": "MEDIUM",
      "subsections": [
        {
          "title": "Market Positioning",
          "content": [
            "Arsenal positioned in top tier of Premier League digital innovation despite conservative approach",
            "Brand strength and global fan base provide competitive advantage for digital initiatives",
            "Women's team success creates differentiation opportunities in digital engagement",
            "London location provides access to technology talent and partnerships"
          ],
          "metrics": [
            {"label": "League Position", "value": "2nd"},
            {"label": "Digital Ranking", "value": "5th", "trend": "up"},
            {"label": "Brand Value", "value": "Very High", "trend": "up"}
          ]
        }
      ]
    },
    {
      "id": "connections",
      "title": "LinkedIn Connection Analysis",
      "overall_score": 70,
      "priority": "HIGH",
      "subsections": [
        {
          "title": "Yellow Panther UK Team Connection Analysis",
          "content": [
            "Analysis of LinkedIn connections between Yellow Panther UK team members and {name} decision makers",
            "Primary focus on Stuart Cope's network with secondary analysis of all Yellow Panther UK team members",
            "Identification of mutual connections, shared networks, and company relationships across the entire Yellow Panther UK team"
          ],
          "metrics": [
            {"label": "Stuart Cope Connections", "value": "To be analyzed", "trend": "neutral"},
            {"label": "YP UK Team Coverage", "value": "To be analyzed", "trend": "neutral"},
            {"label": "Combined Network Strength", "value": "To be analyzed", "trend": "neutral"}
          ],
          "insights": [
            {
              "text": "Comprehensive Yellow Panther UK team network analysis will identify optimal introduction paths, with Stuart Cope serving as primary connection anchor",
              "confidence": 90,
              "impact": "HIGH",
              "source": "Yellow Panther UK team connection mapping required"
            }
          ],
          "recommendations": [
            {
              "action": "Execute comprehensive LinkedIn connection analysis for all Yellow Panther UK team members",
              "timeline": "Immediate",
              "priority": "HIGH",
              "estimated_impact": "Identify warmest introduction paths through entire Yellow Panther UK network"
            }
          ]
        },
        {
          "title": "Team-Specific Introduction Strategies",
          "content": [
            "Personalized messaging strategies for each Yellow Panther UK team member's network connections",
            "Optimal timing and context for introduction requests through different team members",
            "Alternative approaches leveraging multiple Yellow Panther team member connections when available"
          ],
          "recommendations": [
            {
              "action": "Develop team-specific introduction messaging based on each Yellow Panther UK member's connection context",
              "timeline": "1-2 weeks",
              "priority": "MEDIUM",
              "estimated_impact": "Maximize success probability through optimal team member selection"
            }
          ]
        }
      ]
    }
  ]
}

LINKEDIN CONNECTION ANALYSIS REQUIREMENTS:
Use BrightData MCP tools to analyze LinkedIn connections between Yellow Panther UK team and {name} decision makers:

1. YELLOW PANTHER UK TEAM DISCOVERY:
   - First, scrape all Yellow Panther UK team members from: https://www.linkedin.com/search/results/people/?keywords=yellow%20panther&origin=CLUSTER_EXPANSION
   - Identify Stuart Cope as primary connection: https://www.linkedin.com/in/stuart-cope-54392b16/
   - Map all other Yellow Panther UK team members as secondary connections
   - Analyze team structure, roles, and network diversity

2. COMPREHENSIVE CONNECTION MAPPING:
   - Map connections from ALL Yellow Panther UK team members to target executives
   - Give 1.5x weight to connection paths through Stuart Cope (primary connection)
   - Identify mutual connections across the entire Yellow Panther UK team
   - Analyze 2nd-degree connection chains through shared networks
   - Evaluate company relationships (former colleagues, alumni networks, industry associations)

3. TEAM-CENTRIC STRENGTH ASSESSMENT:
   - Rate connection paths: STRONG (direct/recent mutual through any YP UK member), MEDIUM (older mutual/strong 2nd degree), WEAK (distant connections)
   - Assess team network coverage and diversity
   - Identify opportunities where multiple Yellow Panther team members have connections
   - Prioritize Stuart Cope connections while leveraging full team network

4. YELLOW PANTHER SPECIFIC INTRODUCTION STRATEGY:
   - Recommend optimal introduction approach for each Yellow Panther UK team member
   - Provide team-specific messaging angles and talking points
   - Suggest timing and context based on each team member's relationship context
   - Identify collaborative approaches when multiple team members have connections

5. OUTPUT STRUCTURE:
   {
     "connection_analysis": {
       "target_entity": "{name}",
       "analysis_date": "current_date",
       "yellow_panther_uk_team": {
         "team_members": [
           {
             "name": "Stuart Cope",
             "linkedin_url": "https://www.linkedin.com/in/stuart-cope-54392b16/",
             "role": "Primary Connection",
             "connection_count": 0,
             "is_primary": true
           },
           // Additional team members from LinkedIn search
         ],
         "total_connections_found": 0,
         "network_diversity_score": 0
       },
       "introduction_paths": [
         {
           "yellow_panther_contact": "Stuart Cope",
           "target_decision_maker": "Executive name and role",
           "connection_strength": "STRONG|MEDIUM|WEAK",
           "connection_type": "DIRECT|MUTUAL_CONNECTION|2ND_DEGREE|COMPANY_NETWORK",
           "confidence_score": 85,
           "is_primary_path": true,
           "mutual_connections": ["List of shared connections"],
           "connection_context": "Professional background and relationship details",
           "introduction_strategy": "Stuart Cope-specific approach and messaging",
           "alternative_paths": ["Backup options through other YP team members"]
         }
       ],
       "recommendations": {
         "optimal_team_member": "Best Yellow Panther UK contact for this target",
         "messaging_strategy": "Team-specific personalized approach",
         "timing_suggestions": "Optimal moments for outreach",
         "success_probability": "Overall likelihood of successful introduction",
         "team_coordination": "How multiple team members can collaborate"
       }
     }
   }

Execute comprehensive LinkedIn connection analysis for the entire Yellow Panther UK team, with Stuart Cope as the primary connection anchor, to identify the warmest introduction paths to {name} decision makers.

YELLOW PANTHER CONTEXT:
Generate actionable business intelligence focusing on:
- Technology partnership opportunities that complement existing NTT DATA relationship
- Fan engagement optimization through data-driven insights
- Commercial intelligence for sponsorship and partnership optimization
- Innovation opportunities that align with Arsenal's brand values
- Low-risk entry points for experimental digital initiatives

Include specific metrics, confidence scores, and strategic recommendations for each subsection. Ensure content is detailed enough to provide value when expanded in accordion components.
`;

// Usage example for calling the enhanced prompt
export const generateEnhancedClubDossier = (clubName: string, clubType: string, sport: string, currentData: any) => {
  return ARSENAL_STYLE_CLUB_PROMPT
    .replace(/{name}/g, clubName)
    .replace(/{type}/g, clubType)
    .replace(/{sport}/g, sport)
    .replace(/{currentData}/g, JSON.stringify(currentData, null, 2));
};