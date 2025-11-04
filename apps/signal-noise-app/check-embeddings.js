const https = require('https');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

console.log('🔍 Checking existing embeddings...');

async function checkExistingEmbeddings() {
  try {
    // Check if entity_embeddings table has any data
    const response = await fetch(`${supabaseUrl}/rest/v1/entity_embeddings?select=entity_type&limit=10`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Found ${data.length} entity types with embeddings:`);
      
      if (data.length === 0) {
        console.log('❌ No existing embeddings found');
        console.log('💡 Need to embed cached entities first');
      } else {
        console.log('✅ Existing embeddings found:');
        data.forEach(item => {
          console.log(`  - ${item.entity_type}: ${item.count} entities`);
        });
      }
    } else {
      console.error('❌ Error checking embeddings:', response.statusText);
    }

    // Check cached entities count
    console.log('\n🔍 Checking cached entities...');
    const cachedResponse = await fetch(`${supabaseUrl}/rest/v1/cached_entities?select=id,count(*)`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (cachedResponse.ok) {
      const cachedData = await cachedResponse.json();
      console.log(`📊 Found ${cachedData.length} cached entities`);
      
      if (cachedData.length > 0) {
        console.log('💡 Ready to embed cached entities!');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkExistingEmbeddings().then(() => {
  console.log('\n🏁 Check finished');
  process.exit(0);
}).catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});