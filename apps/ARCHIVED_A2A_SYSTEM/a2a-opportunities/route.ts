/**
 * API route for A2A system to store discovered RFP opportunities
 * Mirrors the storage structure used by the tenders page
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const opportunity = await request.json();
    
    // Validate required fields
    const requiredFields = ['title', 'organization', 'entity'];
    const missingFields = requiredFields.filter(field => !opportunity[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Transform A2A opportunity to match tenders page structure
    const rfpRecord = {
      id: opportunity.id || `a2a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: opportunity.title,
      organization: opportunity.entity?.name || opportunity.organization,
      description: opportunity.description || opportunity.summary || 'RFP opportunity detected by A2A system',
      location: opportunity.entity?.properties?.country || 'Global',
      value: opportunity.estimatedValue || opportunity.estimated_value || '£300K-£700K',
      deadline: opportunity.deadline || null,
      status: opportunity.verificationStatus === 'verified' ? 'detected' : 'analyzing',
      priority: opportunity.priority || 'medium',
      category: opportunity.category || 'Digital Transformation',
      type: 'A2A-Detected',
      yellow_panther_fit: opportunity.fitScore || Math.round(opportunity.confidenceScore * 100) || 85,
      confidence: opportunity.confidenceScore || Math.round(opportunity.fitScore) || 85,
      priority_score: Math.ceil(opportunity.fitScore / 10) || 8,
      url: opportunity.sourceUrl || opportunity.url || '',
      contact: opportunity.contact || '',
      source: 'A2A Autonomous System',
      detected_at: opportunity.discoveredAt || new Date().toISOString(),
      evidence_links: opportunity.evidenceLinks || [],
      mcp_analysis: opportunity.mcpAnalysis || {},
      metadata: {
        agentType: opportunity.agentType || 'a2a-system',
        mcpToolsUsed: opportunity.mcpAnalysis?.mcpToolsUsed || [],
        crossReferenced: opportunity.mcpAnalysis?.crossReferenced || [],
        verificationStatus: opportunity.mcpAnalysis?.verificationStatus || 'pending'
      }
    };

    console.log('🎯 Storing A2A opportunity:', rfpRecord);

    // Store in Supabase rfps table
    const { data, error } = await supabase
      .from('rfps')
      .insert([rfpRecord])
      .select()
      .single();

    if (error) {
      console.error('❌ Error storing A2A opportunity in Supabase:', error);
      
      // Fallback: try to create table if it doesn't exist
      if (error.code === 'PGRST116') {
        console.log('📋 rfps table might not exist, creating fallback storage...');
        
        // Store in a fallback JSON file for now
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const fallbackData = {
          ...rfpRecord,
          stored_at: new Date().toISOString(),
          storage_method: 'fallback_json'
        };
        
        const fallbackPath = path.join(process.cwd(), 'a2a-opportunities-fallback.json');
        
        try {
          let existingData = [];
          try {
            const existingContent = await fs.readFile(fallbackPath, 'utf8');
            existingData = JSON.parse(existingContent);
          } catch (e) {
            // File doesn't exist, start with empty array
          }
          
          existingData.push(fallbackData);
          await fs.writeFile(fallbackPath, JSON.stringify(existingData, null, 2));
          
          console.log('✅ Fallback storage successful:', fallbackPath);
          
          return NextResponse.json({
            success: true,
            opportunity: fallbackData,
            storage: 'fallback_json',
            message: 'A2A opportunity stored successfully (fallback)'
          });
          
        } catch (fallbackError) {
          console.error('❌ Fallback storage failed:', fallbackError);
          return NextResponse.json(
            { error: 'Both database and fallback storage failed' },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to store opportunity in database', details: error },
        { status: 500 }
      );
    }

    console.log('✅ A2A opportunity stored successfully:', data);

    // Return success response
    return NextResponse.json({
      success: true,
      opportunity: data,
      storage: 'supabase',
      message: 'A2A opportunity stored successfully'
    });

  } catch (error) {
    console.error('❌ Error processing A2A opportunity:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve A2A opportunities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const source = searchParams.get('source') || 'A2A Autonomous System';

    console.log(`🔍 Retrieving A2A opportunities (limit: ${limit}, source: ${source})`);

    // Try Supabase first
    const { data, error } = await supabase
      .from('rfps')
      .select('*')
      .eq('source', source)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error retrieving from Supabase:', error);
      
      // Fallback to JSON file
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const fallbackPath = path.join(process.cwd(), 'a2a-opportunities-fallback.json');
        
        const content = await fs.readFile(fallbackPath, 'utf8');
        const allData = JSON.parse(content);
        
        // Filter and sort
        const filteredData = allData
          .filter(item => item.source === source)
          .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
          .slice(0, limit);
        
        return NextResponse.json({
          success: true,
          opportunities: filteredData,
          storage: 'fallback_json',
          total: filteredData.length
        });
        
      } catch (fallbackError) {
        console.error('❌ Fallback retrieval failed:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to retrieve opportunities' },
          { status: 500 }
        );
      }
    }

    console.log(`✅ Retrieved ${data.length} A2A opportunities`);

    return NextResponse.json({
      success: true,
      opportunities: data,
      storage: 'supabase',
      total: data.length
    });

  } catch (error) {
    console.error('❌ Error retrieving A2A opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}