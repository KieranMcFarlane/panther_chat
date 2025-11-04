/**
 * Enhanced Arsenal Dossier Page with Accordion UI
 * Showcases the new accordion-style interface with detailed intelligence
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DossierAccordion, DossierSection } from './DossierAccordion';
import { 
  Users, 
  TrendingUp, 
  Mail, 
  Calendar, 
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  User,
  Building,
  Globe,
  ExternalLink,
  Phone,
  ArrowUpRight,
  Shield,
  BarChart3,
  Lightbulb,
  DollarSign,
  Eye,
  Zap,
  Brain,
  Trophy,
  FileText
} from 'lucide-react';

// Sample enhanced Arsenal data structure for accordion
const enhancedArsenalData: {
  sections: DossierSection[];
} = {
  sections: [
    {
      id: 'executive',
      title: 'Executive Summary',
      defaultOpen: true,
      overall_score: 99,
      priority: 'HIGH',
      subsections: [
        {
          title: 'Overall Assessment',
          content: [
            "Arsenal's digital structure is mature but rigid. Their reliance on NTT DATA constrains innovation velocity while providing stability.",
            "Commercial operations show strong performance but technology partnerships remain conservative.",
            "Brand strength provides platform for experimental digital initiatives.",
            "Current partnership renewal with Emirates demonstrates commercial success and opens doors for technology collaborations."
          ],
          metrics: [
            { label: "Opportunity Score", value: "99/100", trend: "up" },
            { label: "Digital Readiness", value: "25/100", trend: "neutral" },
            { label: "Partnership Accessibility", value: "60/100", trend: "down" },
            { label: "Brand Strength", value: "95/100", trend: "up" }
          ],
          insights: [
            {
              text: "Vendor lock-in with NTT DATA creates both stability and innovation barrier",
              confidence: 90,
              impact: "HIGH",
              source: "Contract analysis & industry reports"
            },
            {
              text: "Recent Emirates renewal indicates satisfaction with current partnerships while creating budget for innovation",
              confidence: 85,
              impact: "MEDIUM",
              source: "Commercial announcement analysis"
            }
          ],
          recommendations: [
            {
              action: "Position Yellow Panther as lightweight experimental R&D wing",
              timeline: "3-6 months",
              priority: "HIGH",
              estimated_impact: "Quick wins to prove value for larger partnerships",
              budget_indicator: "Low entry cost, high ROI potential"
            },
            {
              action: "Leverage 'Arsenal Mind' campaign entry point for wellness technology partnerships",
              timeline: "2-4 months",
              priority: "MEDIUM",
              estimated_impact: "CSR alignment with technology innovation"
            }
          ]
        },
        {
          title: 'Quick Action Items',
          content: [
            "Target Juliet Slot (Commercial Director) with next-gen fan micro-experiences proposal",
            "Engage Mark Gonnella (Comms) for content intelligence and brand sentiment analysis",
            "Approach Josh Kroenke (Vice Chairman) with long-term technology partnership strategy",
            "Utilize Arsenal Women's success for bilingual content testing platform"
          ],
          recommendations: [
            {
              action: "Schedule introductory meeting with Commercial Director",
              timeline: "2-4 weeks",
              priority: "HIGH"
            },
            {
              action: "Prepare case studies from similar Premier League partnerships",
              timeline: "1-2 weeks",
              priority: "HIGH"
            }
          ]
        }
      ]
    },
    {
      id: 'digital',
      title: 'Digital Infrastructure Analysis',
      overall_score: 45,
      priority: 'HIGH',
      subsections: [
        {
          title: 'Current Technology Stack',
          content: [
            "NTT DATA serves as primary digital services vendor providing comprehensive infrastructure",
            "Website built on modern framework but constrained by vendor management processes",
            "Mobile app exists but feature development cycle is lengthy due to external dependencies",
            "Data infrastructure is centralized but access for third-party integrations is limited",
            "Stadium systems include advanced Wi-Fi and digital displays but integration is siloed"
          ],
          metrics: [
            { label: "Website Modernness", value: "7/10", trend: "up" },
            { label: "Integration Flexibility", value: "3/10", trend: "neutral" },
            { label: "Innovation Velocity", value: "2/10", trend: "down" },
            { label: "Data Centralization", value: "8/10", trend: "up" }
          ],
          insights: [
            {
              text: "NTT DATA partnership provides reliability but limits rapid innovation cycles",
              confidence: 85,
              impact: "HIGH"
            },
            {
              text: "Technical team capability is high but decision authority is limited",
              confidence: 75,
              impact: "MEDIUM"
            },
            {
              text: "Stadium technology infrastructure is underutilized for fan engagement",
              confidence: 70,
              impact: "MEDIUM"
            }
          ],
          recommendations: [
            {
              action: "Propose pilot projects that complement rather than replace NTT DATA systems",
              timeline: "3-6 months",
              priority: "HIGH",
              estimated_impact: "Build trust without threatening existing partnerships"
            }
          ]
        },
        {
          title: 'Digital Maturity Assessment',
          content: [
            "Digital Transformation Score: 80/100 indicates strong foundational capabilities",
            "Digital Maturity Score: 25/100 reveals significant improvement opportunities",
            "Fan data collection is sophisticated but activation capabilities are limited",
            "Social media presence is strong but cross-platform integration needs enhancement",
            "E-commerce and ticketing systems are modern but lack personalization engines"
          ],
          metrics: [
            { label: "Transformation Score", value: "80/100" },
            { label: "Maturity Score", value: "25/100" },
            { label: "Fan Data Quality", value: "75/100", trend: "up" },
            { label: "Social Integration", value: "60/100", trend: "up" },
            { label: "E-commerce Modernness", value: "85/100", trend: "up" }
          ],
          insights: [
            {
              text: "High transformation score indicates willingness to invest in digital initiatives",
              confidence: 80,
              impact: "HIGH"
            },
            {
              text: "Low maturity score suggests opportunities for visible quick wins",
              confidence: 90,
              impact: "HIGH"
            }
          ],
          recommendations: [
            {
              action: "Implement fan data integration layer for personalization AI",
              timeline: "6-12 months",
              priority: "MEDIUM",
              estimated_impact: "Significant improvement in fan experience"
            },
            {
              action: "Deploy cross-platform social intelligence dashboard",
              timeline: "3-4 months",
              priority: "MEDIUM",
              estimated_impact: "Enhanced brand monitoring capabilities"
            }
          ]
        }
      ]
    },
    {
      id: 'opportunities',
      title: 'Strategic Opportunities',
      overall_score: 90,
      priority: 'HIGH',
      subsections: [
        {
          title: 'Immediate Launch Opportunities (0-6 months)',
          content: [
            "Digital Twin of the Emirates Stadium - interactive data portal for fan engagement",
            "AI-powered RFP tracking dashboard deployed as white-label pilot program",
            "AR-enhanced supporter experiences for matchday and remote engagement",
            "Women's football digital ecosystem expansion building on record season ticket sales",
            "Mental health and wellness platform integration leveraging 'Arsenal Mind' campaign"
          ],
          metrics: [
            { label: "Implementation Speed", value: "High", trend: "up" },
            { label: "Resource Requirements", value: "Low-Medium", trend: "neutral" },
            { label: "Success Probability", value: "85%", trend: "up" },
            { label: "Fan Impact Potential", value: "90%", trend: "up" }
          ],
          insights: [
            {
              text: "Arsenal Women's record 17,000 season tickets creates ready audience for digital initiatives",
              confidence: 95,
              impact: "HIGH"
            },
            {
              text: "'Arsenal Mind' campaign provides perfect CSR alignment for technology partnerships",
              confidence: 90,
              impact: "MEDIUM"
            }
          ],
          recommendations: [
            {
              action: "Prioritize Digital Twin Emirates project as flagship pilot",
              timeline: "3-4 months",
              priority: "HIGH",
              estimated_impact: "High visibility, measurable fan engagement metrics"
            },
            {
              action: "Develop women's team bilingual content platform for international fan base",
              timeline: "2-3 months",
              priority: "MEDIUM",
              estimated_impact: "Global market expansion demonstration"
            }
          ]
        },
        {
          title: 'Medium-Term Partnerships (6-18 months)',
          content: [
            "Arsenal Women bilingual fan content testing and optimization platform",
            "Seasonal intelligence subscription service for commercial team",
            "Youth academy intelligence system for player development tracking",
            "Global fan engagement analytics platform for commercial optimization",
            "Sustainability data storytelling layer building on Emirates partnership"
          ],
          metrics: [
            { label: "Revenue Potential", value: "High", trend: "up" },
            { label: "Strategic Alignment", value: "90%", trend: "up" },
            { label: "Market Differentiation", value: "Strong", trend: "up" },
            { label: "Partnership Duration", value: "3-5 years", trend: "neutral" }
          ],
          recommendations: [
            {
              action: "Develop comprehensive proposal for Arsenal Women digital expansion",
              timeline: "4-6 months",
              priority: "MEDIUM",
              budget_indicator: "Medium investment, high partnership value"
            },
            {
              action: "Create youth academy intelligence platform pilot",
              timeline: "6-9 months",
              priority: "LOW",
              estimated_impact: "Long-term strategic positioning"
            }
          ]
        },
        {
          title: 'Long-Term Initiatives (18+ months)',
          content: [
            "Full-stack fan engagement platform integrating all digital touchpoints",
            "Global youth academy intelligence system across all age groups",
            "Advanced AI-powered scouting and recruitment optimization platform",
            "Comprehensive digital twin system covering all club operations",
            "Innovation lab partnership for emerging technology testing"
          ],
          metrics: [
            { label: "Investment Level", value: "High", trend: "neutral" },
            { label: "Transformation Impact", value: "Very High", trend: "up" },
            { label: "Competitive Advantage", value: "Significant", trend: "up" }
          ],
          recommendations: [
            {
              action: "Position Yellow Panther as long-term digital transformation partner",
              timeline: "12-18 months",
              priority: "MEDIUM",
              estimated_impact: "Market leadership position"
            }
          ]
        }
      ]
    },
    {
      id: 'leadership',
      title: 'Key Decision Makers',
      overall_score: 80,
      priority: 'HIGH',
      subsections: [
        {
          title: 'Juliet Slot - Commercial Director',
          content: [
            "Controls global partnerships and brand activations with significant budget authority",
            "Professional, outcome-driven communication style focused on measurable ROI",
            "Values storytelling in commercial partnerships, emphasizes brand alignment",
            "Currently overseeing Emirates renewal and sustainability partnership expansion",
            "Background in sports marketing with previous experience at major brands"
          ],
          metrics: [
            { label: "Influence Level", value: "HIGH" },
            { label: "Decision Scope", value: "Global partnerships" },
            { label: "Risk Profile", value: "LOW" },
            { label: "Budget Authority", value: "Significant" },
            { label: "Partnership Experience", value: "Extensive", trend: "up" }
          ],
          insights: [
            {
              text: "Likely receptive to data-driven proposals with clear ROI metrics",
              confidence: 80,
              impact: "HIGH"
            },
            {
              text: "Emirates renewal success demonstrates ability to close major technology deals",
              confidence: 85,
              impact: "MEDIUM"
            }
          ],
          recommendations: [
            {
              action: "Approach with formal proposal including case studies and ROI projections",
              timeline: "2-4 weeks",
              priority: "HIGH",
              estimated_impact: "Gateway to larger commercial partnerships"
            },
            {
              action: "Leverage sustainability focus for technology storytelling opportunities",
              timeline: "4-6 weeks",
              priority: "MEDIUM",
              estimated_impact: "Brand alignment with innovation"
            }
          ]
        },
        {
          title: 'Mark Gonnella - Media & Communications Director',
          content: [
            "Manages brand messaging, content strategy, and media relations",
            "Story-driven approach focused on audience engagement and brand consistency",
            "Overseeing content intelligence needs and brand sentiment analysis requirements",
            "Key stakeholder for 'Arsenal Mind' mental health campaign communications",
            "Responsible for maintaining brand voice across all digital platforms"
          ],
          metrics: [
            { label: "Influence Level", value: "HIGH" },
            { label: "Decision Scope", value: "Brand messaging" },
            { label: "Risk Profile", value: "MEDIUM" },
            { label: "Communication Style", value: "Story-driven" },
            { label: "Creative Authority", value: "Strong", trend: "up" }
          ],
          insights: [
            {
              text: "Content intelligence solutions align perfectly with brand storytelling focus",
              confidence: 75,
              impact: "MEDIUM"
            }
          ],
          recommendations: [
            {
              action: "Propose brand sentiment analysis and content optimization tools",
              timeline: "4-6 weeks",
              priority: "MEDIUM",
              estimated_impact: "Enhanced brand intelligence capabilities"
            },
            {
              action: "Develop content analytics dashboard for campaign effectiveness measurement",
              timeline: "6-8 weeks",
              priority: "LOW",
              estimated_impact: "Demonstrable ROI for marketing initiatives"
            }
          ]
        },
        {
          title: 'Josh Kroenke - Vice Chairman',
          content: [
            "Strategic oversight of long-term vision and major investments",
            "Board-level decision making with focus on sustainable growth",
            "International business expansion and global brand development",
            "Technology partnership philosophy emphasizes innovation and competitive advantage",
            "Family ownership perspective with generational thinking"
          ],
          metrics: [
            { label: "Influence Level", value: "HIGH" },
            { label: "Decision Scope", value: "Strategic direction" },
            { label: "Risk Profile", value: "LOW-MEDIUM" },
            { label: "Investment Horizon", value: "Long-term" },
            { label: "Innovation Focus", value: "High", trend: "up" }
          ],
          insights: [
            {
              text: "Long-term perspective aligns well with transformational technology partnerships",
              confidence: 85,
              impact: "HIGH"
            }
          ],
          recommendations: [
            {
              action: "Present long-term technology vision partnership proposal",
              timeline: "2-3 months",
              priority: "MEDIUM",
              estimated_impact: "Strategic partnership at highest level"
            }
          ]
        }
      ]
    },
    {
      id: 'risk',
      title: 'Risk Assessment & Mitigation',
      overall_score: 60,
      priority: 'MEDIUM',
      subsections: [
        {
          title: 'Business Risks',
          content: [
            "Vendor lock-in with NTT DATA creates significant switching costs and integration challenges",
            "Change resistance within established technology team comfortable with current systems",
            "Budget constraints may prioritize core operations over experimental partnerships",
            "Conservative organizational culture may slow adoption of innovative solutions",
            "High visibility of any technology failures could damage brand reputation"
          ],
          metrics: [
            { label: "Lock-in Risk", value: "HIGH", trend: "neutral" },
            { label: "Change Resistance", value: "MEDIUM", trend: "down" },
            { label: "Budget Flexibility", value: "LOW", trend: "neutral" },
            { label: "Failure Visibility", value: "Very High", trend: "up" }
          ],
          insights: [
            {
              text: "Pilot projects with low commitment and measurable success metrics essential",
              confidence: 90,
              impact: "HIGH"
            },
            {
              text: "Brand protection mindset creates both opportunity and barrier for innovation",
              confidence: 80,
              impact: "MEDIUM"
            }
          ],
          recommendations: [
            {
              action: "Design phased engagement starting with low-risk, high-visibility pilots",
              timeline: "3 months",
              priority: "HIGH",
              estimated_impact: "Build trust and demonstrate value"
            },
            {
              action: "Include comprehensive risk mitigation and brand protection clauses in proposals",
              timeline: "4-6 weeks",
              priority: "MEDIUM",
              estimated_impact: "Address conservative mindset proactively"
            }
          ]
        },
        {
          title: "Implementation Risks",
          content: [
            "Integration challenges with existing NTT DATA systems and data structures",
            "Timeline expectations may not align with typical football season cycles",
            "Staff training requirements for new technology platforms",
            "Data privacy and compliance considerations with fan data",
            "Stakeholder alignment across multiple departments and priorities"
          ],
          metrics: [
            { label: "Technical Complexity", value: "Medium-High", trend: "neutral" },
            { label: "Timeline Risk", value: "Medium", trend: "up" },
            { label: "Training Requirements", value: "Medium", trend: "neutral" }
          ],
          recommendations: [
            {
              action: "Develop detailed implementation roadmap with clear milestones and success metrics",
              timeline: "6-8 weeks",
              priority: "HIGH",
              estimated_impact: "Demonstrate professional approach and planning"
            }
          ]
        }
      ]
    },
    {
      id: 'competitive',
      title: 'Competitive Intelligence',
      overall_score: 75,
      priority: 'MEDIUM',
      subsections: [
        {
          title: 'Market Positioning',
          content: [
            "Arsenal positioned in top tier of Premier League digital innovation despite conservative approach",
            "Brand strength and global fan base provide competitive advantage for digital initiatives",
            "Women's team success creates differentiation opportunities in digital engagement",
            "London location provides access to technology talent and partnerships",
            "International fan base across multiple continents creates diverse engagement opportunities"
          ],
          metrics: [
            { label: "League Position", value: "2nd" },
            { label: "Digital Ranking", value: "5th", trend: "up" },
            { label: "Brand Value", value: "Very High", trend: "up" },
            { label: "Global Reach", value: "150M+ fans", trend: "up" },
            { label: "Women's Team Success", value: "Leader", trend: "up" }
          ],
          insights: [
            {
              text: "Women's team digital engagement significantly outperforms competitors",
              confidence: 85,
              impact: "HIGH"
            },
            {
              text: "International fan base provides testing ground for multi-language AI solutions",
              confidence: 75,
              impact: "MEDIUM"
            }
          ]
        },
        {
          title: 'Technology Partner Landscape',
          content: [
            "NTT DATA as primary partner provides stability but limits agility",
            "Emirates partnership demonstrates successful long-term commercial relationships",
            "Nike kit supplier partnership includes digital marketing components",
            "Multiple stadium technology vendors create integration opportunities",
            "Emerging partnerships with fintech and streaming companies"
          ],
          metrics: [
            { label: "Partner Satisfaction", value: "High", trend: "up" },
            { label: "Integration Complexity", value: "Medium", trend: "neutral" },
            { label: "Partner Diversity", value: "Medium", trend: "up" }
          ],
          recommendations: [
            {
              action: "Position Yellow Panther as complementary rather than competitive to existing partners",
              timeline: "2-4 weeks",
              priority: "HIGH",
              estimated_impact: "Reduce resistance and increase partnership likelihood"
            }
          ]
        }
      ]
    },
    {
      id: 'rfp-intelligence',
      title: 'RFP Intelligence & Market Opportunities',
      defaultOpen: true,
      overall_score: 92,
      priority: 'HIGH',
      subsections: [
        {
          title: 'Active Tender Intelligence',
          content: [
            "Comprehensive monitoring of 50+ live RFP opportunities across global sports organizations",
            "Real-time analysis of procurement opportunities valued at £300K-£4M+ per opportunity",
            "Specialized focus on digital transformation, event management, and technology infrastructure tenders",
            "Strategic mapping of Yellow Panther capabilities to active procurement requirements",
            "Continuous intelligence gathering from IOC, FIFA, World Athletics, and major sports federations"
          ],
          metrics: [
            { label: "Live Opportunities", value: "50+", trend: "up" },
            { label: "Total Pipeline Value", value: "£100M+", trend: "up" },
            { label: "Success Rate", value: "85%", trend: "up" },
            { label: "Avg. Fit Score", value: "88%", trend: "up" }
          ],
          insights: [
            {
              text: "IOC Olympic Committee actively seeking £800K-£1.5M venue infrastructure solutions",
              confidence: 95,
              impact: "HIGH",
              source: "Live RFP monitoring"
            },
            {
              text: "World Athletics £1.5M-£2.5M results and statistics service represents perfect capability match",
              confidence: 90,
              impact: "HIGH",
              source: "Active tender analysis"
            },
            {
              text: "FIFA World Cup 2026 digital twin platform opportunity aligns with Arsenal technology expertise",
              confidence: 88,
              impact: "MEDIUM",
              source: "Strategic partnership analysis"
            }
          ],
          recommendations: [
            {
              action: "Prioritize IOC, World Athletics, and FIFA tenders for immediate response",
              timeline: "2-4 weeks",
              priority: "HIGH",
              estimated_impact: "High-value strategic partnerships with global sports organizations"
            },
            {
              action: "Develop Arsenal-specific case studies for digital transformation expertise",
              timeline: "1-2 months", 
              priority: "MEDIUM",
              estimated_impact: "Leverage Arsenal brand reputation for tender competitive advantage"
            }
          ]
        },
        {
          title: 'High-Value Opportunities Analysis',
          content: [
            "IOC Olympic infrastructure tender: £800K-£1.5M for venue temporary infrastructure cost management",
            "World Athletics results service: £1.5M-£2.5M for 5-year comprehensive statistics platform",
            "FIFA World Cup 2026: £700K-£1.2M for digital twin and common operating platform development",
            "Digital India Corporation: £650K-£1.2M for comprehensive digital event engagement solution",
            "UCI Cycling Esports: £600K-£1.2M for 2024-2026 World Championships organization"
          ],
          metrics: [
            { label: "Top 5 Opportunities", value: "£5.35M+" },
            { label: "Average Contract Value", value: "£1.07M" },
            { label: "Fit Score Range", value: "88-95%" },
            { label: "Response Timeline", value: "30-90 days" }
          ],
          insights: [
            {
              text: "Government and international federation tenders offer highest stability and long-term value",
              confidence: 92,
              impact: "HIGH"
            },
            {
              text: "Digital transformation focus across all tenders aligns perfectly with Yellow Panther capabilities",
              confidence: 88,
              impact: "HIGH"
            }
          ],
          recommendations: [
            {
              action: "Allocate dedicated bid team for top 3 opportunities",
              timeline: "Immediate",
              priority: "HIGH",
              estimated_impact: "Maximize success probability for highest-value opportunities"
            },
            {
              action: "Develop Arsenal-specific technology case studies for competitive differentiation",
              timeline: "2-3 weeks",
              priority: "MEDIUM",
              estimated_impact: "Enhanced bid competitiveness leveraging Arsenal success stories"
            }
          ]
        },
        {
          title: 'Market Intelligence Dashboard',
          content: [
            "Real-time monitoring of 4,750+ entities across international sports organizations",
            "Automated opportunity scoring based on Yellow Panther capability alignment",
            "Strategic analysis of market trends and procurement patterns in sports technology",
            "Competitive intelligence on other bidders and market positioning strategies",
            "Integration with Arsenal brand reputation and technology success stories"
          ],
          metrics: [
            { label: "Entities Monitored", value: "4,750+" },
            { label: "Analysis Batches", value: "19+" },
            { label: "Opportunity Detection", value: "Real-time" },
            { label: "Success Prediction", value: "85%" }
          ],
          insights: [
            {
              text: "Sports technology procurement increasing 35% year-over-year post-pandemic",
              confidence: 90,
              impact: "HIGH"
            },
            {
              text: "Digital transformation budgets growing across all sports organizations",
              confidence: 88,
              impact: "MEDIUM"
            }
          ],
          recommendations: [
            {
              action: "Expand monitoring to include emerging sports technology sectors",
              timeline: "Ongoing",
              priority: "MEDIUM",
              estimated_impact: "Early identification of new market opportunities"
            }
          ]
        }
      ]
    }
  ]
};

interface EnhancedArsenalDossierProps {
  entity?: any;
  onEmailEntity?: () => void;
  dossier?: any;
  entityId?: string;
  onRefresh?: () => void;
}

function EnhancedArsenalDossier({
  entity,
  onEmailEntity,
  dossier,
  entityId,
  onRefresh
}: EnhancedArsenalDossierProps) {
  const [data, setData] = useState(enhancedArsenalData);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate refresh with enhanced prompt
    setTimeout(() => {
      setLoading(false);
      onRefresh?.();
    }, 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Building className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-3xl">Arsenal FC</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="secondary">Football Club</Badge>
                    <Badge variant="outline" className="flex items-center space-x-1">
                      <Globe className="h-3 w-3" />
                      <span>London, England</span>
                    </Badge>
                    <Badge className="bg-red-500 text-white">WATCHLIST</Badge>
                    <Badge className="bg-blue-500 text-white">PRIORITY 99/100</Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button size="sm">
                Export Dossier
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Priority Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Opportunity Score</p>
                  <p className="text-2xl font-bold text-blue-900">99/100</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Digital Readiness</p>
                  <p className="text-2xl font-bold text-yellow-900">25/100</p>
                </div>
                <BarChart3 className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Partnership Fit</p>
                  <p className="text-2xl font-bold text-green-900">85/100</p>
                </div>
                <Users className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Innovation Potential</p>
                  <p className="text-2xl font-bold text-purple-900">92/100</p>
                </div>
                <Lightbulb className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
          
          {/* Quick Summary */}
          <div className="bg-gradient-to-r from-red-50 to-blue-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Strategic Assessment</h3>
                <p className="text-sm text-gray-700 max-w-3xl">
                  Arsenal's digital structure is mature but rigid. Their reliance on NTT DATA constrains innovation velocity, 
                  creating opportunities for Yellow Panther to position as a lightweight experimental R&D wing for pilot projects.
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 h-auto p-1 bg-gray-100 rounded-lg">
          <TabsTrigger 
            value="overview" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Eye className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="digital" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Zap className="h-4 w-4" />
            Digital
          </TabsTrigger>
          <TabsTrigger 
            value="ai-insights" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Brain className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger 
            value="opportunities" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger 
            value="leadership" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" />
            Leadership
          </TabsTrigger>
          <TabsTrigger 
            value="news" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            News
          </TabsTrigger>
          <TabsTrigger 
            value="league" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Trophy className="h-4 w-4" />
            League
          </TabsTrigger>
          <TabsTrigger 
            value="contact" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Mail className="h-4 w-4" />
            Contact
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Show all accordion sections */}
        <TabsContent 
          value="overview" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <DossierAccordion sections={enhancedArsenalData.sections} />
        </TabsContent>

        {/* Digital Tab - Show digital-related sections */}
        <TabsContent 
          value="digital" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <DossierAccordion sections={enhancedArsenalData.sections.filter(section => 
            section.id === 'digital' || section.title.toLowerCase().includes('digital')
          )} />
        </TabsContent>

        {/* AI Insights Tab - Show intelligence sections */}
        <TabsContent 
          value="ai-insights" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <DossierAccordion sections={enhancedArsenalData.sections.filter(section => 
            section.id === 'executive' || section.title.toLowerCase().includes('intelligence')
          )} />
        </TabsContent>

        {/* Opportunities Tab - Show opportunity sections */}
        <TabsContent 
          value="opportunities" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <DossierAccordion sections={enhancedArsenalData.sections.filter(section => 
            section.id === 'opportunities' || section.title.toLowerCase().includes('opportunit')
          )} />
        </TabsContent>

        {/* Leadership Tab - Show leadership sections */}
        <TabsContent 
          value="leadership" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <DossierAccordion sections={enhancedArsenalData.sections.filter(section => 
            section.id === 'leadership' || section.title.toLowerCase().includes('decision')
          )} />
        </TabsContent>

        {/* News Tab - Show news-related content */}
        <TabsContent 
          value="news" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent News & Developments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Arsenal and Emirates renew sustainability partnership</h4>
                  <p className="text-sm text-gray-600 mb-2">Extension of long-term commercial partnership with enhanced sustainability focus.</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Partnership</Badge>
                    <span className="text-xs text-gray-500">September 2024</span>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Arsenal Women reach record 17,000 season ticket sales</h4>
                  <p className="text-sm text-gray-600 mb-2">Historic milestone for women's football demonstrates commercial growth.</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Sports</Badge>
                    <span className="text-xs text-gray-500">September 2024</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* League Tab - Show league context */}
        <TabsContent 
          value="league" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Premier League Context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Current Position</h4>
                  <div className="text-3xl font-bold">2nd</div>
                  <div className="text-sm text-gray-600">17 points, 5 matches</div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">Recent Form</h4>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                    <div className="w-8 h-8 bg-gray-400 rounded flex items-center justify-center text-white text-xs font-bold">D</div>
                    <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                    <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                    <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab - Show contact information */}
        <TabsContent 
          value="contact" 
          className="space-y-4 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Key Contacts</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Juliet Slot - Commercial Director</span>
                      <Badge variant="outline">Formal proposal preferred</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Mark Gonnella - Comms Director</span>
                      <Badge variant="outline">Creative pitch preferred</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Josh Kroenke - Vice Chairman</span>
                      <Badge variant="outline">Executive summary preferred</Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Organization</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <a href="https://www.arsenal.com/" target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:underline">https://www.arsenal.com/</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span>Emirates Stadium, London, England</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      </div>
  );
};

export default EnhancedArsenalDossier;