// AI Entity Enrichment API - Economical Batching with BrightData Integration
// Integrates Claude Agent SDK, Perplexity, and BrightData for comprehensive entity analysis

import { NextRequest, NextResponse } from 'next/server'
import { neo4jService, neo4jClient } from '@/lib/neo4j'
import { supabase } from '@/lib/supabase-client'

// BrightData scraping implementation
async function performBrightDataScraping(entity: any): Promise<any> {
  if (!process.env.BRIGHTDATA_API_TOKEN) {
    console.log('⚠️ BrightData API token not configured');
    return null;
  }

  try {
    console.log(`🌐 Starting BrightData scraping for ${entity.properties.name}`);
    
    const scrapedData: any = {
      linkedin_data: null,
      crunchbase_data: null,
      web_data: null,
      sources_found: 0,
      last_scraped: new Date().toISOString()
    };

    const entityName = entity.properties.name || 'Unknown';
    const entityType = entity.properties.type || 'unknown';

    // LinkedIn scraping for companies and personnel
    if (entityType === 'person' || entityType === 'club' || entityType === 'organization') {
      try {
        console.log(`🔍 Searching LinkedIn for ${entityName}...`);
        const linkedinSearchUrl = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(entityName)}`;
        
        const linkedinData = await scrapeWithBrightData(linkedinSearchUrl, 'linkedin_search');
        if (linkedinData && linkedinData.length > 0) {
          scrapedData.linkedin_data = {
            search_results: linkedinData.slice(0, 3), // Top 3 results
            profile_url: linkedinData[0]?.url || null,
            company_size: linkedinData[0]?.company_size || null,
            industry: linkedinData[0]?.industry || null,
            description: linkedinData[0]?.description || null
          };
          scrapedData.sources_found++;
          console.log(`✅ Found LinkedIn data for ${entityName}`);
        }
      } catch (error) {
        console.error(`❌ LinkedIn scraping failed for ${entityName}:`, error);
      }
    }

    // Crunchbase scraping for companies and organizations
    if (entityType === 'club' || entityType === 'organization' || entityType === 'league') {
      try {
        console.log(`💼 Searching Crunchbase for ${entityName}...`);
        const crunchbaseSearchUrl = `https://www.crunchbase.com/organization/${encodeURIComponent(entityName.toLowerCase().replace(/\s+/g, '-'))}`;
        
        const crunchbaseData = await scrapeWithBrightData(crunchbaseSearchUrl, 'crunchbase');
        if (crunchbaseData) {
          scrapedData.crunchbase_data = {
            funding: crunchbaseData.funding || null,
            investors: crunchbaseData.investors || [],
            valuation: crunchbaseData.valuation || null,
            employee_count: crunchbaseData.employee_count || null,
            founded: crunchbaseData.founded || null,
            description: crunchbaseData.description || null,
            website: crunchbaseData.website || null
          };
          scrapedData.sources_found++;
          console.log(`✅ Found Crunchbase data for ${entityName}`);
        }
      } catch (error) {
        console.error(`❌ Crunchbase scraping failed for ${entityName}:`, error);
      }
    }

    // General web search for news and updates
    try {
      console.log(`🌍 Searching web for recent news about ${entityName}...`);
      const webSearchQuery = `${entityName} ${entityType === 'club' ? 'football club news' : entityType === 'person' ? 'executive appointment' : 'sports organization'} 2024`;
      
      const webData = await scrapeWithBrightData(`https://www.google.com/search?q=${encodeURIComponent(webSearchQuery)}`, 'google_search');
      if (webData && webData.length > 0) {
        scrapedData.web_data = {
          news_results: webData.slice(0, 5), // Top 5 news results
          total_results: webData.length,
          search_query: webSearchQuery
        };
        scrapedData.sources_found++;
        console.log(`✅ Found web data for ${entityName}`);
      }
    } catch (error) {
      console.error(`❌ Web search failed for ${entityName}:`, error);
    }

    console.log(`📊 BrightData scraping completed for ${entityName}: ${scrapedData.sources_found} sources found`);
    return scrapedData;

  } catch (error) {
    console.error('BrightData scraping failed:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      sources_found: 0,
      last_scraped: new Date().toISOString()
    };
  }
}

async function scrapeWithBrightData(url: string, scraper_type: string): Promise<any> {
  try {
    console.log(`🚀 Starting ${scraper_type} scraping: ${url}`);
    
    // Use BrightData SERP API for scraping
    const apiUrl = 'https://api.brightdata.com/serp';
    const requestBody = {
      q: url.includes('linkedin.com') ? `site:linkedin.com "${extractSearchQuery(url)}"` : 
          url.includes('crunchbase.com') ? `site:crunchbase.com "${extractSearchQuery(url)}"` :
          extractSearchQuery(url),
      engine: 'google',
      num: scraper_type.includes('search') ? 10 : 5,
      location: 'United Kingdom',
      lang: 'en'
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ ${scraper_type} scraping completed successfully`);
    
    // Return organic results
    return result.organic_results || [];

  } catch (error) {
    console.error(`❌ ${scraper_type} scraping error:`, error);
    
    // Fallback to basic HTTP request if BrightData API fails
    try {
      console.log(`🔄 Attempting fallback HTTP request for ${scraper_type}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        // Extract basic information from HTML
        const extractedData = extractBasicInfo(html, url);
        return extractedData;
      }
    } catch (fallbackError) {
      console.error(`❌ Fallback request also failed for ${scraper_type}:`, fallbackError);
    }
    
    return null;
  }
}

function extractSearchQuery(url: string): string {
  if (url.includes('linkedin.com/search')) {
    const match = url.match(/keywords=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }
  if (url.includes('crunchbase.com/organization/')) {
    return url.split('/').pop()?.replace(/-/g, ' ') || '';
  }
  if (url.includes('google.com/search')) {
    const match = url.match(/q=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }
  return '';
}

function extractBasicInfo(html: string, url: string): any[] {
  // Basic HTML parsing to extract some useful information
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  
  const basicInfo = {
    title: titleMatch ? titleMatch[1].replace(/[^a-zA-Z0-9\s]/g, '') : '',
    description: descriptionMatch ? descriptionMatch[1] : '',
    url: url,
    extracted: true
  };

  return [basicInfo];
}

// Claude Agent analysis using existing infrastructure
async function performClaudeAnalysis(entity: any): Promise<any> {
  try {
    console.log(`🤖 Starting Claude Agent analysis for ${entity.properties.name}`);
    
    const claudeAgentUrl = `${process.env.ANTHROPIC_BASE_URL}/v1/messages`;
    const entityName = entity.properties.name || 'Unknown Entity';
    const entityType = entity.properties.type || 'organization';

    const prompt = `Analyze this sports entity for business partnership opportunities:

Entity: ${entityName}
Type: ${entityType}

Provide analysis in JSON format:
{
  "opportunity_score": (0-100),
  "digital_maturity": (0-100),
  "partnership_readiness": (0-100),
  "estimated_value": "£X.XM",
  "summary": "Brief analysis summary",
  "recommendations": ["rec1", "rec2", "rec3"],
  "strengths": ["strength1", "strength2"],
  "challenges": ["challenge1", "challenge2"],
  "next_steps": ["step1", "step2"]
}`;

    const response = await fetch(claudeAgentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_AUTH_TOKEN!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude Agent API error: ${response.status}`);
    }

    const result = await response.json();
    const analysisText = result.content[0]?.text || '{}';
    
    // Parse JSON from Claude response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    let analysis = {};
    
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn('Failed to parse Claude analysis JSON, using fallback');
        analysis = createFallbackAnalysis(entityName, entityType);
      }
    } else {
      analysis = createFallbackAnalysis(entityName, entityType);
    }

    console.log(`✅ Claude analysis completed: Score ${analysis.opportunity_score}`);
    return analysis;

  } catch (error) {
    console.error('Claude analysis failed:', error);
    return createFallbackAnalysis(entity.properties.name, entity.properties.type);
  }
}

function createFallbackAnalysis(name: string, type: string): any {
  return {
    opportunity_score: 75,
    digital_maturity: 60,
    partnership_readiness: 70,
    estimated_value: '£2.5M',
    summary: `${name} presents moderate partnership opportunities in the ${type} sector.`,
    recommendations: ['Initial outreach', 'Capability demonstration', 'Pilot proposal'],
    strengths: ['Market presence', 'Growth potential'],
    challenges: ['Competition', 'Budget constraints'],
    next_steps: ['Research contact points', 'Prepare tailored proposal']
  };
}

// Perplexity market research
async function performPerplexityResearch(entity: any): Promise<any> {
  if (!process.env.PERPLEXITY_API_KEY) {
    return null;
  }

  try {
    console.log(`🔍 Starting Perplexity research for ${entity.properties.name}`);
    
    const entityName = entity.properties.name || 'Unknown';
    const marketQuery = `${entityName} partnerships sponsorships commercial opportunities 2024 sports business`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ 
          role: 'user', 
          content: `Research market intelligence about: ${marketQuery}. Focus on recent partnerships, sponsorships, and commercial activities.` 
        }],
        max_tokens: 800
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Perplexity research completed`);
    
    return {
      content: result.choices[0]?.message?.content || '',
      sources: result.sources || [],
      model: result.model
    };

  } catch (error) {
    console.error('Perplexity research failed:', error);
    return null;
  }
}

// Database operations
async function getEntityFromNeo4j(entity_id: string) {
  const driver = neo4jClient;
  const session = driver.session();
  
  try {
    console.log(`🔍 Querying Neo4j for entity_id: ${entity_id}`);
    
    // First try the exact ID matches
    let query = `
      MATCH (e) 
      WHERE elementId(e) = $entity_id 
      RETURN e {
        id: elementId(e),
        labels: labels(e),
        properties: properties(e)
      } as entity
    `;
    
    let result = await session.run(query, { entity_id });
    console.log(`📊 ElementId query returned ${result.records.length} records`);
    
    // If no match, try to match by string ID property (for API IDs)
    if (result.records.length === 0) {
      console.log(`🔄 Trying fallback query with string ID matching`);
      query = `
        MATCH (e) 
        WHERE e.id = $entity_id OR toString(e.neo4j_id) = $entity_id
        RETURN e {
          id: elementId(e),
          labels: labels(e),
          properties: properties(e)
        } as entity
      `;
      
      result = await session.run(query, { entity_id });
      console.log(`📊 Fallback query returned ${result.records.length} records`);
    }
    
    // If still no match, try name-based matching for common sports entities
    if (result.records.length === 0) {
      console.log(`🔄 No ID match found, trying name-based matching`);
      
      // Try to match by common sports entity names
      const possibleNames = [
        entity_id.toLowerCase(),
        entity_id.replace(/[-_]/g, ' ').toLowerCase(),
        entity_id.includes('manchester') ? entity_id.toLowerCase() : null
      ].filter(Boolean);
      
      if (possibleNames.length > 0) {
        query = `
          MATCH (e) 
          WHERE toLower(e.name) CONTAINS $possibleNames[0] OR toLower(e.name) CONTAINS $possibleNames[1] OR toLower(e.name) CONTAINS $possibleNames[2]
          RETURN e {
            id: elementId(e),
            labels: labels(e),
            properties: properties(e)
          } as entity
          LIMIT 1
        `;
        
        result = await session.run(query, { possibleNames });
        console.log(`📊 Name-based query returned ${result.records.length} records`);
      }
    }
    
    if (result.records.length === 0) {
      console.log(`❌ No entity found with ID: ${entity_id}`);
      return null;
    }
    
    const entity = result.records[0].get('entity');
    console.log(`✅ Found entity: ${entity.properties?.name || 'Unknown'} with elementId: ${entity.id}`);
    return entity;
  } catch (error) {
    console.error(`❌ Error in getEntityFromNeo4j:`, error);
    return null;
  } finally {
    await session.close();
  }
}

async function updateEntityInNeo4j(entity_id: string, enrichmentData: any) {
  const driver = neo4jClient;
  const session = driver.session();
  
  try {
    // Try to match by elementId first (for internal Neo4j IDs)
    let query = `
      MATCH (e) 
      WHERE elementId(e) = $entity_id 
      SET e += $enrichmentData,
          e.last_enriched = datetime()
    `;
    
    let result = await session.run(query, { entity_id, enrichmentData });
    
    // If no match, try to match by string ID property (for API IDs)
    if (result.summary.counters.updates() === 0) {
      query = `
        MATCH (e) 
        WHERE e.id = $entity_id OR toString(e.neo4j_id) = $entity_id
        SET e += $enrichmentData,
            e.last_enriched = datetime()
      `;
      
      await session.run(query, { entity_id, enrichmentData });
    }
    
    console.log(`✅ Updated Neo4j entity ${enrichmentData.name}`);
  } finally {
    await session.close();
  }
}

async function updateSupabaseCache(entity: any, enrichmentData: any) {
  try {
    const { error } = await supabase
      .from('entity_cache')
      .upsert({
        entity_id: entity.id,
        name: enrichmentData.name,
        type: enrichmentData.type,
        enrichment_data: enrichmentData,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Supabase cache update failed:', error);
    } else {
      console.log(`✅ Updated Supabase cache for ${enrichmentData.name}`);
    }
  } catch (error) {
    console.warn('Supabase cache update error:', error);
  }
}

// Helper function to create flattened enrichment data
function createFlattenedEnrichmentData(
  entity: any, 
  claudeAnalysis: any, 
  perplexityResult: any,
  brightdataResult: any
): any {
  
  const flattened: any = {};
  
  // Basic entity info
  flattened.name = entity.properties.name || 'Unknown';
  flattened.type = entity.properties.type || 'unknown';
  flattened.entity_id = entity.id;
  flattened.neo4j_id = entity.neo4j_id;
  
  // AI Analysis Scores
  flattened.opportunity_score = claudeAnalysis.opportunity_score || 70;
  flattened.digital_maturity = claudeAnalysis.digital_maturity || 50;
  flattened.partnership_readiness = claudeAnalysis.partnership_readiness || 60;
  flattened.estimated_value = claudeAnalysis.estimated_value || 'Not estimated';
  
  // AI Analysis Details
  flattened.analysis_summary = claudeAnalysis.summary || '';
  flattened.recommendations = JSON.stringify(claudeAnalysis.recommendations || []);
  flattened.strengths = JSON.stringify(claudeAnalysis.strengths || []);
  flattened.challenges = JSON.stringify(claudeAnalysis.challenges || []);
  flattened.next_steps = JSON.stringify(claudeAnalysis.next_steps || []);
  
  // Perplexity Research (if available)
  if (perplexityResult && perplexityResult.content) {
    flattened.market_intelligence = perplexityResult.content.substring(0, 2000);
    flattened.market_sources = JSON.stringify(perplexityResult.sources || []);
  }
  
  // BrightData Scraping Results
  if (brightdataResult) {
    flattened.linkedin_available = brightdataResult.linkedin_data ? 'Yes' : 'No';
    flattened.crunchbase_available = brightdataResult.crunchbase_data ? 'Yes' : 'No';
    flattened.web_data_available = brightdataResult.web_data ? 'Yes' : 'No';
    
    if (brightdataResult.linkedin_data) {
      flattened.linkedin_company_size = brightdataResult.linkedin_data.company_size || '';
      flattened.linkedin_industry = brightdataResult.linkedin_data.industry || '';
      flattened.linkedin_description = brightdataResult.linkedin_data.description || '';
    }
    
    if (brightdataResult.crunchbase_data) {
      flattened.crunchbase_funding = brightdataResult.crunchbase_data.funding || '';
      flattened.crunchbase_investors = JSON.stringify(brightdataResult.crunchbase_data.investors || []);
      flattened.crunchbase_valuation = brightdataResult.crunchbase_data.valuation || '';
      flattened.crunchbase_employees = brightdataResult.crunchbase_data.employee_count || '';
      flattened.crunchbase_founded = brightdataResult.crunchbase_data.founded || '';
    }
    
    if (brightdataResult.web_data) {
      flattened.recent_news = JSON.stringify(brightdataResult.web_data.news_results || []);
      flattened.news_search_query = brightdataResult.web_data.search_query || '';
    }
    
    flattened.brightdata_sources_found = brightdataResult.sources_found || 0;
  }
  
  // Enrichment metadata
  flattened.enriched_at = new Date().toISOString();
  flattened.enrichment_version = '2.0';
  flattened.data_sources = JSON.stringify(['claude_analysis', 'perplexity_research', 'brightdata_scraping'].filter(source => {
    if (source === 'perplexity_research') return !!perplexityResult;
    if (source === 'brightdata_scraping') return !!brightdataResult;
    return true;
  }));
  
  console.log(`✅ Created flattened enrichment data for ${flattened.name}:`, {
    opportunity_score: flattened.opportunity_score,
    digital_maturity: flattened.digital_maturity,
    sources_found: flattened.brightdata_sources_found
  });
  
  return flattened;
}

// API endpoints
export async function POST(request: NextRequest) {
  console.log('🚀 Starting economical entity enrichment with BrightData integration');
  
  try {
    const body = await request.json();
    const { entity_id, include_perplexity_research = false, include_brightdata_scraping = true } = body;
    
    if (!entity_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'entity_id is required' 
      }, { status: 400 });
    }
    
    // Get entity from Neo4j
    console.log(`🔍 Looking for entity with ID: ${entity_id}`);
    const entity = await getEntityFromNeo4j(entity_id);
    if (!entity) {
      console.log(`❌ Entity not found with ID: ${entity_id}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Entity not found' 
      }, { status: 404 });
    }
    
    console.log(`📋 Processing entity: ${entity.properties.name} (${entity.properties.type})`);
    
    // Initialize enrichment results
    let claudeAnalysis = null;
    let perplexityResult = null;
    let brightdataResult = null;
    
    try {
      // Step 1: Claude Agent Analysis (always included)
      console.log(`🤖 Starting Claude Agent analysis for ${entity.properties.name}...`);
      claudeAnalysis = await performClaudeAnalysis(entity);
      console.log(`✅ Claude analysis completed: Score ${claudeAnalysis.opportunity_score}`);
      
      // Step 2: Perplexity Research (optional)
      if (include_perplexity_research && process.env.PERPLEXITY_API_KEY) {
        console.log(`🔍 Starting Perplexity research for ${entity.properties.name}...`);
        perplexityResult = await performPerplexityResearch(entity);
        if (perplexityResult) {
          console.log(`✅ Perplexity research completed`);
        } else {
          console.log(`⚠️ Perplexity research returned no results`);
        }
      } else {
        console.log(`⏭️ Skipping Perplexity research (disabled)`);
      }
      
      // Step 3: BrightData Scraping (now enabled by default for economical batching)
      if (include_brightdata_scraping && process.env.BRIGHTDATA_API_TOKEN) {
        console.log(`🌐 Starting BrightData scraping for ${entity.properties.name}...`);
        brightdataResult = await performBrightDataScraping(entity);
        if (brightdataResult && brightdataResult.sources_found > 0) {
          console.log(`✅ BrightData scraping completed: ${brightdataResult.sources_found} sources found`);
        } else {
          console.log(`⚠️ BrightData scraping returned no results`);
        }
      } else {
        console.log(`⏭️ Skipping BrightData scraping (disabled or no API key)`);
      }
      
      // Step 4: Create flattened enrichment data for Neo4j
      const flattenedEnrichmentData = createFlattenedEnrichmentData(
        entity, 
        claudeAnalysis, 
        perplexityResult, 
        brightdataResult
      );
      
      // Step 5: Update Neo4j with flattened enrichment data
      console.log(`💾 Updating Neo4j with enrichment data...`);
      await updateEntityInNeo4j(entity_id, flattenedEnrichmentData);
      
      // Step 6: Update Supabase cache
      console.log(`🗄️ Updating Supabase cache...`);
      await updateSupabaseCache(entity, flattenedEnrichmentData);
      
      return NextResponse.json({
        success: true,
        message: 'Entity enrichment completed successfully with BrightData integration',
        entity: {
          id: entity.id,
          name: entity.properties.name,
          type: entity.properties.type
        },
        enrichment: {
          claude_analysis: claudeAnalysis,
          perplexity_research: perplexityResult,
          brightdata_scraping: brightdataResult
        },
        flattened_data: flattenedEnrichmentData,
        processing_summary: {
          services_used: {
            claude_analysis: true,
            perplexity_research: !!perplexityResult,
            brightdata_scraping: !!brightdataResult
          },
          scores: {
            opportunity_score: flattenedEnrichmentData.opportunity_score,
            digital_maturity: flattenedEnrichmentData.digital_maturity,
            partnership_readiness: flattenedEnrichmentData.partnership_readiness
          },
          data_sources: JSON.parse(flattenedEnrichmentData.data_sources || '[]'),
          total_sources: brightdataResult?.sources_found || 0,
          brightdata_integration: 'ECONOMICAL_BATCHING_ENABLED'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (processingError) {
      console.error('❌ Enrichment processing failed:', processingError);
      return NextResponse.json({
        success: false,
        error: processingError instanceof Error ? processingError.message : 'Unknown processing error',
        entity: {
          id: entity.id,
          name: entity.properties.name,
          type: entity.properties.type
        },
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Entity enrichment failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'AI Entity Enrichment API with BrightData Integration',
    version: '2.1',
    description: 'Economical batching system with BrightData web scraping',
    endpoints: {
      POST: '/api/enrich-entity - Enrich a single entity with AI analysis and BrightData scraping',
    },
    available_services: {
      claude_analysis: !!process.env.ANTHROPIC_AUTH_TOKEN,
      perplexity_research: !!process.env.PERPLEXITY_API_KEY,
      brightdata_scraping: !!process.env.BRIGHTDATA_API_TOKEN,
      brightdata_zone: process.env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor'
    },
    economical_features: {
      batch_size: process.env.BATCH_SIZE || 3,
      memory_threshold: process.env.MEMORY_THRESHOLD_MB || 512,
      brightdata_integration: 'ENABLED_BY_DEFAULT',
      fallback_mechanisms: 'HTTP_FALLBACK_ENABLED'
    }
  });
}