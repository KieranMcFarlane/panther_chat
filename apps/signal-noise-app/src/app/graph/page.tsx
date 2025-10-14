import { Network, Users, Building, FileText, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, Entity } from '@/lib/database';
import { neo4jClient } from '@/lib/neo4j';
import GraphWrapper from '@/components/graph/GraphWrapper';
import { GraphNode, GraphEdge } from '@/components/graph/graph-types';
import { EntityCacheService } from '@/services/EntityCacheService';

// Helper function to get relationship colors
function getRelationshipColor(relationshipType: string): string {
  switch (relationshipType?.toUpperCase()) {
    case 'MEMBER_OF':
      return '#3b82f6'; // Blue
    case 'COMPETES_IN':
      return '#10b981'; // Green
    case 'HOME_VENUE':
      return '#8b5cf6'; // Purple
    case 'RELATED_TO':
      return '#6b7280'; // Gray
    case 'PARTNER_OF':
      return '#f59e0b'; // Orange
    case 'SPONSORED_BY':
      return '#ef4444'; // Red
    default:
      return '#6b7280'; // Default gray
  }
}

// Server-side data fetching function
async function fetchGraphData() {
  console.log('🔧 SERVER SIDE: Fetching graph data from Supabase cache...');
  
  try {
    // Initialize the EntityCacheService to access Supabase cache with 4,422 entities
    const cacheService = new EntityCacheService();
    await cacheService.initialize();
    
    console.log('📊 Fetching ALL entities from Supabase cache (4,422 total expected)...');
    
    // Get entities mentioned in relationships first, then fill with more entities
    console.log('🔍 Getting relationship mapping strategy...');
    
    // First, get all relationships from cache to know which entities to prioritize
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';
    const relationshipsResponse = await fetch(`${baseUrl}/api/graph/relationships-cache`, {
      cache: 'no-store'
    });
    
    const relationshipsData = relationshipsResponse.ok ? await relationshipsResponse.json() : {};
    const allRelationships = relationshipsData.relationships || [];
    console.log(`📊 Found ${allRelationships.length} total cached relationships`);
    
    // Extract unique entity names from relationships
    const relationshipEntityNames = new Set<string>();
    allRelationships.forEach((rel: any) => {
      relationshipEntityNames.add(rel.source_name);
      relationshipEntityNames.add(rel.target_name);
    });
    
    console.log(`🎯 Found ${relationshipEntityNames.size} unique entities in relationships`);
    
    // Get entities from Supabase cache with performance optimization
    console.log('📊 Loading entities from Supabase cache with performance optimization...');
    
    let entities: Entity[] = [];
    let totalAvailable = 0; // Initialize totalAvailable outside the if block
    const INITIAL_LIMIT = 100; // Start with smaller subset for better visualization
    const MAX_ENTITIES = 500; // Cap for interactive performance
    
    // Load initial batch for immediate display
    console.log(`🚀 Loading initial batch of ${INITIAL_LIMIT} entities for performance...`);
    const initialCacheResult = await cacheService.getCachedEntities({
      page: 1,
      limit: INITIAL_LIMIT,
      entityType: 'all'
    });
    
    if (initialCacheResult.entities && initialCacheResult.entities.length > 0) {
      // Convert initial batch of entities for display
      entities = initialCacheResult.entities.map((cachedEntity: any) => {
          const properties = cachedEntity.properties || {};
          const labels = cachedEntity.labels || [];
          
          // Determine entity type from labels
          let entityType = 'entity';
          if (labels.includes('Club') || labels.includes('Company')) {
            entityType = 'club';
          } else if (labels.includes('League')) {
            entityType = 'league';
          } else if (labels.includes('Competition')) {
            entityType = 'competition';
          } else if (labels.includes('Venue') || labels.includes('Stadium')) {
            entityType = 'venue';
          } else if (labels.includes('RfpOpportunity') || labels.includes('RFP')) {
            entityType = 'tender';
          } else if (labels.includes('Stakeholder')) {
            entityType = 'poi';
          } else if (labels.includes('Person') || labels.includes('Sportsperson')) {
            entityType = 'sportsperson';
          }
          
          // For proper relationship mapping, we need to handle ID compatibility
          // The relationships API returns Neo4j elementIds, but cached entities use neo4j_id
          let entity_id = cachedEntity.neo4j_id || cachedEntity.id;
          
          // Check if this is a simple numeric ID that needs to be converted to Neo4j elementId format
          // Since we can't easily convert back to elementId, we'll need to handle this in the relationship mapping
          if (entity_id && !entity_id.includes(':')) {
            // This is a simple ID from cache, we'll need special handling for relationships
            entity_id = cachedEntity.neo4j_id || entity_id;
          }
          
          return {
            entity_id: entity_id,
            neo4j_id: cachedEntity.neo4j_id, // Keep both for different mapping purposes
            cache_id: cachedEntity.id, // Keep the cache ID as backup
            entity_type: entityType,
            name: properties.name || 'Unknown Entity',
            description: properties.description || '',
            source: 'supabase-cache',
            last_updated: properties.last_updated || new Date().toISOString(),
            trust_score: properties.trust_score || 0.8,
            vector_embedding: properties.embedding || [],
            priority_score: properties.priority_score || 0.7,
            notes: properties.notes || '',
            division_id: properties.division_id || properties.league_id || '',
            location: properties.location || properties.city || properties.country || '',
            club_id: properties.club_id || properties.team_id || '',
            role: properties.role || properties.position || '',
            tags: properties.tags || [],
            // Include all original properties
            ...properties
          };
        });
      
      console.log(`✅ PERFORMANCE: Loaded initial ${entities.length} entities for interactive graph`);
      
      // Get total count of available entities
      const cacheStats = await cacheService.getCacheStats();
      totalAvailable = cacheStats.totalCached || 4422; // Fallback to expected count
      console.log(`📊 Total available entities in cache: ${totalAvailable}`);
      
      // Optional: Load additional entities in background for expansion, but don't display immediately
      console.log(`📊 Background loading additional entities up to ${MAX_ENTITIES} limit...`);
      
      let currentPage = 2; // Start from page 2 since we loaded page 1
      let backgroundEntities = [];
      
      while (entities.length < MAX_ENTITIES && currentPage <= 3) { // Limit to 3 pages total
        const additionalResult = await cacheService.getCachedEntities({
          page: currentPage,
          limit: 500, // Smaller batches for background loading
          entityType: 'all'
        });
        
        if (additionalResult.entities && additionalResult.entities.length > 0) {
          const additionalBatch = additionalResult.entities.map((cachedEntity: any) => {
            const properties = cachedEntity.properties || {};
            const labels = cachedEntity.labels || [];
            
            // Determine entity type from labels (reuse logic)
            let entityType = 'entity';
            if (labels.includes('Club') || labels.includes('Company')) {
              entityType = 'club';
            } else if (labels.includes('League')) {
              entityType = 'league';
            } else if (labels.includes('Competition')) {
              entityType = 'competition';
            } else if (labels.includes('Venue') || labels.includes('Stadium')) {
              entityType = 'venue';
            } else if (labels.includes('RfpOpportunity') || labels.includes('RFP')) {
              entityType = 'tender';
            } else if (labels.includes('Stakeholder')) {
              entityType = 'poi';
            } else if (labels.includes('Person') || labels.includes('Sportsperson')) {
              entityType = 'sportsperson';
            }
            
            let entity_id = cachedEntity.neo4j_id || cachedEntity.id;
            if (entity_id && !entity_id.includes(':')) {
              entity_id = cachedEntity.neo4j_id || entity_id;
            }
            
            return {
              entity_id: entity_id,
              neo4j_id: cachedEntity.neo4j_id,
              cache_id: cachedEntity.id,
              entity_type: entityType,
              name: properties.name || 'Unknown Entity',
              description: properties.description || '',
              source: 'supabase-cache',
              last_updated: properties.last_updated || new Date().toISOString(),
              trust_score: properties.trust_score || 0.8,
              vector_embedding: properties.embedding || [],
              priority_score: properties.priority_score || 0.7,
              notes: properties.notes || '',
              division_id: properties.division_id || properties.league_id || '',
              location: properties.location || properties.city || properties.country || '',
              club_id: properties.club_id || properties.team_id || '',
              role: properties.role || properties.position || '',
              tags: properties.tags || [],
              ...properties
            };
          });
          
          backgroundEntities.push(...additionalBatch);
          console.log(`🌐 Background batch loaded: ${additionalBatch.length} additional entities`);
        }
        
        currentPage++;
        
        // Small delay for background loading
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`📈 PERFORMANCE: Ready with ${entities.length} primary + ${backgroundEntities.length} background entities`);
    }
    
    if (entities.length === 0) {
      console.warn('❌ SERVER SIDE: No entities found in Supabase cache, falling back to Neo4j API');
      
      // Fallback to Neo4j API if Supabase cache is empty
      const fallbackResponse = await fetch(`${baseUrl}/api/sports-entities?limit=1000`, {
        cache: 'no-store'
      });
      
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        entities = Array.isArray(data) ? data : (data?.entities ?? []);
        console.log('✅ SERVER SIDE: Fallback loaded entities from Neo4j API:', entities.length);
        totalAvailable = entities.length; // Set totalAvailable for fallback case
      }
    }
    
    // If no entities loaded, set totalAvailable and use mock data
    if (entities.length === 0) {
      totalAvailable = 0; // Set default for mock data case
      console.log('SERVER SIDE: Using mock data');
      entities = [
        {
          entity_id: 'manchester-united',
          entity_type: 'club',
          name: 'Manchester United',
          source: 'mock',
          last_updated: new Date('2025-01-01T00:00:00Z').toISOString(),
          trust_score: 0.9,
          vector_embedding: [],
          priority_score: 8.5,
          notes: 'Premier League club',
          description: 'Premier League club',
          division_id: 'premier-league',
          location: 'Manchester, England',
          tags: ['football', 'premier league']
        },
        {
          entity_id: 'liverpool',
          entity_type: 'club',
          name: 'Liverpool FC',
          source: 'mock',
          last_updated: new Date('2025-01-01T00:00:00Z').toISOString(),
          trust_score: 0.95,
          vector_embedding: [],
          priority_score: 9.0,
          notes: 'Premier League club',
          description: 'Premier League club',
          division_id: 'premier-league',
          location: 'Liverpool, England',
          tags: ['football', 'premier league']
        },
        {
          entity_id: 'marcus-rashford',
          entity_type: 'sportsperson',
          name: 'Marcus Rashford',
          source: 'mock',
          last_updated: new Date('2025-01-01T00:00:00Z').toISOString(),
          trust_score: 0.8,
          vector_embedding: [],
          priority_score: 7.5,
          notes: 'Professional footballer',
          description: 'Professional footballer',
          club_id: 'manchester-united',
          role: 'Forward',
          tags: ['football', 'forward']
        },
        {
          entity_id: 'premier-league',
          entity_type: 'league',
          name: 'Premier League',
          source: 'mock',
          last_updated: new Date('2025-01-01T00:00:00Z').toISOString(),
          trust_score: 0.95,
          vector_embedding: [],
          priority_score: 9.5,
          notes: 'Top English football league',
          description: 'Top English football league',
          tags: ['football', 'league']
        }
      ];
      
      // Set totalAvailable for mock data
      totalAvailable = entities.length;
    }
    
    // Convert entities to graph nodes
    console.log('🔄 SERVER SIDE: Processing entities into graph nodes...');
    const graphNodes: GraphNode[] = entities.map((entity) => {
      let color = '#3b82f6'; // Default blue
      let size = 12; // Default size
      
      switch (entity.entity_type) {
        case 'club':
          color = '#3b82f6'; // Blue
          size = 16;
          break;
        case 'sportsperson':
          color = '#10b981'; // Green
          size = 14;
          break;
        case 'poi':
        case 'contact':
          color = '#8b5cf6'; // Purple
          size = 12;
          break;
        case 'tender':
          color = '#f59e0b'; // Yellow/Orange
          size = 15;
          break;
        case 'league':
          color = '#ef4444'; // Red
          size = 18;
          break;
        case 'venue':
          color = '#6366f1'; // Indigo
          size = 13;
          break;
      }
      
      return {
        id: entity.entity_id,
        label: entity.name || entity.entity_id,
        type: entity.entity_type,
        color,
        size,
        description: entity.description,
        data: entity
      };
    });
    
    console.log('✅ SERVER SIDE: Created graph nodes:', graphNodes.length);
    
    // Create real relationships based on cached data
    const graphEdges: GraphEdge[] = [];
    
    if (allRelationships.length > 0) {
      console.log(`✅ Using ${allRelationships.length} cached relationships`);
      console.log('🔍 Sample cached relationship:', allRelationships[0]);
      
      allRelationships.forEach((rel: any) => {
        // Helper function for fuzzy name matching
        const findEntityByName = (name: string) => {
          // Exact match first
          let entity = entities.find(e => e.name === name);
          if (entity) return entity;
          
          // Try partial/cleaned matches
          const cleanName = name.toLowerCase().replace(/\b(fc|afc)\b/g, '').trim();
          entity = entities.find(e => 
            e.name.toLowerCase().includes(cleanName) || 
            cleanName.includes(e.name.toLowerCase()) ||
            e.name.toLowerCase().replace(/\b(fc|afc)\b/g, '').trim() === cleanName
          );
          
          return entity;
        };
        
        const sourceEntity = findEntityByName(rel.source_name);
        const targetEntity = findEntityByName(rel.target_name);
        
        if (sourceEntity && targetEntity) {
          graphEdges.push({
            source: sourceEntity.entity_id, // Use the entity's actual ID for graph rendering
            target: targetEntity.entity_id,
            strength: rel.weight || 0.8,
            label: rel.relationship_type,
            color: getRelationshipColor(rel.relationship_type)
          });
        } else {
          // Debug missing matches
          if (!sourceEntity) {
            console.log(`⚠️ Source entity not found for name: ${rel.source_name}`);
          }
          if (!targetEntity) {
            console.log(`⚠️ Target entity not found for name: ${rel.target_name}`);
          }
        }
      });
      
      console.log(`✅ Created ${graphEdges.length} graph edges from ${allRelationships.length} cached relationships`);
      
      // Create additional relationships based on entity properties to increase edge density
      console.log('🔗 Creating additional relationships based on entity properties...');
      
      // Group entities by properties for relationship creation
      const entitiesBySport: Record<string, typeof entities> = {};
      const entitiesByCountry: Record<string, typeof entities> = {};
      const entitiesByLeague: Record<string, typeof entities> = {};
      
      entities.forEach(entity => {
        // Group by sport
        const sport = entity.sport || entity.properties?.sport || 'Unknown';
        if (!entitiesBySport[sport]) entitiesBySport[sport] = [];
        entitiesBySport[sport].push(entity);
        
        // Group by country
        const country = entity.location || entity.properties?.country || entity.properties?.city || 'Unknown';
        if (!entitiesByCountry[country]) entitiesByCountry[country] = [];
        entitiesByCountry[country].push(entity);
        
        // Group by league/division
        const league = entity.division_id || entity.properties?.division_id || entity.properties?.league_id || 'Unknown';
        if (!entitiesByLeague[league]) entitiesByLeague[league] = [];
        entitiesByLeague[league].push(entity);
      });
      
      // Create sport-based relationships (SPORTS_PLAYED_IN)
      Object.entries(entitiesBySport).forEach(([sport, sportEntities]) => {
        if (sportEntities.length > 1 && sport !== 'Unknown') {
          console.log(`🏆 Creating ${sportEntities.length} sport relationships for: ${sport}`);
          sportEntities.slice(0, 20).forEach((entity1, i) => {
            sportEntities.slice(i + 1, Math.min(i + 6, sportEntities.length)).forEach(entity2 => {
              if (entity1.entity_id !== entity2.entity_id) {
                graphEdges.push({
                  source: entity1.entity_id,
                  target: entity2.entity_id,
                  strength: 0.6,
                  label: 'SAME_SPORT',
                  color: '#10b981' // Green
                });
              }
            });
          });
        }
      });
      
      // Create country-based relationships (BASED_IN)
      Object.entries(entitiesByCountry).forEach(([country, countryEntities]) => {
        if (countryEntities.length > 1 && country !== 'Unknown') {
          console.log(`🌍 Creating ${countryEntities.length} location relationships for: ${country}`);
          countryEntities.slice(0, 15).forEach((entity1, i) => {
            countryEntities.slice(i + 1, Math.min(i + 4, countryEntities.length)).forEach(entity2 => {
              if (entity1.entity_id !== entity2.entity_id) {
                graphEdges.push({
                  source: entity1.entity_id,
                  target: entity2.entity_id,
                  strength: 0.7,
                  label: 'SAME_LOCATION',
                  color: '#8b5cf6' // Purple
                });
              }
            });
          });
        }
      });
      
      // Create league-based relationships (COMPETES_IN)
      Object.entries(entitiesByLeague).forEach(([league, leagueEntities]) => {
        if (leagueEntities.length > 1 && league !== 'Unknown') {
          console.log(`🏟️ Creating ${leagueEntities.length} league relationships for: ${league}`);
          leagueEntities.forEach((entity1, i) => {
            leagueEntities.slice(i + 1, Math.min(i + 8, leagueEntities.length)).forEach(entity2 => {
              if (entity1.entity_id !== entity2.entity_id) {
                graphEdges.push({
                  source: entity1.entity_id,
                  target: entity2.entity_id,
                  strength: 0.8,
                  label: 'COMPETES_TOGETHER',
                  color: '#f59e0b' // Orange
                });
              }
            });
          });
        }
      });
      
      console.log(`✅ Created ${graphEdges.length} total graph edges (original + synthetic)`);
      
    } else {
      // Fallback: create relationships based on entity types
      console.log('🔄 Using fallback relationship creation...');
      const clubs = entities.filter(e => e.entity_type === 'club');
      const leagues = entities.filter(e => e.entity_type === 'league');
      const competitions = entities.filter(e => e.entity_type === 'competition');
      
      // Connect clubs to leagues
      clubs.forEach(club => {
        leagues.forEach(league => {
          graphEdges.push({
            source: club.entity_id,
            target: league.entity_id,
            strength: 0.9,
            label: 'MEMBER_OF',
            color: '#6b7280'
          });
        });
        
        // Connect clubs to competitions
        competitions.forEach(competition => {
          graphEdges.push({
            source: club.entity_id,
            target: competition.entity_id,
            strength: 0.8,
            label: 'COMPETES_IN',
            color: '#3b82f6'
          });
        });
      });
    }
    
    console.log('✅ SERVER SIDE: Created graph edges:', graphEdges.length);
    
    return {
      nodes: graphNodes,
      edges: graphEdges,
      totalAvailable: totalAvailable || graphNodes.length
    };
    
  } catch (error) {
    console.error('❌ SERVER SIDE: Error fetching graph data:', error);
    
    // Return fallback data
    const fallbackNodes: GraphNode[] = [
      { 
        id: '1', 
        label: 'Manchester United', 
        type: 'club', 
        color: '#3b82f6', 
        size: 16,
        description: 'Premier League club'
      },
      { 
        id: '2', 
        label: 'Marcus Rashford', 
        type: 'sportsperson', 
        color: '#10b981', 
        size: 14,
        description: 'Professional footballer'
      },
      { 
        id: '3', 
        label: 'Premier League', 
        type: 'league', 
        color: '#ef4444', 
        size: 18,
        description: 'Top English football league'
      }
    ];
    
    const fallbackEdges: GraphEdge[] = [
      { source: '1', target: '2', strength: 0.9, label: 'Player of', color: '#6b7280' },
      { source: '1', target: '3', strength: 0.8, label: 'Member of', color: '#6b7280' }
    ];
    
    return {
      nodes: fallbackNodes,
      edges: fallbackEdges,
      totalAvailable: fallbackNodes.length
    };
  }
}

export default async function EnhancedGraphPage() {
  // Fetch data on server side
  const graphData = await fetchGraphData();
  
  console.log('🎯 SERVER COMPONENT: Rendering with data:', {
    nodes: graphData.nodes.length,
    edges: graphData.edges.length,
    totalAvailable: graphData.totalAvailable
  });

  return (
    <div className="max-w-7xl overflow-hidden rounded-lg mx-auto space-y-6 h-full" style={{ 
      backgroundColor: '#242834',
      borderRadius: '8px',
      paddingTop: '2rem',
      paddingLeft: '1rem',
      paddingRight: '1rem'
    }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Graph</h1>
          <p className="text-fm-light-grey">Interactive entity relationship visualization</p>
        </div>
        
        {/* Server-side data info */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
            Interactive: {graphData.nodes.length} nodes
          </div>
          <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">
            ⚡ Performance optimized
          </div>
          {graphData.totalAvailable > graphData.nodes.length && (
            <div className="bg-purple-600 text-white px-3 py-1 rounded-lg text-sm">
              📊 {graphData.totalAvailable} total available
            </div>
          )}
          {graphData.nodes.length >= 800 && (
            <div className="bg-purple-600 text-white px-3 py-1 rounded-lg text-sm">
              🚀 Performance optimized
            </div>
          )}
        </div>
      </div>

      {/* Server Component Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-custom-box border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">🏟️</div>
            <div>
              <div className="text-2xl font-bold text-white">
                {graphData.nodes.filter(n => n.type === 'club').length}
              </div>
              <div className="text-sm text-fm-medium-grey">Clubs</div>
            </div>
          </div>
        </div>

        <div className="bg-custom-box border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center">⚽</div>
            <div>
              <div className="text-2xl font-bold text-white">
                {graphData.nodes.filter(n => n.type === 'sportsperson').length}
              </div>
              <div className="text-sm text-fm-medium-grey">Sportspeople</div>
            </div>
          </div>
        </div>

        <div className="bg-custom-box border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center">👤</div>
            <div>
              <div className="text-2xl font-bold text-white">
                {graphData.nodes.filter(n => n.type === 'poi').length}
              </div>
              <div className="text-sm text-fm-medium-grey">POIs</div>
            </div>
          </div>
        </div>

        <div className="bg-custom-box border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">📋</div>
            <div>
              <div className="text-2xl font-bold text-white">
                {graphData.nodes.filter(n => n.type === 'tender').length}
              </div>
              <div className="text-sm text-fm-medium-grey">Tenders</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pass data to client component */}
      <GraphWrapper 
        initialNodes={graphData.nodes}
        initialEdges={graphData.edges}
        totalAvailableNodes={graphData.totalAvailable}
      />
    </div>
  );
}