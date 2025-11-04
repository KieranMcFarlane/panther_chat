/**
 * 🎯 RFP Detections List
 * 
 * Displays detected RFP opportunities in a card-based layout similar to tenders page
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RFPDetailModal from '@/components/rfp/RFPDetailModal';
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
  Clock,
  Trophy,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';

interface RFPDetection {
  id: string;
  title: string;
  description: string;
  organization: string;
  location?: string;
  value?: string;
  deadline?: string;
  published?: string;
  source: string;
  source_url: string;
  category: string;
  status: 'detected' | 'analyzing' | 'qualified' | 'responded' | 'rejected';
  type: string;
  confidence: number;
  yellow_panther_fit: number;
  priority_score: number;
  detected_at: string;
  entity_id?: string;
  entity_name?: string;
  contact_info?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  requirements?: string[];
  evaluation_criteria?: string[];
  timeline?: {
    submission_deadline?: string;
    evaluation_period?: string;
    award_date?: string;
  };
  competition?: Array<{
    name: string;
    strength: string;
  }>;
  key_stakeholders?: Array<{
    name: string;
    role: string;
  }>;
  next_steps?: string[];
  internal_notes?: string;
  tags?: string[];
}

interface RFPListResponse {
  opportunities: RFPDetection[];
  total_count: number;
  limit: number;
  offset: number;
  filters: any;
  last_updated: string;
}

// Mock data for fallback
const mockDetections: RFPDetection[] = [
  {
    id: 'rfp-001',
    title: 'Digital Transformation Partnership - Premier League Club',
    description: 'Seeking innovative technology partner for comprehensive digital transformation including CRM implementation, fan engagement platform, and data analytics solutions. This multi-year partnership will transform how we connect with our global fanbase and optimize internal operations.',
    organization: 'Arsenal FC',
    location: 'London, UK',
    value: '£2.5M',
    deadline: '2025-03-15T23:59:59.000Z',
    published: '2025-01-01T00:00:00.000Z',
    source: 'LinkedIn',
    source_url: 'https://linkedin.com/posts/arsenal',
    category: 'Digital Transformation',
    status: 'qualified',
    type: 'RFP',
    confidence: 0.89,
    yellow_panther_fit: 92,
    priority_score: 9,
    detected_at: '2025-01-09T10:30:00.000Z',
    entity_id: 'arsenal-entity-123',
    entity_name: 'Arsenal FC',
    contact_info: {
      email: 'procurement@arsenal.com',
      phone: '+44-20-7619-5000',
      website: 'https://www.arsenal.com'
    },
    requirements: [
      'Proven experience with sports industry digital transformation',
      'CRM implementation for 60M+ global fanbase',
      'Multi-language support (English, Spanish, Chinese)',
      'Mobile-first approach with iOS/Android apps',
      'Real-time analytics and reporting dashboard'
    ],
    evaluation_criteria: [
      'Technical solution architecture (40%)',
      'Cost-effectiveness and value (25%)',
      'Sports industry experience (20%)',
      'Implementation timeline (15%)'
    ],
    timeline: {
      submission_deadline: '2025-03-15T23:59:59.000Z',
      evaluation_period: '4 weeks',
      award_date: '2025-04-30T00:00:00.000Z'
    },
    competition: [
      { name: 'Deloitte Digital', strength: 'Established relationship' },
      { name: 'Accenture Sports', strength: 'Industry specialization' }
    ],
    key_stakeholders: [
      { name: 'Sarah Chen', role: 'Digital Director' },
      { name: 'Mark Rodriguez', role: 'Head of IT' }
    ],
    next_steps: [
      'Schedule discovery call with Digital Director',
      'Prepare technical proposal and case studies',
      'Submit preliminary budget estimate',
      'Arrange stadium tour and system demonstration'
    ],
    internal_notes: 'High priority opportunity - Arsenal has budget approval and is actively evaluating vendors. Their current system is outdated and they need a quick implementation.',
    tags: ['Premier League', 'CRM', 'Mobile Apps', 'Analytics', 'Global Reach']
  },
  {
    id: 'rfp-002',
    title: 'Mobile Fan Engagement Platform',
    description: 'Complete overhaul of mobile platform to support 60,000+ concurrent users with premium fan experience features including AR integration. Seeking cutting-edge mobile development partner to revolutionize fan engagement during live matches and beyond.',
    organization: 'Manchester United',
    location: 'Manchester, UK',
    value: '£1.8M',
    deadline: '2025-02-28T23:59:59.000Z',
    published: '2024-12-15T00:00:00.000Z',
    source: 'LinkedIn',
    source_url: 'https://linkedin.com/posts/manutd',
    category: 'Mobile Development',
    status: 'detected',
    type: 'RFP',
    confidence: 0.91,
    yellow_panther_fit: 95,
    priority_score: 10,
    detected_at: '2025-01-09T09:15:00.000Z',
    entity_id: 'manutd-entity-456',
    entity_name: 'Manchester United',
    contact_info: {
      email: 'innovation@manutd.co.uk',
      phone: '+44-161-868-8000',
      website: 'https://www.manutd.com'
    },
    requirements: [
      'Experience with high-traffic mobile applications (100K+ concurrent users)',
      'AR/VR development capabilities for stadium experiences',
      'Real-time push notification system',
      'Integration with existing ticketing and POS systems',
      'Multi-platform development (iOS, Android)'
    ],
    evaluation_criteria: [
      'Technical innovation and scalability (35%)',
      'User experience design (25%)',
      'Cost and timeline (20%)',
      'Sports integration experience (20%)'
    ],
    timeline: {
      submission_deadline: '2025-02-28T23:59:59.000Z',
      evaluation_period: '3 weeks',
      award_date: '2025-03-30T00:00:00.000Z'
    },
    competition: [
      { name: 'IBM Sports', strength: 'AR technology expertise' },
      { name: 'Cisco Sports', strength: 'Infrastructure scalability' }
    ],
    key_stakeholders: [
      { name: 'David Johnson', role: 'Innovation Director' },
      { name: 'Emma Wilson', role: 'Mobile Product Manager' }
    ],
    next_steps: [
      'Submit letter of intent by next week',
      'Prepare technical architecture proposal',
      'Schedule demo of AR capabilities',
      'Provide case studies of similar implementations'
    ],
    internal_notes: 'Excellent opportunity with Man United - they are looking for innovation beyond typical mobile apps. AR integration is a key differentiator. High urgency due to upcoming season.',
    tags: ['AR/VR', 'High Traffic', 'Real-time', 'Multi-platform', 'Stadium Integration']
  },
  {
    id: 'rfp-003',
    title: 'Sports Analytics Platform Development',
    description: 'Development of advanced sports performance analytics platform with AI-powered insights and real-time data visualization capabilities.',
    organization: 'Chelsea FC',
    location: 'London, UK',
    value: '£1.2M',
    deadline: '2025-03-30T23:59:59.000Z',
    source: 'Cricket West Indies',
    source_url: 'https://windiescricket.com/rfp',
    category: 'Analytics',
    status: 'analyzing',
    type: 'RFP',
    confidence: 0.86,
    yellow_panther_fit: 88,
    priority_score: 8,
    detected_at: '2025-01-08T14:20:00.000Z'
  },
  {
    id: 'rfp-004',
    title: 'Ticketing System Implementation',
    description: 'Implementation, management, and support of integrated ticketing system with real-time analytics and inventory control.',
    organization: 'American Cricket Enterprises',
    location: 'New York, USA',
    value: '$2.1M',
    deadline: '2025-02-15T23:59:59.000Z',
    source: 'ACE Procurement',
    source_url: 'https://ace.cricket/procurement',
    category: 'Ticketing',
    status: 'qualified',
    type: 'Tender',
    confidence: 0.94,
    yellow_panther_fit: 85,
    priority_score: 7,
    detected_at: '2025-01-08T11:45:00.000Z'
  }
];

export default function RFPDetectionsList() {
  const [detections, setDetections] = useState<RFPDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('detected_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRFP, setSelectedRFP] = useState<RFPDetection | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usingRealData, setUsingRealData] = useState(false);
  const [stats, setStats] = useState({
    total_detections: 0,
    qualified_opportunities: 0,
    high_fit_opportunities: 0,
    average_fit_score: 0
  });

  // Data fetching functions
  const fetchDetections = async () => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        status: filterStatus === 'all' ? undefined : filterStatus,
        includeStats: 'false'
      }).toString();

      console.log('🔍 Fetching real RFP detections from database...');
      const response = await fetch(`/api/rfp-intelligence/real-data?${params}`);
      const data = await response.json();
      
      if (data.success && data.data?.opportunities) {
        const realDetections = data.data.opportunities.map((opp: any) => ({
          id: opp.id,
          title: opp.title,
          description: opp.description,
          organization: opp.organization,
          location: opp.location || 'Unknown',
          value: opp.value,
          deadline: opp.deadline,
          published: opp.detected_at,
          source: opp.source || 'Database',
          source_url: opp.source_url,
          category: opp.category || 'General',
          status: opp.status || 'detected',
          type: 'RFP',
          confidence: opp.confidence || 0.8,
          yellow_panther_fit: opp.yellow_panther_fit || 75,
          priority_score: Math.round((opp.yellow_panther_fit || 75) / 10),
          detected_at: opp.detected_at,
          entity_id: opp.entity_id,
          entity_name: opp.entity_name || opp.organization
        }));
        
        console.log(`✅ Loaded ${realDetections.length} real RFP detections from database`);
        setDetections(realDetections);
        setUsingRealData(true);
      } else {
        console.log('⚠️ No real RFP data found, falling back to mock data');
        setDetections(mockDetections);
        setUsingRealData(false);
      }
    } catch (error) {
      console.error('Failed to fetch RFP detections:', error);
      console.log('📋 Using mock data as fallback');
      setDetections(mockDetections);
      setUsingRealData(false);
    }
  };

  const fetchStats = async () => {
    try {
      console.log('📊 Fetching real RFP stats from database...');
      const response = await fetch('/api/rfp-intelligence/real-data?includeStats=true&limit=100');
      const data = await response.json();
      
      if (data.success && data.data?.summary) {
        const summary = data.data.summary;
        setStats({
          total_detections: summary.totalFound || 0,
          qualified_opportunities: summary.highValue || 0,
          high_fit_opportunities: summary.highValue || 0,
          average_fit_score: summary.averageFitScore || 0
        });
        console.log(`✅ Loaded real stats: ${summary.totalFound} total, ${summary.highValue} high value`);
      } else {
        console.log('⚠️ No real stats found, using fallback');
        // Fallback to mock stats
        setStats({
          total_detections: mockDetections.length,
          qualified_opportunities: mockDetections.filter(d => d.status === 'qualified').length,
          high_fit_opportunities: mockDetections.filter(d => d.yellow_panther_fit >= 80).length,
          average_fit_score: mockDetections.reduce((acc, d) => acc + d.yellow_panther_fit, 0) / mockDetections.length
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      console.log('📋 Using mock stats as fallback');
      // Fallback to mock stats
      setStats({
        total_detections: mockDetections.length,
        qualified_opportunities: mockDetections.filter(d => d.status === 'qualified').length,
        high_fit_opportunities: mockDetections.filter(d => d.yellow_panther_fit >= 80).length,
        average_fit_score: mockDetections.reduce((acc, d) => acc + d.yellow_panther_fit, 0) / mockDetections.length
      });
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDetections(),
        fetchStats()
      ]);
      setLoading(false);
    };
    loadData();
  }, [filterStatus, filterCategory, sortBy, sortOrder]);

  const filteredDetections = detections.filter(detection => {
    const matchesSearch = detection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         detection.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         detection.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || detection.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || detection.category.toLowerCase().includes(filterCategory.toLowerCase());
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([
      fetchDetections(),
      fetchStats()
    ]);
  };

  const handleExport = () => {
    const csv = [
      ['Title', 'Organization', 'Category', 'Status', 'Fit Score', 'Confidence', 'Value', 'Deadline', 'Source', 'Description'],
      ...filteredDetections.map(detection => [
        detection.title,
        detection.organization,
        detection.category,
        detection.status,
        detection.yellow_panther_fit.toString(),
        detection.confidence.toString(),
        detection.value || '',
        detection.deadline || '',
        detection.source,
        detection.description
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfp-detections-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getFitColor = (fit: number) => {
    if (fit >= 90) return 'bg-green-500';
    if (fit >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'qualified': return 'bg-green-500';
      case 'analyzing': return 'bg-blue-500';
      case 'detected': return 'bg-yellow-500';
      case 'responded': return 'bg-purple-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'qualified': return <CheckCircle className="w-4 h-4" />;
      case 'analyzing': return <Brain className="w-4 h-4" />;
      case 'detected': return <Zap className="w-4 h-4" />;
      case 'responded': return <Trophy className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getDaysUntilDeadline = (deadline: string | undefined) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const formatConfidence = (confidence: number) => {
    return Math.round(confidence * 100);
  };

  const handleViewRFP = (rfp: RFPDetection) => {
    setSelectedRFP(rfp);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRFP(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Brain className="w-8 h-8 text-primary" />
                Live RFP Detections
              </h1>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                usingRealData 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              }`}>
                {usingRealData ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    Live Data
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Demo Data
                  </>
                )}
              </div>
            </div>
            <p className="text-muted-foreground">
              {usingRealData 
                ? 'Real RFP opportunities from database with AI-powered analysis and scoring'
                : 'Demo RFP opportunities - showing example data structure and functionality'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="w-4 h-4" />
              Total Detections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_detections}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Qualified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.qualified_opportunities}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-yellow-500" />
              High Fit (80%+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.high_fit_opportunities}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4 text-blue-500" />
              Avg Fit Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.average_fit_score.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search RFPs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="detected">Detected</SelectItem>
                <SelectItem value="analyzing">Analyzing</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="digital transformation">Digital Transformation</SelectItem>
                <SelectItem value="mobile development">Mobile Development</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
                <SelectItem value="ticketing">Ticketing</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="detected_at">Detection Date</SelectItem>
                <SelectItem value="yellow_panther_fit">Fit Score</SelectItem>
                <SelectItem value="confidence">Confidence</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* RFP Detections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredDetections.filter(Boolean).map((detection, index) => {
          const daysUntilDeadline = getDaysUntilDeadline(detection.deadline);
          
          // Safety check for required properties
          if (!detection || !detection.id || !detection.title) {
            console.error('Invalid detection data at index', index, detection);
            return null;
          }
          
          return (
            <Card key={detection.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2 line-clamp-2">{detection.title}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Building2 className="w-4 h-4" />
                      <span>{detection.organization}</span>
                      {detection.location && (
                        <>
                          <MapPin className="w-4 h-4 ml-2" />
                          <span>{detection.location}</span>
                        </>
                      )}
                    </div>
                    {detection.entity_name && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
                        <Database className="w-3 h-3" />
                        <span>Entity: {detection.entity_name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-2 py-1 rounded text-white text-xs flex items-center gap-1 ${getStatusColor(detection.status)}`}>
                      {getStatusIcon(detection.status)}
                      {detection.status}
                    </div>
                    <div className={`px-2 py-1 rounded text-white text-xs ${getFitColor(detection.yellow_panther_fit)}`}>
                      {detection.yellow_panther_fit}% Fit
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {detection.description}
                </p>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 text-sm">
                    {detection.value && (
                      <div className="flex items-center gap-1">
                        <PoundSterling className="w-4 h-4" />
                        <span className="font-medium">{detection.value}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Brain className="w-4 h-4" />
                      <span className="font-medium">{formatConfidence(detection.confidence)}% Conf</span>
                    </div>
                    {detection.deadline && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span className={daysUntilDeadline !== null && daysUntilDeadline <= 7 ? 'text-red-600 font-medium' : ''}>
                          {daysUntilDeadline !== null ? (
                            daysUntilDeadline > 0 ? `${daysUntilDeadline} days` : 'Expired'
                          ) : (
                            'No deadline'
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Target className="w-3 h-3" />
                    <span>Priority: {detection.priority_score}/10</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {detection.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {detection.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {detection.source}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleViewRFP(detection)}>
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {detection.source_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a 
                          href={detection.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Source
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredDetections.length === 0 && !loading && (
        <div className="text-center py-12">
          <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No RFP detections found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search criteria or filters to find more opportunities.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* RFP Detail Modal */}
      <RFPDetailModal
        detection={selectedRFP}
        open={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}