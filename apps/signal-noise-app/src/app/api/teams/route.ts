import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const sport = searchParams.get('sport');
    const country = searchParams.get('country');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const letter = searchParams.get('letter'); // For A-Z filtering
    const search = searchParams.get('search'); // For search functionality
    
    let whereConditions = [];
    let queryParams: any[] = [];
    
    if (leagueId) {
      whereConditions.push(`t.league_id = $${queryParams.length + 1}`);
      queryParams.push(leagueId);
    }
    
    if (sport) {
      whereConditions.push(`t.sport = $${queryParams.length + 1}`);
      queryParams.push(sport);
    }
    
    if (country) {
      whereConditions.push(`t.country = $${queryParams.length + 1}`);
      queryParams.push(country);
    }
    
    if (letter && letter !== 'all') {
      whereConditions.push(`UPPER(SUBSTRING(t.name, 1, 1)) = $${queryParams.length + 1}`);
      queryParams.push(letter.toUpperCase());
    }
    
    if (search) {
      whereConditions.push(`UPPER(t.name) LIKE $${queryParams.length + 1}`);
      queryParams.push(`%${search.toUpperCase()}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `
      SELECT 
        t.id,
        t.name,
        t.original_name,
        t.tier,
        t.level,
        t.sport,
        t.country,
        t.founded,
        t.headquarters,
        t.website,
        t.linkedin,
        t.about,
        t.company_size,
        t.priority,
        t.estimated_value,
        t.opportunity_score,
        t.digital_maturity_score,
        t.website_moderness_score,
        t.digital_transformation_score,
        t.procurement_status,
        t.enrichment_status,
        t.badge_path,
        t.badge_s3_url,
        t.league_id,
        l.name as league_name,
        l.badge_path as league_badge_path,
        t.created_at,
        t.updated_at
      FROM teams t
      LEFT JOIN leagues l ON t.league_id = l.id
      ${whereClause}
      ORDER BY t.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await executeSupabaseQuery(query, queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM teams t
      LEFT JOIN leagues l ON t.league_id = l.id
      ${whereClause}
    `;
    
    const countResult = await executeSupabaseQuery(countQuery, queryParams);
    const total = parseInt(countResult.rows[0]?.total || '0');
    
    // Set cache headers for SWR
    const headers = createCacheHeaders();
    
    return NextResponse.json({
      teams: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit)
      }
    }, { headers });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// Mock data for development - in production replace with actual Supabase client
const mockTeams = [
  {
    id: '674e36ad-bd2b-4cb3-824a-6d457a8b3bb0',
    name: 'Arsenal',
    original_name: null,
    tier: '',
    level: 'Premier League',
    sport: 'Football',
    country: 'England',
    founded: 1886,
    headquarters: 'London, England',
    website: 'https://www.arsenal.com/',
    linkedin: 'https://www.linkedin.com/company/arsenal-f-c',
    about: 'Arsenal Football Club exists to make our fans proud',
    company_size: '501-1,000 employees',
    priority: 'CRITICAL',
    estimated_value: '£2.0M-£3.5M',
    opportunity_score: 95,
    digital_maturity_score: 26,
    website_moderness_score: 7,
    digital_transformation_score: 80,
    procurement_status: 'Secured Partnership',
    enrichment_status: 'YELLOW_PANTHER_OPTIMIZED',
    badge_path: '/badges/arsenal-badge.png',
    badge_s3_url: null,
    league_id: '9220abc0-1cac-4014-9a48-59405bac11cb',
    league_name: 'Premier League',
    league_badge_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '720c50c1-1260-44bc-9577-fa6c44206a89',
    name: 'Manchester United',
    original_name: null,
    tier: '',
    level: 'Premier League',
    sport: 'Football',
    country: 'England',
    founded: 1878,
    headquarters: 'MANCHESTER, M16 0RA, GB',
    website: 'http://www.manutd.com',
    linkedin: 'https://www.linkedin.com/company/manchester-united',
    about: 'Manchester United is one of the most popular and successful sports teams in the world',
    company_size: '501-1,000 employees',
    priority: 'CRITICAL',
    estimated_value: '£2.8M-£4.5M',
    opportunity_score: 95,
    digital_maturity_score: 79,
    website_moderness_score: 7,
    digital_transformation_score: 50,
    procurement_status: 'Active',
    enrichment_status: 'YELLOW_PANTHER_OPTIMIZED',
    badge_path: 'badges/manchester-united-badge.png',
    badge_s3_url: null,
    league_id: '9220abc0-1cac-4014-9a48-59405bac11cb',
    league_name: 'Premier League',
    league_badge_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '1c26b18b-7d89-43c4-9d1c-b52ef9080b7b',
    name: 'São Paulo FC',
    original_name: null,
    tier: '',
    level: 'Série A',
    sport: 'Football',
    country: 'Brazil',
    founded: null,
    headquarters: null,
    website: 'https://www.saopaulofc.net/',
    linkedin: 'https://www.linkedin.com/company/s-o-paulo-futebol-clube',
    about: null,
    company_size: null,
    priority: null,
    estimated_value: '',
    opportunity_score: null,
    digital_maturity_score: null,
    website_moderness_score: null,
    digital_transformation_score: null,
    procurement_status: null,
    enrichment_status: null,
    badge_path: 'badges/sao-paulo-badge.png',
    badge_s3_url: null,
    league_id: null,
    league_name: null,
    league_badge_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const mockLeagues = [
  {
    id: '9220abc0-1cac-4014-9a48-59405bac11cb',
    name: 'Premier League',
    original_name: 'Premier League',
    tier: 'tier_1',
    sport: 'Football',
    country: 'England',
    website: '',
    linkedin: '',
    description: 'Professional football league in England',
    digital_maturity_score: 85,
    estimated_value: '£100K-£500K',
    priority_score: 5,
    badge_path: null,
    badge_s3_url: null,
    league_id: '4328',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

function executeSupabaseQuery(query: string, params: any[] = []) {
  console.log('Mock executing query:', query, 'with params:', params);
  
  // Apply parameter substitution first
  let finalQuery = query;
  params.forEach((param, index) => {
    if (typeof param === 'string') {
      finalQuery = finalQuery.replace(`$${index + 1}`, `'${param.replace(/'/g, "''")}'`);
    } else {
      finalQuery = finalQuery.replace(`$${index + 1}`, String(param));
    }
  });
  
  console.log('Final query after substitution:', finalQuery);
  
  if (finalQuery.includes('FROM teams')) {
    let filteredTeams = [...mockTeams];
    
    // Apply filters based on query content
    if (finalQuery.includes('WHERE')) {
      if (finalQuery.includes("t.league_id = '")) {
        const leagueIdMatch = finalQuery.match(/t\.league_id = '([^']+)'/);
        if (leagueIdMatch) {
          filteredTeams = filteredTeams.filter(team => team.league_id === leagueIdMatch[1]);
        }
      }
      
      if (finalQuery.includes("UPPER(SUBSTRING(t.name, 1, 1)) = '")) {
        const letterMatch = finalQuery.match(/UPPER\(SUBSTRING\(t\.name, 1, 1\)\) = '([A-Z])'/);
        if (letterMatch) {
          const letter = letterMatch[1];
          filteredTeams = filteredTeams.filter(team => 
            team.name && team.name.charAt(0).toUpperCase() === letter
          );
        }
      }
      
      if (finalQuery.includes("UPPER(t.name) LIKE '%")) {
        const searchMatch = finalQuery.match(/UPPER\(t\.name\) LIKE '%([^%]+%)'/);
        if (searchMatch) {
          const searchTerm = searchMatch[1];
          filteredTeams = filteredTeams.filter(team => 
            team.name && team.name.toUpperCase().includes(searchTerm)
          );
        }
      }
    }
    
    if (finalQuery.includes('COUNT(*)')) {
      return { rows: [{ total: filteredTeams.length }] };
    }
    
    // Apply pagination
    const limitMatch = finalQuery.match(/LIMIT (\d+)/);
    const offsetMatch = finalQuery.match(/OFFSET (\d+)/);
    
    let limit = 50;
    let offset = 0;
    
    if (limitMatch) limit = parseInt(limitMatch[1]);
    if (offsetMatch) offset = parseInt(offsetMatch[1]);
    
    const paginatedTeams = filteredTeams.slice(offset, offset + limit);
    
    // Add league info
    const teamsWithLeague = paginatedTeams.map(team => {
      const league = mockLeagues.find(l => l.id === team.league_id);
      return {
        ...team,
        league_name: league?.name || null,
        league_badge_path: league?.badge_path || null
      };
    });
    
    return { rows: teamsWithLeague };
  }
  
  return { rows: [] };
}

function createCacheHeaders(maxAge = 300, staleWhileRevalidate = 600) {
  return new Headers({
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'Content-Type': 'application/json',
  });
}