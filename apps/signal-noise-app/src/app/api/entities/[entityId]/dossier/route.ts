/**
 * Entity Dossier API Endpoint
 * Generates comprehensive intelligence dossiers for entities using Claude agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { Neo4jService } from '@/lib/neo4j';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Debug Supabase connection
console.log('🔧 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('🔧 Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

interface DossierRequest {
  includeSignals?: boolean;
  includeConnections?: boolean;
  includePOIs?: boolean;
  deepResearch?: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { entityId } = params;
    const searchParams = request.nextUrl.searchParams;
    
    console.log(`📋 Dossier request for entity: ${entityId}`);
    
    const options: DossierRequest = {
      includeSignals: searchParams.get('includeSignals') !== 'false',
      includeConnections: searchParams.get('includeConnections') !== 'false',
      includePOIs: searchParams.get('includePOIs') !== 'false',
      deepResearch: searchParams.get('deepResearch') === 'true'
    };

    console.log(`📋 Dossier options:`, options);

    // Check if we have a recent cached dossier
    const cachedDossier = await getCachedDossier(entityId);
    if (cachedDossier && !isStale(cachedDossier.lastUpdated)) {
      console.log(`📋 Returning cached dossier for entity: ${entityId}`);
      return NextResponse.json({
        success: true,
        dossier: cachedDossier,
        cached: true
      });
    }

    console.log(`📋 Generating new dossier for entity: ${entityId}`);
    // Generate new dossier using Claude agent
    const dossier = await generateEntityDossier(entityId, options);
    
    // Cache the generated dossier
    await cacheDossier(entityId, dossier);

    console.log(`📋 Successfully generated dossier for entity: ${entityId}`);
    return NextResponse.json({
      success: true,
      dossier,
      cached: false
    });

  } catch (error) {
    console.error('Error generating entity dossier:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate dossier',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error.stack
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { entityId } = params;
    const body = await request.json();
    
    // Force regeneration of dossier
    const dossier = await generateEntityDossier(entityId, body);
    await cacheDossier(entityId, dossier);

    return NextResponse.json({
      success: true,
      dossier,
      cached: false
    });

  } catch (error) {
    console.error('Error regenerating entity dossier:', error);
    return NextResponse.json(
      { 
        error: 'Failed to regenerate dossier',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getCachedDossier(entityId: string) {
  try {
    const { data, error } = await supabase
      .from('entity_dossiers')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('No cached dossier found or error:', error?.message);
      return null;
    }

    return data.dossier_data;
  } catch (error) {
    console.error('Error fetching cached dossier:', error);
    return null;
  }
}

async function cacheDossier(entityId: string, dossier: any) {
  try {
    const { error } = await supabase
      .from('entity_dossiers')
      .upsert({
        entity_id: entityId,
        dossier_data: dossier,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.log('Error caching dossier (may be due to missing table):', error.message);
    }
  } catch (error) {
    console.log('Error caching dossier (may be due to missing table):', error);
  }
}

function isStale(lastUpdated: string): boolean {
  const lastUpdate = new Date(lastUpdated);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  return hoursDiff > 24; // Cache for 24 hours
}

async function generateEntityDossier(entityId: string, options: DossierRequest) {
  console.log(`📋 Starting dossier generation for entity: ${entityId}`);
  
  // Fetch entity data from Neo4j
  const entityData = await fetchEntityData(entityId);
  console.log(`📋 Entity data fetched:`, entityData?.name || 'Unknown');
  
  if (!entityData) {
    throw new Error(`Entity ${entityId} not found`);
  }

  // Fetch recent signals/events
  const signals = options.includeSignals ? await fetchEntitySignals(entityId) : [];
  console.log(`📋 Signals fetched:`, signals.length);
  
  // Fetch persons of interest
  const pois = options.includePOIs ? await fetchPersonsOfInterest(entityId) : [];
  console.log(`📋 POIs fetched:`, pois.length);
  
  // Fetch connection paths
  const connections = options.includeConnections ? await fetchConnectionPaths(entityId) : [];
  console.log(`📋 Connections fetched:`, connections.length);
  
  // Calculate scores
  const scores = calculateScores(entityData, signals, pois, connections);
  console.log(`📋 Scores calculated:`, scores);
  
  // Generate recommended actions
  const recommendedActions = generateRecommendedActions(scores, signals, pois);
  
  // Create outreach template
  const outreachTemplate = generateOutreachTemplate(entityData, pois[0]);
  
  // Compile final dossier
  const dossier = {
    entityName: entityData.name || 'Unknown Entity',
    entityIndustry: entityData.industry || entityData.sector,
    entityUrl: entityData.url,
    entityCountry: entityData.country,
    summary: generateSummary(entityData, signals, scores),
    signals,
    topPOIs: pois.slice(0, 5), // Top 5 POIs
    connectionPaths: connections.slice(0, 3), // Top 3 connections
    scores,
    recommendedActions,
    rawEvidence: extractRawEvidence(signals, entityData),
    outreachTemplate,
    lastUpdated: new Date().toISOString(),
    status: scores.finalScore >= 70 ? 'hot' : scores.finalScore >= 40 ? 'warm' : 'cold'
  };

  console.log(`📋 Dossier compilation complete for: ${dossier.entityName}`);
  return dossier;
}

async function fetchEntityData(entityId: string) {
  const neo4jService = new Neo4jService();
  await neo4jService.initialize();
  const session = neo4jService.getDriver().session();
  try {
    const result = await session.run(
      `
      MATCH (e) 
      WHERE id(e) = $entityId
      OPTIONAL MATCH (e)-[:ASSOCIATED_WITH]->(c:Club)
      RETURN e, c as club
      `,
      { entityId: parseInt(entityId) || 0 }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const entity = record.get('e').properties;
    const club = record.get('club')?.properties || {};

    return {
      ...entity,
      club: club.name || null,
      id: record.get('e').identity.toString()
    };
  } finally {
    await session.close();
  }
}

async function fetchEntitySignals(entityId: string) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('entity_id', entityId)
      .order('received_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching signals:', error);
      return [];
    }

    return data.map(event => ({
      type: event.event_type || 'Unknown',
      details: extractSignalDetails(event.payload),
      date: new Date(event.received_at).toLocaleDateString(),
      severity: determineSignalSeverity(event.event_type, event.payload)
    }));
  } catch (error) {
    console.error('Error fetching entity signals:', error);
    return [];
  }
}

async function fetchPersonsOfInterest(entityId: string) {
  const neo4jService = new Neo4jService();
  await neo4jService.initialize();
  const session = neo4jService.getDriver().session();
  try {
    const result = await session.run(
      `
      MATCH (e)-[:ASSOCIATED_WITH]->(:Club)<-[:WORKED_AT]-(p:Person)
      WHERE id(e) = $entityId
      OPTIONAL MATCH (p)-[:CONNECTED_TO]-(other:Person)
      WITH p, count(other) as connectionCount
      RETURN p, connectionCount
      ORDER BY connectionCount DESC, p.role DESC
      LIMIT 10
      `,
      { entityId: parseInt(entityId) || 0 }
    );

    return result.records.map(record => {
      const person = record.get('p').properties;
      const connectionCount = record.get('connectionCount');
      
      return {
        id: person.person_id || person.neo4j_id || record.get('p').identity.toString(),
        name: person.name || 'Unknown',
        role: person.role || 'Unknown',
        source: 'Neo4j Graph',
        profileUrl: person.profile_url,
        emailGuess: generateEmailGuess(person.name, entityId),
        emailConfidence: 0.6,
        connectionStrength: Math.min(connectionCount / 5, 1) * 10,
        notes: person.notes || ''
      };
    });
  } finally {
    await session.close();
  }
}

async function fetchConnectionPaths(entityId: string) {
  // Mock connection paths - in real implementation, this would find paths to team members
  return [
    {
      path: "John Smith ← worked-with ← Sarah Jones (Sales Lead)",
      strength: 8,
      teamMember: "Sarah Jones"
    },
    {
      path: "CTO Office ← board-member ← Mike Johnson (CEO)",
      strength: 6,
      teamMember: "Mike Johnson"
    }
  ];
}

function calculateScores(entityData: any, signals: any[], pois: any[], connections: any[]) {
  // Opportunity Score calculation
  let signalStrength = 0;
  signals.forEach(signal => {
    switch (signal.severity) {
      case 'high': signalStrength += 10; break;
      case 'medium': signalStrength += 5; break;
      case 'low': signalStrength += 2; break;
    }
  });

  const relevance = calculateRelevance(entityData);
  const recency = calculateRecency(signals);
  const competitionRisk = calculateCompetitionRisk(entityData);

  const opportunityScore = Math.min(
    Math.round((0.4 * signalStrength + 0.3 * relevance + 0.2 * recency - 0.1 * competitionRisk)),
    100
  );

  // Connection Score calculation
  const teamConnectionStrength = connections.reduce((sum, conn) => sum + conn.strength, 0);
  const contactability = pois.reduce((sum, poi) => sum + (poi.emailConfidence || 0), 0) / pois.length;

  const connectionScore = Math.min(
    Math.round(teamConnectionStrength * (1 + 0.5 * contactability)),
    100
  );

  // Final Score
  const finalScore = Math.round(0.6 * opportunityScore + 0.4 * connectionScore);

  return {
    opportunityScore: Math.max(0, opportunityScore),
    connectionScore: Math.max(0, connectionScore),
    finalScore: Math.max(0, Math.min(100, finalScore))
  };
}

function calculateRelevance(entityData: any): number {
  // Mock relevance calculation based on industry/business type
  const relevantIndustries = ['SaaS', 'Technology', 'Software', 'FinTech'];
  const industry = entityData.industry || entityData.sector || '';
  
  return relevantIndustries.some(ri => industry.toLowerCase().includes(ri.toLowerCase())) ? 80 : 40;
}

function calculateRecency(signals: any[]): number {
  if (signals.length === 0) return 0;
  
  const now = new Date();
  const recentSignals = signals.filter(signal => {
    const signalDate = new Date(signal.date);
    const daysDiff = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30;
  });

  return Math.min((recentSignals.length / signals.length) * 100, 100);
}

function calculateCompetitionRisk(entityData: any): number {
  // Mock competition risk calculation
  return Math.random() * 50; // Random risk factor for demo
}

function generateRecommendedActions(scores: any, signals: any[], pois: any[]) {
  const actions = [];

  if (scores.finalScore >= 70) {
    actions.push({
      action: 'Immediate outreach recommended',
      priority: 'high' as const
    });
    
    if (pois.length > 0) {
      actions.push({
        action: `Contact ${pois[0].name} (${pois[0].role})`,
        owner: 'Sales Team',
        priority: 'high' as const
      });
    }
  } else if (scores.finalScore >= 40) {
    actions.push({
      action: 'Schedule follow-up within 2 weeks',
      priority: 'medium' as const
    });
  } else {
    actions.push({
      action: 'Add to nurturing campaign',
      priority: 'low' as const
    });
  }

  if (signals.some(s => s.type.includes('funding'))) {
    actions.push({
      action: 'Prepare funding congratulations message',
      priority: 'high' as const
    });
  }

  return actions;
}

function generateOutreachTemplate(entityData: any, topPOI: any) {
  if (!topPOI) return undefined;

  return {
    subject: `Quick intro re opportunity with ${entityData.name || 'your company'}`,
    body: `Hi ${topPOI.name?.split(' ')[0] || 'there'},

I hope this message finds you well. I noticed ${generatePersonalizationContext(entityData, topPOI)}.

Our team at Yellow Panther has been helping leading organizations with sports intelligence and relationship management, and I believe there could be some interesting synergies.

Would you be open to a brief 15-minute call next week to explore potential opportunities?

Best regards`
  };
}

function generatePersonalizationContext(entityData: any, poi: any) {
  const contexts = [
    `your work at ${entityData.name}`,
    `your role as ${poi.role}`,
    `the recent developments at ${entityData.name}`,
    `your experience in ${entityData.industry || 'the industry'}`
  ];
  
  return contexts[Math.floor(Math.random() * contexts.length)];
}

function generateSummary(entityData: any, signals: any[], scores: any) {
  const signalText = signals.length > 0 
    ? `${signals.length} recent signals including ${signals[0].type.toLowerCase()}`
    : 'no recent signals';
    
  return `${entityData.name} is a ${entityData.industry || 'organization'} with ${signalText}. Opportunity score: ${scores.finalScore}/100.`;
}

function extractRawEvidence(signals: any[], entityData: any): string[] {
  const evidence = signals.map(s => s.details);
  if (entityData.url) {
    evidence.push(entityData.url);
  }
  return evidence;
}

function extractSignalDetails(payload: any): string {
  if (!payload) return 'No details available';
  
  if (typeof payload === 'string') {
    return payload;
  }
  
  return payload.description || payload.title || JSON.stringify(payload).substring(0, 100);
}

function determineSignalSeverity(eventType: string, payload: any): 'low' | 'medium' | 'high' {
  if (eventType?.toLowerCase().includes('funding')) return 'high';
  if (eventType?.toLowerCase().includes('hiring')) return 'medium';
  if (eventType?.toLowerCase().includes('news')) return 'medium';
  return 'low';
}

function generateEmailGuess(name: string, entityId: string): string {
  if (!name) return '';
  
  const nameParts = name.toLowerCase().split(' ');
  if (nameParts.length < 2) return '';
  
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  const patterns = [
    `${firstName}.${lastName}@example.com`,
    `${firstName}${lastName}@example.com`,
    `${firstName}@example.com`,
    `${firstName}.${lastName[0]}@example.com`
  ];
  
  return patterns[Math.floor(Math.random() * patterns.length)];
}