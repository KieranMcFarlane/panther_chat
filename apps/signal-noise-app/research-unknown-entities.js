#!/usr/bin/env node

const https = require('https');

// Simple Supabase client for the research script
const supabase = {
  from: (table) => ({
    select: (columns) => ({
      or: (condition) => ({
        limit: (count) => new Promise((resolve) => {
          // This would need actual Supabase credentials
          console.log(`Would query ${table} for ${columns} where ${condition} limit ${count}`);
          resolve({ data: [], error: null });
        })
      })
    }),
    update: (data) => ({
      eq: (column, value) => new Promise((resolve) => {
        console.log(`Would update ${table} set ${JSON.stringify(data)} where ${column} = ${value}`);
        resolve({ error: null });
      })
    })
  })
};

// Simple web search function that uses multiple search engines
async function searchEntity(entityName, sport = '') {
  const searchQuery = `${entityName} ${sport}`.trim();
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'duckduckgo.com',
      path: `/html/?q=${encodeURIComponent(searchQuery)}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Extract search results
          const results = parseSearchResults(data);
          resolve(results);
        } catch (error) {
          console.error(`Error parsing results for ${entityName}:`, error.message);
          resolve([]);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error searching for ${entityName}:`, error.message);
      resolve([]);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve([]);
    });

    req.end();
  });
}

function parseSearchResults(html) {
  const results = [];
  
  // Extract text snippets that might contain classification information
  const snippetRegex = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/g;
  const snippetRegex2 = /<a[^>]*rel="nofollow"[^>]*>(.*?)<\/a>/g;
  
  let match;
  while ((match = snippetRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text.length > 0) {
      results.push(text);
    }
  }
  
  return results.slice(0, 5); // Return top 5 results
}

// Classification logic based on search results
function classifyEntityFromResults(name, results, sport) {
  const allText = results.join(' ').toLowerCase();
  
  // Person indicators
  const personIndicators = [
    'born', 'age', 'career', 'former', 'current', 'appointed', 'chief executive', 'ceo', 
    'chairman', 'director', 'manager', 'coach', 'player', 'executive', 'president'
  ];
  
  // Club indicators
  const clubIndicators = [
    'football club', 'fc', 'soccer club', 'team', 'club', 'squad', 'stadium'
  ];
  
  // Organization indicators
  const orgIndicators = [
    'association', 'federation', 'organization', 'committee', 'council', 'authority', 'agency'
  ];
  
  // Count matches
  const personMatches = personIndicators.filter(indicator => allText.includes(indicator)).length;
  const clubMatches = clubIndicators.filter(indicator => allText.includes(indicator)).length;
  const orgMatches = orgIndicators.filter(indicator => allText.includes(indicator)).length;
  
  // Determine classification
  if (personMatches >= 2) {
    return { type: 'Person', confidence: 0.8, reasoning: `Person indicators: ${personMatches} matches` };
  }
  
  if (clubMatches >= 2) {
    return { type: 'Club', confidence: 0.8, reasoning: `Club indicators: ${clubMatches} matches` };
  }
  
  if (orgMatches >= 2) {
    return { type: 'Organization', confidence: 0.8, reasoning: `Organization indicators: ${orgMatches} matches` };
  }
  
  if (personMatches >= 1) {
    return { type: 'Person', confidence: 0.6, reasoning: `Person indicators: ${personMatches} matches` };
  }
  
  if (sport && sport.toLowerCase() !== 'multi-sport') {
    return { type: 'Person', confidence: 0.5, reasoning: `Sports-related person in ${sport}` };
  }
  
  return { type: 'Unknown', confidence: 0.3, reasoning: 'Insufficient search result data' };
}

async function researchAndClassifyEntities() {
  console.log('🔍 Starting web research for unknown entities...');
  
  try {
    // Get unknown entities
    const { data: unknownEntities, error } = await supabase
      .from('cached_entities')
      .select('*')
      .or('properties->>type.eq.Unknown,properties->>type.is.null')
      .limit(50);

    if (error) {
      console.error('❌ Error fetching unknown entities:', error);
      return;
    }

    console.log(`📋 Found ${unknownEntities.length} unknown entities to research`);

    const updates = [];
    
    for (const entity of unknownEntities) {
      const name = entity.properties?.name;
      if (!name || name.trim().length === 0) continue;

      console.log(`🔍 Researching: ${name}`);
      
      const searchResults = await searchEntity(name, entity.properties?.sport || '');
      
      if (searchResults.length > 0) {
        const classification = classifyEntityFromResults(
          name, 
          searchResults, 
          entity.properties?.sport || ''
        );

        if (classification.confidence > 0.5) {
          updates.push({
            id: entity.id,
            name: name,
            classification: classification,
            searchResults: searchResults.slice(0, 3) // Keep top 3 results for reference
          });

          console.log(`✅ ${name}: ${classification.type} (${Math.round(classification.confidence * 100)}% confidence)`);
          console.log(`   Sources: ${searchResults.slice(0, 2).join(' | ')}`);
        } else {
          console.log(`⚠️ ${name}: Unable to classify from search results`);
        }
      } else {
        console.log(`❌ ${name}: No search results found`);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Update database with classifications
    if (updates.length > 0) {
      console.log(`\n💾 Updating ${updates.length} entities in database...`);
      
      for (const update of updates) {
        const { error } = await supabase
          .from('cached_entities')
          .update({
            properties: {
              ...update.id.properties,
              type: update.classification.type,
              classification_confidence: update.classification.confidence,
              classification_reasoning: update.classification.reasoning,
              web_research_sources: update.searchResults,
              classified_at: new Date().toISOString(),
              classification_method: 'web_search'
            }
          })
          .eq('id', update.id);

        if (error) {
          console.error(`❌ Error updating ${update.name}:`, error);
        } else {
          console.log(`✅ Updated: ${update.name}`);
        }
      }
      
      console.log(`🎯 Successfully classified ${updates.length} entities using web research`);
    } else {
      console.log('ℹ️ No entities met confidence threshold for classification');
    }

  } catch (error) {
    console.error('❌ Research process failed:', error);
  }
}

// Run the research
researchAndClassifyEntities().then(() => {
  console.log('🏁 Web research classification completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});