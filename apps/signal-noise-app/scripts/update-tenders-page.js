const fs = require('fs');
const path = require('path');

// Read the comprehensive RFP database
const rfpDatabasePath = path.join(__dirname, '..', 'rfp-analysis-results', 'COMPREHENSIVE-AGGREGATE-ALL-RFP-OPPORTUNITIES.json');
const rfpData = JSON.parse(fs.readFileSync(rfpDatabasePath, 'utf8'));

console.log(`📊 Processing ${rfpData.opportunities.length} RFP opportunities from comprehensive database...`);

// Helper function to normalize location
function normalizeLocation(organization, category) {
  // Extract location hints from organization name
  if (organization.toLowerCase().includes('usa') || organization.toLowerCase().includes('american')) {
    return 'USA';
  }
  if (organization.toLowerCase().includes('uk') || organization.toLowerCase().includes('british')) {
    return 'UK';
  }
  if (organization.toLowerCase().includes('france') || organization.toLowerCase().includes('french')) {
    return 'France';
  }
  if (organization.toLowerCase().includes('india') || organization.toLowerCase().includes('indian')) {
    return 'India';
  }
  if (organization.toLowerCase().includes('australia') || organization.toLowerCase().includes('australian')) {
    return 'Australia';
  }
  if (organization.toLowerCase().includes('canada') || organization.toLowerCase().includes('canadian')) {
    return 'Canada';
  }
  
  // Default based on category
  if (category.toLowerCase().includes('international')) {
    return 'Global';
  }
  if (category.toLowerCase().includes('government')) {
    return 'Various';
  }
  
  return 'Global';
}

// Helper function to calculate days until deadline
function getDaysUntilDeadline(deadline) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  return days;
}

// Helper function to get fit color
function getFitColor(fit) {
  if (fit >= 90) return 'bg-green-500';
  if (fit >= 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

// Helper function to normalize status
function normalizeStatus(status) {
  if (status && status.toUpperCase().includes('ACTIVE')) return 'qualified';
  if (status && status.toUpperCase().includes('EMERGING')) return 'emerging';
  return 'qualified';
}

// Convert RFP opportunities to the format expected by the page
const realOpportunities = rfpData.opportunities.map((rfp, index) => {
  const daysUntil = getDaysUntilDeadline(rfp.deadline);
  
  return {
    id: rfp.id || `rfp-${index + 1}`,
    title: rfp.title,
    organization: rfp.organization,
    location: normalizeLocation(rfp.organization, rfp.category),
    value: rfp.estimated_value,
    deadline: rfp.deadline,
    published: rfp.published || rfp.detection_date,
    source: rfp.source_type || 'RFP',
    category: rfp.category,
    status: normalizeStatus(rfp.status),
    type: rfp.type || 'RFP',
    description: rfp.description,
    url: rfp.source_url,
    yellow_panther_fit: rfp.yellow_panther_fit_score,
    contact: rfp.contact,
    priority_score: Math.round(rfp.yellow_panther_fit_score / 10),
    confidence: rfp.confidence_score
  };
}).filter(rfp => rfp.title && rfp.organization); // Filter out incomplete entries

// Sort by Yellow Panther fit score (highest first)
realOpportunities.sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit);

// Generate JavaScript code for the opportunities array
const opportunitiesJS = `// Real RFP opportunities from comprehensive Yellow Panther analysis (${realOpportunities.length} opportunities)
// Generated: ${new Date().toISOString()}
// Source: COMPREHENSIVE-AGGREGATE-ALL-RFP-OPPORTUNITIES.json

const realOpportunities = ${JSON.stringify(realOpportunities, null, 2)};`;

console.log(`✅ Generated JavaScript array with ${realOpportunities.length} real RFP opportunities`);
console.log(`🎯 Top opportunities by fit score:`);
realOpportunities.slice(0, 5).forEach((opp, index) => {
  console.log(`   ${index + 1}. ${opp.title} (${opp.organization}) - ${opp.yellow_panther_fit}% fit - ${opp.value}`);
});

// Write the JavaScript array to a file
fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'real-rfp-opportunities.js'), opportunitiesJS);

console.log(`\n📁 JavaScript array saved to: src/lib/real-rfp-opportunities.js`);

// Now generate HTML cards similar to the original structure
function generateTenderCard(opportunity) {
  const daysUntil = getDaysUntilDeadline(opportunity.deadline);
  const fitColor = getFitColor(opportunity.yellow_panther_fit);
  const statusText = opportunity.status === 'qualified' ? 'qualified' : opportunity.status;
  
  return `
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-shadow">
      <div class="flex flex-col space-y-1.5 p-6">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-semibold tracking-tight text-lg mb-2">${opportunity.title}</h3>
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-building2 w-4 h-4">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
                <path d="M10 6h4"></path>
                <path d="M10 10h4"></path>
                <path d="M10 14h4"></path>
                <path d="M10 18h4"></path>
              </svg>
              <span>${opportunity.organization}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin w-4 h-4 ml-2">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${opportunity.location}</span>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">${statusText}</div>
            <div class="px-2 py-1 rounded text-white text-xs ${fitColor}">${opportunity.yellow_panther_fit}% Fit</div>
          </div>
        </div>
      </div>
      <div class="p-6 pt-0">
        <p class="text-sm text-muted-foreground mb-4 line-clamp-2">${opportunity.description}</p>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-4 text-sm">
            <div class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pound-sterling w-4 h-4">
                <path d="M18 7c0-5.333-8-5.333-8 0"></path>
                <path d="M10 7v14"></path>
                <path d="M6 21h12"></path>
                <path d="M6 13h10"></path>
              </svg>
              <span class="font-medium">${opportunity.value}</span>
            </div>
            <div class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock w-4 h-4">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span class="${daysUntil !== null && daysUntil <= 30 ? 'text-red-600 font-medium' : ''}">
                ${daysUntil !== null ? (daysUntil > 0 ? `${daysUntil} days` : 'Expired') : 'No deadline'}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1 text-xs text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-target w-3 h-3">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>
            <span>Priority: ${opportunity.priority_score}/10</span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">${opportunity.category}</div>
            <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">${opportunity.type}</div>
          </div>
          <div class="flex gap-2">
            <button class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye w-4 h-4 mr-1">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>View
            </button>
            ${opportunity.url ? `
              <a href="${opportunity.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link w-4 h-4 mr-1">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" x2="21" y1="14" y2="3"></line>
                </svg>Source
              </a>
            ` : ''}
          </div>
        </div>
        ${opportunity.contact ? `
          <div class="mt-3 pt-3 border-t border-border">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span class="font-medium">Contact:</span>
              <span>${opportunity.contact}</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>`;
}

// Generate HTML for top 12 opportunities
const topOpportunities = realOpportunities.slice(0, 12);
const htmlCards = topOpportunities.map(generateTenderCard).join('');

// Calculate stats for the page
const totalValueEstimate = realOpportunities.reduce((sum, opp) => {
  const match = opp.value.match(/£?([\d.]+)([KM])/);
  if (match) {
    const value = parseFloat(match[1]);
    const multiplier = match[2] === 'M' ? 1000 : (match[2] === 'K' ? 1 : 1);
    return sum + (value * multiplier);
  }
  return sum;
}, 0);

const urgentDeadlines = realOpportunities.filter(opp => {
  const days = getDaysUntilDeadline(opp.deadline);
  return days !== null && days <= 30 && days > 0;
}).length;

const avgFitScore = Math.round(realOpportunities.reduce((sum, opp) => sum + opp.yellow_panther_fit, 0) / realOpportunities.length);

// Generate updated page content
const updatedPageContent = `/**
 * 🏆 Tenders Page
 * 
 * Live tender opportunities from our comprehensive RFP analysis system (${realOpportunities.length} real opportunities)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Building2, 
  MapPin, 
  PoundSterling, 
  Calendar, 
  ExternalLink, 
  RefreshCw, 
  Filter, 
  Download,
  Eye,
  Target,
  Clock
} from 'lucide-react';

// Import real opportunities from comprehensive database
${opportunitiesJS}

export default function TendersPage() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState({
    total_opportunities: realOpportunities.length,
    total_value_millions: totalValueEstimate > 1000 ? \`\${Math.round(totalValueEstimate/1000)}+\` : '\${Math.round(totalValueEstimate)}',
    urgent_deadlines: urgentDeadlines,
    average_fit_score: avgFitScore
  });

  // Load real RFP data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Try to load from API first, fallback to our comprehensive data
      try {
        const response = await fetch('/api/tenders?action=opportunities&status=qualified&limit=50');
        const data = await response.json();
        
        if (data.opportunities && data.opportunities.length > 0) {
          setOpportunities(data.opportunities);
        } else {
          setOpportunities(realOpportunities);
        }
      } catch (error) {
        console.log('Using local comprehensive RFP data:', error.message);
        setOpportunities(realOpportunities);
      }
      
      setLoading(false);
    };
    
    loadData();
  }, []);

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || opp.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate refresh
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ['Title', 'Organization', 'Location', 'Value', 'Deadline', 'Status', 'Category', 'Fit Score', 'Contact'],
      ...filteredOpportunities.map(opp => [
        opp.title,
        opp.organization,
        opp.location,
        opp.value,
        opp.deadline ? new Date(opp.deadline).toLocaleDateString() : '',
        opp.status,
        opp.category,
        opp.yellow_panther_fit,
        opp.contact || ''
      ])
    ].map(row => row.join(',')).join('\\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`yellow-panther-rfp-opportunities-\${new Date().toISOString().split('T')[0]}.csv\`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getFitColor = (fit: number) => {
    if (fit >= 90) return 'bg-green-500';
    if (fit >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getDaysUntilDeadline = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getStatusVariant = (status: string) => {
    if (status.toUpperCase().includes('ACTIVE')) return 'default';
    if (status.toUpperCase().includes('EMERGING')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">🏆 Live Tender Opportunities</h1>
            <p className="text-muted-foreground">
              Real-time RFP intelligence from comprehensive Yellow Panther analysis • {realOpportunities.length} confirmed opportunities from {rfpData.statistics.total_batches_processed} analysis batches
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} disabled={loading} variant="outline">
              <RefreshCw className={\`w-4 h-4 mr-2 \${loading ? 'animate-spin' : ''}\`} />
              Refresh
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_opportunities}</div>
            <div className="text-xs text-green-500 mt-1">From Comprehensive Analysis</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.total_value_millions}M</div>
            <div className="text-xs text-blue-500 mt-1">Confirmed Opportunities</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Urgent Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgent_deadlines}</div>
            <div className="text-xs text-muted-foreground mt-1">Next 30 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Fit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.average_fit_score}%</div>
            <div className="text-xs text-green-500 mt-1">Yellow Panther Alignment</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search opportunities by title, organization, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md"
            >
              <option value="all">All Status</option>
              <option value="qualified">Qualified</option>
              <option value="emerging">Emerging</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        ${htmlCards}
      </div>

      {filteredOpportunities.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No opportunities found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}`;

// Write the updated page content
fs.writeFileSync(path.join(__dirname, '..', 'src', 'app', 'tenders', 'page-updated.tsx'), updatedPageContent);

console.log(`\n✅ Updated tenders page created with ${realOpportunities.length} real RFP opportunities`);
console.log(`📁 Updated page saved to: src/app/tenders/page-updated.tsx`);
console.log(`\n📊 Summary Statistics:`);
console.log(`   • Total Opportunities: ${realOpportunities.length}`);
console.log(`   • Average Fit Score: ${avgFitScore}%`);
console.log(`   • Urgent Deadlines: ${urgentDeadlines}`);
console.log(`   • Total Pipeline Value: £${totalValueEstimate > 1000 ? Math.round(totalValueEstimate/1000) : Math.round(totalValueEstimate)}M`);
console.log(`\n🎯 To use the updated page:`);
console.log(`   1. Backup the current src/app/tenders/page.tsx`);
console.log(`   2. Replace it with src/app/tenders/page-updated.tsx`);
console.log(`   3. The page will now display real RFP opportunities from our comprehensive database`);