import { NextRequest, NextResponse } from 'next/server';
import { buildGraphEntityLookupFilter } from '@/lib/graph-id';
import { getSupabaseAdmin } from '@/lib/supabase-client';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Sunderland FC Dossier Data (import from our generated file)
import sunderlandDossierData from '../../../../../dossiers/sunderland-fc-intelligence-data.json';
import fs from 'fs';
import path from 'path';

function readSunderlandMarkdown() {
  const markdownPath = path.join(process.cwd(), 'dossiers/sunderland-fc-intelligence-dossier.md');
  return fs.readFileSync(markdownPath, 'utf8');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'summary';
    const sunderlandDossierMarkdown = readSunderlandMarkdown();

    if (format === 'complete') {
      // Return complete dossier data
      return NextResponse.json({
        success: true,
        data: sunderlandDossierData
      });
    } else if (format === 'markdown') {
      // Return markdown dossier
      return new NextResponse(sunderlandDossierMarkdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': 'inline; filename="sunderland-fc-intelligence-dossier.md"'
        }
      });
    } else {
      // Return summary for quick display
      const summary = {
        graph_id: sunderlandDossierData.neo4j_id,
        name: sunderlandDossierData.entity.name,
        type: sunderlandDossierData.entity.type,
        opportunity_score: sunderlandDossierData.strategic_analysis.opportunity_scoring.overall_score,
        digital_maturity: sunderlandDossierData.digital_transformation.digital_maturity,
        confidence_score: sunderlandDossierData.entity.confidence_score,
        last_updated: sunderlandDossierData.entity.last_updated,
        tier_1_connections: sunderlandDossierData.linkedin_connection_analysis.yellow_panther_uk_team.total_connections_found,
        tier_2_connections: sunderlandDossierData.linkedin_connection_analysis.tier_2_analysis.influential_bridge_contacts.length,
        success_probability: sunderlandDossierData.linkedin_connection_analysis.recommendations.success_probability,
        key_opportunities: sunderlandDossierData.strategic_analysis.opportunity_scoring.immediate_launch.map(opp => ({
          name: opp.opportunity,
          score: opp.score,
          timeline: opp.timeline,
          revenue_potential: opp.revenue_potential
        }))
      };

      return NextResponse.json({
        success: true,
        data: summary
      });
    }

  } catch (error) {
    console.error('Error fetching Sunderland dossier:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch dossier data' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    const supabase = getSupabaseAdmin();

    if (action === 'store') {
      const neo4j_id = 148;
      const sunderlandDossierMarkdown = readSunderlandMarkdown();

      const supabaseData = {
        graph_id: sunderlandDossierData.neo4j_id,
        name: sunderlandDossierData.entity.name,
        type: sunderlandDossierData.entity.type,
        sport: sunderlandDossierData.entity.sport,
        country: sunderlandDossierData.entity.country,
        level: sunderlandDossierData.entity.level,
        founded: sunderlandDossierData.entity.founded,
        stadium: sunderlandDossierData.entity.stadium,
        website: sunderlandDossierData.entity.website,
        employee_range: sunderlandDossierData.core_info.employee_range,
        valuation_gbp: sunderlandDossierData.entity.valuation_gbp,
        opportunity_score: sunderlandDossierData.strategic_analysis.opportunity_scoring.overall_score,
        digital_maturity: sunderlandDossierData.digital_transformation.digital_maturity,
        confidence_score: sunderlandDossierData.entity.confidence_score,
        success_probability: parseFloat(sunderlandDossierData.linkedin_connection_analysis.recommendations.success_probability),
        dossier_data: sunderlandDossierData,
        dossier_markdown: sunderlandDossierMarkdown,
        linkedin_analysis: sunderlandDossierData.linkedin_connection_analysis,
        tier_1_connections: sunderlandDossierData.linkedin_connection_analysis.yellow_panther_uk_team.total_connections_found,
        tier_2_connections: sunderlandDossierData.linkedin_connection_analysis.tier_2_analysis.influential_bridge_contacts.length,
        last_enriched: new Date().toISOString(),
        schema_version: '2.0',
        status: 'active'
      };

      const { data, error } = await supabase
        .from('entity_dossiers')
        .upsert(supabaseData)
        .select()
        .single();

      if (error) {
        console.error('Supabase storage error:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to store in Supabase',
            details: error.message
          },
          { status: 500 }
        );
      }

      const connectionPaths = [
        ...sunderlandDossierData.linkedin_connection_analysis.tier_1_analysis.introduction_paths.map(path => ({
          entity_dossier_id: data.id,
          yellow_panther_contact: path.yellow_panther_contact,
          target_decision_maker: path.target_decision_maker,
          tier: 'tier_1',
          connection_strength: path.connection_strength,
          connection_type: path.connection_type,
          confidence_score: path.confidence_score,
          introduction_strategy: path.introduction_strategy,
          estimated_timeline: '3-4 weeks',
          success_probability: 'HIGH',
          is_primary_path: path.is_primary_path
        })),
        ...sunderlandDossierData.linkedin_connection_analysis.tier_2_analysis.tier_2_introduction_paths.map(path => ({
          entity_dossier_id: data.id,
          yellow_panther_contact: path.yellow_panther_contact,
          target_decision_maker: path.target_decision_maker,
          bridge_contact: path.bridge_contact,
          tier: 'tier_2',
          connection_strength: path.connection_strength,
          connection_type: path.path_type,
          confidence_score: path.confidence_score,
          introduction_strategy: path.introduction_strategy,
          estimated_timeline: path.estimated_timeline,
          success_probability: path.success_probability,
          is_primary_path: false
        }))
      ];

      // Store connection paths
      const { error: pathsError } = await supabase
        .from('connection_paths')
        .upsert(connectionPaths);

      if (pathsError) {
        console.error('Connection paths storage error:', pathsError);
        // Don't fail the whole operation if connection paths fail
      }

      const opportunityAssessments = [
        ...sunderlandDossierData.strategic_analysis.opportunity_scoring.immediate_launch.map(opp => ({
          entity_dossier_id: data.id,
          opportunity_name: opp.opportunity,
          category: 'immediate_launch',
          score: opp.score,
          timeline: opp.timeline,
          revenue_potential: opp.revenue_potential,
          implementation_complexity: 'Medium',
          success_probability: 85,
          yellow_panther_fit: 'High - AI and fan engagement capabilities align perfectly',
          required_capabilities: ['AI/ML', 'Mobile Development', 'Data Analytics'],
          competitive_advantages: ['Two-tiered LinkedIn analysis', 'Rapid deployment capability']
        })),
        ...sunderlandDossierData.strategic_analysis.opportunity_scoring.medium_term_partnerships.map(opp => ({
          entity_dossier_id: data.id,
          opportunity_name: opp.opportunity,
          category: 'medium_term_partnerships',
          score: opp.score,
          timeline: opp.timeline,
          revenue_potential: opp.revenue_potential,
          implementation_complexity: 'High',
          success_probability: 80,
          yellow_panther_fit: 'Strong - data analytics and international expansion expertise',
          required_capabilities: ['Big Data', 'International Strategy', 'Multi-language Support'],
          competitive_advantages: ['Sports industry expertise', 'Proven scalability']
        }))
      ];

      // Store opportunity assessments
      const { error: opportunitiesError } = await supabase
        .from('opportunity_assessments')
        .upsert(opportunityAssessments);

      if (opportunitiesError) {
        console.error('Opportunity assessments storage error:', opportunitiesError);
        // Don't fail the whole operation if opportunities fail
      }

      return NextResponse.json({
        success: true,
        message: 'Sunderland AFC dossier stored successfully in Supabase-backed stores',
        data: {
          neo4j_id,
          supabase_id: data.id,
          connection_paths_stored: connectionPaths.length,
          opportunities_stored: opportunityAssessments.length,
          last_updated: new Date().toISOString()
        }
      });

    } else if (action === 'test-retrieval') {
      const neo4j_id = 148;

      const { data: supabaseData, error: supabaseError } = await supabase
        .from('entity_dossiers')
        .select('id, name, opportunity_score, digital_maturity, confidence_score, last_updated')
        .or(buildGraphEntityLookupFilter(String(neo4j_id)))
        .single();

      if (supabaseError) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Supabase retrieval failed',
            details: supabaseError.message
          },
          { status: 500 }
        );
      }

      // Retrieve connection paths
      const { data: connectionPaths, error: pathsError } = await supabase
        .from('connection_paths')
        .select('*')
        .eq('entity_dossier_id', supabaseData.id);

      // Retrieve opportunity assessments
      const { data: opportunities, error: opportunitiesError } = await supabase
        .from('opportunity_assessments')
        .select('*')
        .eq('entity_dossier_id', supabaseData.id);

      return NextResponse.json({
        success: true,
        message: 'Supabase retrieval test successful',
        data: {
          supabase_data: supabaseData,
          connection_paths: connectionPaths || [],
          opportunities: opportunities || [],
          consistency_check: {
            opportunity_score_match: sunderlandDossierData.strategic_analysis.opportunity_scoring.overall_score === supabaseData.opportunity_score,
            digital_maturity_match: sunderlandDossierData.digital_transformation.digital_maturity === supabaseData.digital_maturity,
            confidence_score_match: Math.abs(sunderlandDossierData.entity.confidence_score - supabaseData.confidence_score) < 0.01
          }
        }
      });

    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid action. Supported actions: store, test-retrieval'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in Sunderland dossier API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
