import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const country = searchParams.get('country');
    const includeTeams = searchParams.get('includeTeams') === 'true';
    
    let whereConditions = [];
    let queryParams: any[] = [];
    
    if (sport) {
      whereConditions.push(`sport = $${queryParams.length + 1}`);
      queryParams.push(sport);
    }
    
    if (country) {
      whereConditions.push(`country = $${queryParams.length + 1}`);
      queryParams.push(country);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    let query = `
      SELECT 
        id,
        name,
        original_name,
        tier,
        sport,
        country,
        website,
        linkedin,
        description,
        digital_maturity_score,
        estimated_value,
        priority_score,
        badge_path,
        badge_s3_url,
        league_id,
        created_at,
        updated_at
      FROM leagues 
      ${whereClause}
      ORDER BY priority_score DESC, name ASC
    `;
    
    // If includeTeams is true, fetch teams with league info
    if (includeTeams) {
      query = `
        SELECT 
          l.id,
          l.name,
          l.original_name,
          l.tier,
          l.sport,
          l.country,
          l.website,
          l.linkedin,
          l.description,
          l.digital_maturity_score,
          l.estimated_value,
          l.priority_score,
          l.badge_path,
          l.badge_s3_url,
          l.league_id,
          l.created_at,
          l.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'original_name', t.original_name,
                'tier', t.tier,
                'level', t.level,
                'sport', t.sport,
                'country', t.country,
                'founded', t.founded,
                'headquarters', t.headquarters,
                'website', t.website,
                'linkedin', t.linkedin,
                'about', t.about,
                'company_size', t.company_size,
                'priority', t.priority,
                'estimated_value', t.estimated_value,
                'opportunity_score', t.opportunity_score,
                'digital_maturity_score', t.digital_maturity_score,
                'badge_path', t.badge_path,
                'badge_s3_url', t.badge_s3_url
              ) ORDER BY t.name ASC
            ) FILTER (WHERE t.id IS NOT NULL), 
            '[]'::json
          ) as teams
        FROM leagues l
        LEFT JOIN teams t ON l.id = t.league_id
        ${whereClause}
        GROUP BY l.id, l.name, l.original_name, l.tier, l.sport, l.country, l.website, l.linkedin, l.description, l.digital_maturity_score, l.estimated_value, l.priority_score, l.badge_path, l.badge_s3_url, l.league_id, l.created_at, l.updated_at
        ORDER BY l.priority_score DESC, l.name ASC
      `;
    }
    
    const result = await executeSupabaseQuery(query, queryParams);
    
    // Set cache headers for SWR
    const headers = createCacheHeaders();
    
    return NextResponse.json(result.rows, { headers });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch leagues' },
      { status: 500 }
    );
  }
}

// Mock data for development - in production replace with actual Supabase client
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
  },
  {
    id: '2b0b70b8-454a-46e5-9ac7-c43139058fee',
    name: 'Indian Premier League (IPL)',
    original_name: 'Indian Premier League (IPL)',
    tier: 'tier_1',
    sport: 'Cricket',
    country: 'India',
    website: '',
    linkedin: '',
    description: 'Global cricket league benchmark for digital engagement',
    digital_maturity_score: 90,
    estimated_value: '£100K-£500K',
    priority_score: 5,
    badge_path: '/badges/indian-premier-league-badge.png',
    badge_s3_url: null,
    league_id: '13579',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '4b756ebb-f7ba-412f-a8ed-800227676c3c',
    name: 'Australian Football League (AFL)',
    original_name: 'Australian Football League (AFL)',
    tier: 'tier_1',
    sport: 'Australian Rules Football',
    country: 'Australia',
    website: '',
    linkedin: '',
    description: 'AFL Live Pass (WatchAFL internationally), advanced fan data analytics',
    digital_maturity_score: 85,
    estimated_value: '£100K-£500K',
    priority_score: 5,
    badge_path: '/badges/australian-football-league-badge.png',
    badge_s3_url: null,
    league_id: '1248',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

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
  
  if (finalQuery.includes('FROM leagues')) {
    if (finalQuery.includes('LEFT JOIN teams')) {
      // Return leagues with teams
      const leaguesWithTeams = mockLeagues.map(league => ({
        ...league,
        teams: mockTeams.filter(team => team.league_id === league.id)
      }));
      return { rows: leaguesWithTeams };
    }
    return { rows: mockLeagues };
  }
  
  return { rows: [] };
}

function createCacheHeaders(maxAge = 300, staleWhileRevalidate = 600) {
  return new Headers({
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'Content-Type': 'application/json',
  });
}