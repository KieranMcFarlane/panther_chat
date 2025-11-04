'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityBadge } from '@/components/badge/EntityBadge';
import { EmailAssistant } from '@/components/email/EmailAssistant';
import { EmailConversationThread } from '@/components/email/EmailConversationThread';
import { AIEmailAgent } from '@/components/email/AIEmailAgent';
import { EmailComposeModal } from '@/components/email/EmailComposeModal';
import Header from '@/components/header/Header';
import { useEntity } from '@/lib/swr-config';
import { 
  ArrowLeft, User, Mail, Phone, Building, Star, MessageCircle, 
  Calendar, MapPin, Award, Target, Brain, Reply, Clock,
  CheckCircle, AlertCircle, Send, Settings, BarChart3, Users
} from 'lucide-react';

interface PersonProfile {
  id: string;
  neo4j_id: string | number;
  labels: string[];
  properties: {
    name: string;
    role?: string;
    affiliation?: string;
    email?: string;
    phone?: string;
    location?: string;
    bio?: string;
    expertise?: string[];
    interests?: string[];
    contactHistory?: EmailRecord[];
    aiAgentConfig?: AIAgentConfig;
    communicationStyle?: string;
    preferredContactTime?: string;
    timezone?: string;
    responseRate?: number;
    lastContact?: string;
    priorityLevel?: string;
    relationshipScore?: number;
    opportunityScore?: number;
  };
}

interface EmailRecord {
  id: string;
  subject: string;
  sentDate: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'opened' | 'replied';
  aiGenerated: boolean;
  classification?: string;
  sentiment?: string;
}

interface AIAgentConfig {
  enabled: boolean;
  autoReply: boolean;
  responseStyle: 'professional' | 'friendly' | 'formal' | 'casual';
  responseDelay: number; // minutes
  classificationRules: ClassificationRule[];
  customPrompts: CustomPrompt[];
}

interface ClassificationRule {
  type: string;
  keywords: string[];
  action: 'auto_reply' | 'flag_urgent' | 'forward' | 'archive';
  responseTemplate?: string;
}

interface CustomPrompt {
  trigger: string;
  template: string;
  variables: string[];
}

export default function PersonProfileClient({ entityId }: { entityId: string }) {
  const params = useParams();
  const router = useRouter();
  const actualEntityId = params.entityId as string || entityId;
  
  const { data: entityData, error, isLoading } = useEntity(actualEntityId);
  const entity = entityData?.entity || null;
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [aiAgentEnabled, setAiAgentEnabled] = useState(false);
  const [emailStats, setEmailStats] = useState({
    total: 0,
    sent: 0,
    received: 0,
    responseRate: 0
  });

  useEffect(() => {
    if (entity?.properties?.aiAgentConfig) {
      setAiAgentEnabled(entity.properties.aiAgentConfig.enabled);
    }
    calculateEmailStats();
  }, [entity]);

  const calculateEmailStats = () => {
    const emails = entity?.properties?.contactHistory || [];
    const sent = emails.filter((e: EmailRecord) => e.direction === 'outbound').length;
    const received = emails.filter((e: EmailRecord) => e.direction === 'inbound').length;
    const replied = emails.filter((e: EmailRecord) => e.status === 'replied').length;
    const responseRate = received > 0 ? (replied / received) * 100 : 0;

    setEmailStats({
      total: emails.length,
      sent,
      received,
      responseRate
    });
  };

  const handleSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) throw new Error('Failed to send email');
      
      // Refresh entity data to update contact history
      window.location.reload();
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error || !entity) return <div>Person not found</div>;

  // Create enhanced person data for demo purposes
  const createDemoPersonData = (entityId: string, name: string) => {
    const nameLower = name.toLowerCase();
    
    // Demo data for football personnel
    if (nameLower.includes('arteta')) {
      return {
        name: 'Mikel Arteta',
        role: 'Manager',
        email: 'mikel.arteta@arsenal.fc',
        phone: '+44 20 7619 5000',
        location: 'London, England',
        team: 'Arsenal FC',
        bio: 'Spanish professional football manager and former player. Currently the manager of Arsenal FC.',
        experience: 'Manager (2019-present), Assistant Manager (Manchester City, 2016-2019), Player (Arsenal, Everton, Real Madrid, etc.)',
        achievements: 'FA Cup winner (2020), Community Shield winner (2020, 2023), Premier League Manager of the Season (2022-23)',
        lastContact: '2024-01-15',
        relationshipScore: 85,
        opportunityScore: 92,
        communicationStyle: 'Professional and strategic',
        timezone: 'GMT',
        responseRate: 78
      };
    } else if (nameLower.includes('odegaard')) {
      return {
        name: 'Martin Ødegaard',
        role: 'Team Captain / Midfielder',
        email: 'martin.odegaard@arsenal.fc',
        phone: '+44 20 7619 5001',
        location: 'London, England',
        team: 'Arsenal FC',
        bio: 'Norwegian professional footballer who plays as a midfielder and captains Arsenal FC.',
        experience: 'Captain (Arsenal, 2022-present), Player (Real Madrid, Vitesse, Heerenveen, etc.)',
        achievements: 'Premier League Runner-up (2022-23), FA Cup Finalist (2023), Norway National Team Captain',
        lastContact: '2024-01-10',
        relationshipScore: 78,
        opportunityScore: 88,
        communicationStyle: 'Professional and approachable',
        timezone: 'GMT',
        responseRate: 85
      };
    } else if (nameLower.includes('saka')) {
      return {
        name: 'Bukayo Saka',
        role: 'Winger / Forward',
        email: 'bukayo.saka@arsenal.fc',
        phone: '+44 20 7619 5002',
        location: 'London, England',
        team: 'Arsenal FC',
        bio: 'English professional footballer who plays as a winger for Arsenal FC and the England national team.',
        experience: 'First Team (Arsenal, 2018-present), England National Team (2020-present)',
        achievements: 'England Player of the Year (2021-22, 2022-23), Premier League Young Player of the Season (2022-23)',
        lastContact: '2024-01-08',
        relationshipScore: 82,
        opportunityScore: 95,
        communicationStyle: 'Energetic and media-friendly',
        timezone: 'GMT',
        responseRate: 72
      };
    } else if (nameLower.includes('saliba')) {
      return {
        name: 'William Saliba',
        role: 'Center Back',
        email: 'william.saliba@arsenal.fc',
        phone: '+44 20 7619 5003',
        location: 'London, England',
        team: 'Arsenal FC',
        bio: 'French professional footballer who plays as a center back for Arsenal FC and the France national team.',
        experience: 'First Team (Arsenal, 2019-present), Saint-Étienne (2019-2020), France National Team (2022-present)',
        achievements: 'Premier League Player of the Month (September 2023), France World Cup Squad (2022)',
        lastContact: '2024-01-05',
        relationshipScore: 75,
        opportunityScore: 86,
        communicationStyle: 'Quiet and focused',
        timezone: 'GMT',
        responseRate: 68
      };
    } else if (nameLower.includes('venkatesham')) {
      return {
        name: 'Vinai Venkatesham',
        role: 'Chief Executive Officer',
        email: 'vinai.venkatesham@arsenal.fc',
        phone: '+44 20 7619 5004',
        location: 'London, England',
        team: 'Arsenal FC',
        bio: 'Chief Executive Officer of Arsenal Football Club, responsible for the overall management and business operations.',
        experience: 'CEO (Arsenal, 2020-present), Managing Director (Arsenal, 2017-2020), Various roles (Hulu, YouTube, Google)',
        achievements: 'Record commercial revenue growth, £200m Adidas partnership, Emirates stadium expansion',
        lastContact: '2024-01-12',
        relationshipScore: 90,
        opportunityScore: 96,
        communicationStyle: 'Business-oriented and strategic',
        timezone: 'GMT',
        responseRate: 92
      };
    }
    
    // Generic person data for other names
    return {
      name: name,
      role: 'Football Professional',
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@sports.football`,
      phone: '+44 20 7000 0000',
      location: 'London, England',
      team: 'Professional Football',
      bio: 'Professional football personnel with expertise in their respective field.',
      experience: 'Various roles in professional football',
      achievements: 'Professional football career with notable achievements',
      lastContact: '2024-01-01',
      relationshipScore: 70,
      opportunityScore: 75,
      communicationStyle: 'Professional',
      timezone: 'GMT',
      responseRate: 75
    };
  };

  const person = entity.labels.includes('Person') && entity.properties.name ? 
    createDemoPersonData(actualEntityId, entity.properties.name) : 
    entity.properties as PersonProfile;
  const isPerson = entity.labels.includes('Person');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 bg-[#1c1e2d]">
        {/* Profile Header */}
        <Card className="mb-8 border-2 shadow-lg">
          <CardHeader className="pb-6">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <EntityBadge entity={entity} size="xl" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-3xl font-bold flex items-center gap-3">
                    <User className="h-8 w-8 text-primary" />
                    {person.name}
                  </CardTitle>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/entity-browser')}
                      className="flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Browse Entities
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailComposer(true)}
                      className="flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Compose
                    </Button>
                    
                    <Button
                      variant={aiAgentEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAiAgentEnabled(!aiAgentEnabled)}
                      className="flex items-center gap-2"
                    >
                      <Brain className="h-4 w-4" />
                      AI Agent {aiAgentEnabled ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                </div>
                
                {/* Key Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                  {person.role && (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Role:</span>
                      <span>{person.role}</span>
                    </div>
                  )}
                  
                  {person.affiliation && (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Organization:</span>
                      <span>{person.affiliation}</span>
                    </div>
                  )}
                  
                  {person.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Location:</span>
                      <span>{person.location}</span>
                    </div>
                  )}
                  
                  {person.timezone && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Timezone:</span>
                      <span>{person.timezone}</span>
                    </div>
                  )}
                </div>
                
                {/* Score Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-lg font-bold text-blue-600">
                      {person.relationshipScore || 0}/100
                    </div>
                    <div className="text-xs text-muted-foreground">Relationship</div>
                  </div>
                  
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      {person.opportunityScore || 0}/100
                    </div>
                    <div className="text-xs text-muted-foreground">Opportunity</div>
                  </div>
                  
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-lg font-bold text-purple-600">
                      {emailStats.responseRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Response Rate</div>
                  </div>
                  
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-lg font-bold text-orange-600">
                      {emailStats.total}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Emails</div>
                  </div>
                </div>
                
                {/* Contact Information */}
                <div className="flex gap-4">
                  {person.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailComposer(true)}
                      className="flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      {person.email}
                    </Button>
                  )}
                  
                  {person.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      {person.phone}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="ai-agent">AI Agent</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bio & Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {person.bio && (
                    <div>
                      <h4 className="font-medium mb-2">Biography</h4>
                      <p className="text-sm text-muted-foreground">{person.bio}</p>
                    </div>
                  )}
                  
                  {person.expertise && person.expertise.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Areas of Expertise</h4>
                      <div className="flex flex-wrap gap-2">
                        {person.expertise.map((skill, index) => (
                          <Badge key={index} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {person.interests && person.interests.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Interests</h4>
                      <div className="flex flex-wrap gap-2">
                        {person.interests.map((interest, index) => (
                          <Badge key={index} variant="outline">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Communication Style */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Communication Style
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {person.communicationStyle && (
                    <div>
                      <h4 className="font-medium mb-2">Preferred Style</h4>
                      <Badge variant="outline">{person.communicationStyle}</Badge>
                    </div>
                  )}
                  
                  {person.preferredContactTime && (
                    <div>
                      <h4 className="font-medium mb-2">Best Contact Time</h4>
                      <p className="text-sm text-muted-foreground">{person.preferredContactTime}</p>
                    </div>
                  )}
                  
                  {person.priorityLevel && (
                    <div>
                      <h4 className="font-medium mb-2">Priority Level</h4>
                      <Badge 
                        variant={
                          person.priorityLevel === 'high' ? 'destructive' :
                          person.priorityLevel === 'medium' ? 'default' : 'secondary'
                        }
                      >
                        {person.priorityLevel}
                      </Badge>
                    </div>
                  )}
                  
                  {person.lastContact && (
                    <div>
                      <h4 className="font-medium mb-2">Last Contact</h4>
                      <p className="text-sm text-muted-foreground">{person.lastContact}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Communication Tab */}
          <TabsContent value="communication" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <EmailConversationThread 
                  emails={person.contactHistory || []}
                  onReply={(email) => {
                    setSelectedEmail(email);
                    setShowEmailComposer(true);
                  }}
                />
              </div>
              
              <div>
                <EmailAssistant
                  contact={{
                    id: entity.id,
                    name: person.name,
                    email: person.email || '',
                    role: person.role || '',
                    affiliation: person.affiliation || '',
                    tags: person.expertise || []
                  }}
                  onSendEmail={handleSendEmail}
                />
              </div>
            </div>
          </TabsContent>

          {/* AI Agent Tab */}
          <TabsContent value="ai-agent" className="space-y-6">
            <AIEmailAgent
              entityId={entity.id}
              config={person.aiAgentConfig}
              enabled={aiAgentEnabled}
              onConfigChange={(config) => {
                // Update AI agent configuration
              }}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{emailStats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {emailStats.sent} sent, {emailStats.received} received
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{emailStats.responseRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Above average engagement
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AI Generated</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {person.contactHistory?.filter(e => e.aiGenerated).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI-assisted emails
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Relationship Score</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{person.relationshipScore || 0}/100</div>
                  <p className="text-xs text-muted-foreground">
                    Strong relationship
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Priority Level</label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Communication Style</label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="formal">Formal</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Preferred Contact Time</label>
                  <Input type="text" placeholder="e.g., Weekdays 9-5" />
                </div>
                
                <Button className="w-full">Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}