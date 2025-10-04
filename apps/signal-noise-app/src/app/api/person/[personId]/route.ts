import { NextRequest, NextResponse } from 'next/server';

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
  responseDelay: number;
  classificationRules: any[];
  customPrompts: any[];
  workingHours: {
    start: string;
    end: string;
    timezone: string;
    weekends: boolean;
  };
  escalationRules: any[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { personId: string } }
) {
  try {
    const personId = params.personId;

    // Mock person data - in production, fetch from Neo4j database
    const mockPerson: PersonProfile = {
      id: personId,
      neo4j_id: personId,
      labels: ['Person'],
      properties: {
        name: 'Sarah Johnson',
        role: 'Marketing Director',
        affiliation: 'Liverpool FC',
        email: 'sarah.johnson@liverpoolfc.com',
        phone: '+44 151 123 4567',
        location: 'Liverpool, UK',
        bio: 'Experienced marketing director with over 10 years in sports marketing, specializing in digital transformation and fan engagement strategies.',
        expertise: ['Digital Marketing', 'Brand Strategy', 'Fan Engagement', 'Sports Analytics'],
        interests: ['Football', 'Technology', 'Data Analytics', 'Fan Experience'],
        communicationStyle: 'professional',
        preferredContactTime: 'Weekdays 9-5 GMT',
        timezone: 'GMT',
        responseRate: 85,
        lastContact: '2024-01-15T14:30:00Z',
        priorityLevel: 'high',
        relationshipScore: 78,
        opportunityScore: 85,
        contactHistory: [
          {
            id: 'email_001',
            subject: 'Partnership Opportunity - Digital Fan Engagement',
            sentDate: '2024-01-15T14:30:00Z',
            direction: 'outbound',
            status: 'opened',
            aiGenerated: true,
            classification: 'partnership',
            sentiment: 'positive'
          },
          {
            id: 'email_002',
            subject: 'Re: Partnership Opportunity',
            sentDate: '2024-01-15T16:45:00Z',
            direction: 'inbound',
            status: 'replied',
            aiGenerated: false,
            classification: 'inquiry',
            sentiment: 'neutral'
          },
          {
            id: 'email_003',
            subject: 'Following up on our discussion',
            sentDate: '2024-01-16T10:30:00Z',
            direction: 'outbound',
            status: 'delivered',
            aiGenerated: true,
            classification: 'follow_up',
            sentiment: 'positive'
          }
        ],
        aiAgentConfig: {
          enabled: true,
          autoReply: true,
          responseStyle: 'professional',
          responseDelay: 15,
          classificationRules: [
            {
              id: 'rule_001',
              type: 'urgent',
              keywords: ['urgent', 'asap', 'emergency'],
              action: 'flag_urgent',
              priority: 10,
              enabled: true,
              responseTemplate: 'I have received your urgent message and am giving it immediate attention.'
            },
            {
              id: 'rule_002',
              type: 'partnership',
              keywords: ['partnership', 'collaboration', 'opportunity'],
              action: 'auto_reply',
              priority: 8,
              enabled: true,
              responseTemplate: 'Thank you for your partnership inquiry. I would be delighted to discuss this further.'
            },
            {
              id: 'rule_003',
              type: 'support',
              keywords: ['help', 'issue', 'problem'],
              action: 'flag_for_review',
              priority: 7,
              enabled: true
            }
          ],
          customPrompts: [
            {
              id: 'prompt_001',
              name: 'Partnership Response',
              trigger: 'partnership_inquiry',
              template: 'Dear {name},\\n\\nThank you for your interest in exploring partnership opportunities with {affiliation}. I would be delighted to discuss how we can work together to achieve mutual success.\\n\\nBest regards,\\n{sender}',
              variables: ['name', 'affiliation', 'sender'],
              enabled: true
            }
          ],
          workingHours: {
            start: '09:00',
            end: '17:00',
            timezone: 'GMT',
            weekends: false
          },
          escalationRules: [
            {
              id: 'escalation_001',
              condition: 'urgent_keyword',
              timeframe: 1,
              action: 'notify_manager',
              enabled: true
            }
          ]
        }
      }
    };

    return NextResponse.json({
      success: true,
      person: mockPerson
    });

  } catch (error) {
    console.error('Error fetching person profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch person profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { personId: string } }
) {
  try {
    const personId = params.personId;
    const updates = await request.json();

    // In production, update person in Neo4j database
    // await updatePersonProfile(personId, updates);

    return NextResponse.json({
      success: true,
      message: 'Person profile updated successfully',
      personId,
      updates
    });

  } catch (error) {
    console.error('Error updating person profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update person profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}