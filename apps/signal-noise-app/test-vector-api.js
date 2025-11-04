console.log('🔍 Testing existing vector search API...');

async function testVectorSearchAPI() {
  try {
    // Test the working vector search API
    const response = await fetch('http://localhost:3005/api/vector-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'football',
        limit: 10,
        score_threshold: 0.2,
        entity_types: ['club', 'sportsperson', 'poi', 'tender', 'contact']
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Vector search API is working!');
      console.log(`📊 Found ${data.results?.length || 0} results for "football":`);
      
      if (data.results && data.results.length > 0) {
        data.results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.name} (${result.type}) - ${Math.round((result.score || 0) * 100)}% match`);
        });
      } else {
        console.log('  No results found - but API is working');
      }
    } else {
      console.error('❌ Vector search API failed:', response.status, response.statusText);
    }

    // Test a few more searches
    const testQueries = ['Arsenal', 'Chelsea', 'Premier League', 'Olympics'];
    
    for (const query of testQueries) {
      console.log(`\n🔍 Searching for "${query}"...`);
      
      const searchResponse = await fetch('http://localhost:3005/api/vector-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          limit: 5,
          score_threshold: 0.1,
          entity_types: ['club', 'sportsperson', 'poi', 'tender', 'contact']
        })
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          console.log(`  ✅ Found ${searchData.results.length} results:`);
          searchData.results.forEach((result, index) => {
            console.log(`    ${index + 1}. ${result.name} (${result.type}) - ${Math.round((result.score || 0) * 100)}% match`);
          });
        } else {
          console.log(`  ❌ No results found for "${query}"`);
        }
      } else {
        console.log(`  ❌ Search failed for "${query}"`);
      }
    }

  } catch (error) {
    console.error('❌ Error testing vector search:', error.message);
  }
}

// Run the test
testVectorSearchAPI().then(() => {
  console.log('\n🏁 Vector search test finished');
  process.exit(0);
}).catch(error => {
  console.error('❌ Vector search test failed:', error);
  process.exit(1);
});