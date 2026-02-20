import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// =============================================================================
// Types
// =============================================================================

interface OutreachApproach {
  id: string;
  name: string;
  description: string;
  reasoning: string;
  suitable_for: string[];
  risk_level: 'low' | 'medium' | 'high';
  suitability_score: number;
  talking_points: string[];
  risk_factors: string[];
}

interface OutreachIntelligence {
  entity_id: string;
  entity_name: string;
  approach_type: 'warm' | 'lukewarm' | 'cold';
  mutual_connections: string[];
  conversation_starters: Array<{
    topic: string;
    relevance: string;
    risk_level: string;
  }>;
  current_providers: Array<{
    provider: string;
    service: string;
    confidence: number;
    source: string;
  }>;
  recommended_approach: {
    primary_channel: string;
    messaging_angle: string;
    timing: string;
    next_actions: string[];
  };
  confidence: number;
  confidence_explanation: string;
  recommended_approaches: OutreachApproach[];
  anti_patterns: string[];
  best_contact_channels: string[];
  optimal_timing: string;
  personalization_tokens: string[];
  confidence_threshold: number;
  metadata: {
    generated_at: string;
    data_sources: string[];
    freshness: string;
  };
}

interface MessageGenerationRequest {
  entity_id: string;
  approach: string;
  contact?: {
    name?: string;
    title?: string;
    department?: string;
  };
  edits?: {
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    custom_instructions?: string;
  };
}

interface GeneratedMessage {
  subject: string;
  body: string;
  reasoning: string;
  anti_patterns: string[];
  estimated_response_rate: number;
  follow_up_suggestions: string[];
}

// =============================================================================
// POST endpoint: Generate outreach intelligence using real backend
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity_id, entity_name, signals, hypotheses, linkedin_data, dossier_data } = body;

    if (!entity_id) {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 }
      );
    }

    // Call real backend API
    const backendUrl = `${FASTAPI_URL}/api/dossier-outreach-intelligence`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id,
        entity_name: entity_name || entity_id,
        signals: signals || [],
        hypotheses: hypotheses || [],
        priority_score: dossier_data?.priority_score || 50
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', errorText);

      // Fallback to mock data if backend unavailable
      console.warn('Backend unavailable, using fallback mock data');
      return NextResponse.json(generateMockIntelligence(entity_id, entity_name));
    }

    const backendData = await response.json();

    // Transform backend data to expected format
    const intelligence: OutreachIntelligence = {
      ...backendData,
      recommended_approaches: generateApproachesFromBackend(backendData),
      anti_patterns: generateAntiPatterns(backendData),
      best_contact_channels: [backendData.recommended_approach?.primary_channel || 'email'],
      optimal_timing: backendData.recommended_approach?.timing || 'Mid-morning',
      personalization_tokens: extractPersonalizationTokens(backendData),
      confidence_threshold: backendData.confidence || 50
    };

    return NextResponse.json(intelligence);

  } catch (error) {
    console.error('Error generating outreach intelligence:', error);

    // Return mock data as fallback
    const { entity_id, entity_name } = await request.json();
    return NextResponse.json(generateMockIntelligence(entity_id, entity_name));
  }
}

// =============================================================================
// GET endpoint: Fetch outreach intelligence (legacy)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity_id = searchParams.get('entity_id');

    if (!entity_id) {
      return NextResponse.json(
        { error: 'entity_id query parameter is required' },
        { status: 400 }
      );
    }

    // Call backend API
    const backendUrl = `${FASTAPI_URL}/api/dossier-outreach-intelligence`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id,
        entity_name: entity_id,
        signals: [],
        hypotheses: []
      })
    });

    if (!response.ok) {
      // Fallback to mock data
      return NextResponse.json(generateMockIntelligence(entity_id, entity_id));
    }

    const backendData = await response.json();

    // Transform backend data to expected format
    const intelligence: OutreachIntelligence = {
      ...backendData,
      recommended_approaches: generateApproachesFromBackend(backendData),
      anti_patterns: generateAntiPatterns(backendData),
      best_contact_channels: [backendData.recommended_approach?.primary_channel || 'email'],
      optimal_timing: backendData.recommended_approach?.timing || 'Mid-morning',
      personalization_tokens: extractPersonalizationTokens(backendData),
      confidence_threshold: backendData.confidence || 50
    };

    return NextResponse.json(intelligence);

  } catch (error) {
    console.error('Error in GET request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateMockIntelligence(entity_id: string, entity_name?: string): OutreachIntelligence {
  return {
    entity_id,
    entity_name: entity_name || entity_id,
    approach_type: 'cold',
    mutual_connections: [],
    conversation_starters: [
      {
        topic: 'Digital transformation initiatives',
        relevance: 'Recent activity in digital projects detected',
        risk_level: 'low'
      }
    ],
    current_providers: [],
    recommended_approach: {
      primary_channel: 'email',
      messaging_angle: 'Digital partnership opportunity',
      timing: 'Tuesday-Thursday, mid-morning',
      next_actions: ['Send initial outreach', 'Follow up in 3 days']
    },
    confidence: 30,
    confidence_explanation: 'Limited contextual information available. Cold approach recommended.',
    recommended_approaches: [
      {
        id: 'digital-maturity',
        name: 'Digital Maturity Approach',
        description: 'Highlight their current digital capabilities and offer enhancement',
        reasoning: 'Entity shows strong digital foundation with CRM/analytics presence',
        suitable_for: ['ORG', 'tier_1_club'],
        risk_level: 'low',
        suitability_score: 0.7,
        talking_points: [
          'Acknowledge their current digital initiatives',
          'Offer specific enhancement opportunities',
          'Share relevant case studies'
        ],
        risk_factors: []
      }
    ],
    anti_patterns: [
      'Avoid generic sales pitches without specific references',
      'Do not mention competitors explicitly',
      'Avoid technical jargon unless contact is technical'
    ],
    best_contact_channels: ['email'],
    optimal_timing: 'Mid-morning',
    personalization_tokens: ['{{recent_initiative}}', '{{specific_technology}}'],
    confidence_threshold: 50,
    metadata: {
      generated_at: new Date().toISOString(),
      data_sources: ['fallback'],
      freshness: 'mock'
    }
  };
}

function generateApproachesFromBackend(backendData: any): OutreachApproach[] {
  const approaches: OutreachApproach[] = [
    {
      id: 'digital-maturity',
      name: 'Digital Maturity Approach',
      description: 'Highlight their current digital capabilities and offer enhancement',
      reasoning: backendData.confidence_explanation || 'Based on available intelligence',
      suitable_for: ['ORG'],
      risk_level: backendData.confidence > 70 ? 'low' : 'medium',
      suitability_score: backendData.confidence / 100,
      talking_points: [
        'Acknowledge their current digital initiatives',
        'Offer specific enhancement opportunities',
        'Share relevant case studies'
      ],
      risk_factors: backendData.anti_patterns || []
    }
  ];

  // Add mutual connection approach if available
  if (backendData.mutual_connections && backendData.mutual_connections.length > 0) {
    approaches.unshift({
      id: 'warm-intro',
      name: 'Warm Introduction',
      description: 'Leverage mutual connections for introduction',
      reasoning: `${backendData.mutual_connections.length} mutual connections detected`,
      suitable_for: ['ORG'],
      risk_level: 'low',
      suitability_score: 0.9,
      talking_points: [
        `Request intro via ${backendData.mutual_connections[0]}`,
        'Mention shared connection in opening',
        'Focus on value proposition'
      ],
      risk_factors: []
    });
  }

  return approaches;
}

function generateAntiPatterns(backendData: any): string[] {
  const antiPatterns = [
    'Avoid generic sales pitches without specific references',
    'Do not mention competitors explicitly',
    'Avoid technical jargon unless contact is technical',
    'Do not overwhelm with data in first contact'
  ];

  if (backendData.approach_type === 'cold') {
    antiPatterns.push('Avoid being too aggressive in cold outreach');
  }

  return antiPatterns;
}

function extractPersonalizationTokens(backendData: any): string[] {
  const tokens = ['{{entity_name}}', '{{recent_initiative}}'];

  if (backendData.conversation_starters && backendData.conversation_starters.length > 0) {
    tokens.push('{{conversation_topic}}');
  }

  if (backendData.current_providers && backendData.current_providers.length > 0) {
    tokens.push('{{current_provider}}');
  }

  return tokens;
}
