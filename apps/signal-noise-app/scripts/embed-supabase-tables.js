/**
 * Script to initialize vector embeddings for Supabase tables
 * This script can embed any Supabase table data into the vector search system
 */

import { supabase } from '../src/lib/supabase-client.js';
import { storeBatchEntityEmbeddings, storeEntityEmbedding } from '../src/lib/embeddings.js';

// Configuration for different table types
const TABLE_CONFIGS = {
  // Example: Embed sports entities from a Supabase table
  sports_entities: {
    id_field: 'id',
    name_field: 'name',
    type_field: 'entity_type',
    description_field: 'description',
    metadata_fields: ['location', 'division', 'tags', 'revenue', 'digital_presence']
  },
  
  // Example: Embed contacts from a Supabase table
  contacts: {
    id_field: 'id',
    name_field: 'name',
    type_field: 'contact_type', // Will map to 'contact'
    description_field: 'bio',
    metadata_fields: ['email', 'company', 'role', 'phone', 'linkedin_url']
  },
  
  // Example: Embed tenders/opportunities from a Supabase table
  tenders: {
    id_field: 'id',
    name_field: 'title',
    type_field: 'tender_type', // Will map to 'tender'
    description_field: 'description',
    metadata_fields: ['deadline', 'budget', 'requirements', 'location', 'company']
  },
  
  // Example: Embed documents/articles
  documents: {
    id_field: 'id',
    name_field: 'title',
    type_field: 'doc_type', // Will map to 'document'
    description_field: 'content',
    metadata_fields: ['author', 'category', 'tags', 'publish_date', 'url']
  }
};

/**
 * Embed data from any Supabase table
 */
async function embedSupabaseTable(tableName, config = {}) {
  console.log(`🔄 Processing table: ${tableName}`);
  
  try {
    // Fetch all data from the table
    const { data: tableData, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`❌ Error fetching data from ${tableName}:`, error);
      return { processed: 0, failed: 0 };
    }
    
    if (!tableData || tableData.length === 0) {
      console.log(`⚠️  No data found in table: ${tableName}`);
      return { processed: 0, failed: 0 };
    }
    
    console.log(`📊 Found ${tableData.length} records in ${tableName}`);
    
    // Transform table data to embedding format
    const entityInputs = tableData.map(row => {
      const tableConfig = TABLE_CONFIGS[tableName] || config;
      
      return {
        entity_id: row[tableConfig.id_field || 'id'],
        entity_type: mapEntityType(row[tableConfig.type_field || 'type'], tableName),
        name: row[tableConfig.name_field || 'name'] || 'Unknown',
        description: row[tableConfig.description_field || 'description'] || row[tableConfig.name_field || 'name'],
        metadata: extractMetadata(row, tableConfig.metadata_fields || [])
      };
    });
    
    // Store embeddings in batches
    console.log(`🔍 Generating embeddings for ${entityInputs.length} entities...`);
    const result = await storeBatchEntityEmbeddings(entityInputs);
    
    console.log(`✅ Completed ${tableName}: Processed ${result.processed}, Failed ${result.failed}`);
    return result;
    
  } catch (error) {
    console.error(`❌ Error processing table ${tableName}:`, error);
    return { processed: 0, failed: 0 };
  }
}

/**
 * Map table-specific entity types to standard types
 */
function mapEntityType(tableType, tableName) {
  const typeMapping = {
    'club': 'club',
    'team': 'club',
    'sportsperson': 'sportsperson',
    'player': 'sportsperson',
    'athlete': 'sportsperson',
    'coach': 'sportsperson',
    'staff': 'sportsperson',
    'contact': 'contact',
    'person': 'contact',
    'poi': 'poi',
    'tender': 'tender',
    'opportunity': 'tender',
    'rfp': 'tender',
    'document': 'document',
    'article': 'document'
  };
  
  // First try direct mapping
  if (typeMapping[tableType?.toLowerCase()]) {
    return typeMapping[tableType.toLowerCase()];
  }
  
  // Then try table-based defaults
  const tableDefaults = {
    'sports_entities': 'club',
    'contacts': 'contact',
    'tenders': 'tender',
    'documents': 'document'
  };
  
  return tableDefaults[tableName] || 'unknown';
}

/**
 * Extract metadata from table row
 */
function extractMetadata(row, metadataFields) {
  const metadata = {};
  
  metadataFields.forEach(field => {
    if (row[field] !== undefined && row[field] !== null) {
      metadata[field] = row[field];
    }
  });
  
  return metadata;
}

/**
 * Embed multiple tables
 */
async function embedMultipleTables(tables) {
  console.log('🚀 Starting multi-table embedding process...');
  
  const results = {};
  let totalProcessed = 0;
  let totalFailed = 0;
  
  for (const tableName of tables) {
    const result = await embedSupabaseTable(tableName);
    results[tableName] = result;
    totalProcessed += result.processed;
    totalFailed += result.failed;
    
    // Add delay between tables to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 Summary:');
  console.log(`Total Processed: ${totalProcessed}`);
  console.log(`Total Failed: ${totalFailed}`);
  
  Object.entries(results).forEach(([table, result]) => {
    console.log(`  ${table}: ${result.processed} processed, ${result.failed} failed`);
  });
  
  return results;
}

/**
 * List all tables in your Supabase database
 */
async function listSupabaseTables() {
  try {
    const { data, error } = await supabase
      .rpc('get_tables'); // You'd need to create this function
    
    if (error) {
      console.log('⚠️  Could not auto-detect tables. Please specify tables manually.');
      console.log('Available table configs:', Object.keys(TABLE_CONFIGS));
      return Object.keys(TABLE_CONFIGS);
    }
    
    return data || [];
  } catch (error) {
    console.log('⚠️  Please specify which tables to embed manually.');
    console.log('Example tables:', Object.keys(TABLE_CONFIGS));
    return Object.keys(TABLE_CONFIGS);
  }
}

// Main execution function
async function main() {
  console.log('🔍 Supabase Table Embedding Tool');
  console.log('================================');
  
  // Get tables from command line arguments or use defaults
  const args = process.argv.slice(2);
  let tablesToProcess = [];
  
  if (args.length > 0) {
    tablesToProcess = args;
  } else {
    // Try to auto-detect or use defaults
    tablesToProcess = await listSupabaseTables();
  }
  
  console.log(`Tables to process: ${tablesToProcess.join(', ')}`);
  console.log('');
  
  if (tablesToProcess.length === 0) {
    console.log('❌ No tables specified. Usage:');
    console.log('  node scripts/embed-supabase-tables.js table1 table2 table3');
    console.log('  node scripts/embed-supabase-tables.js sports_entities contacts');
    process.exit(1);
  }
  
  // Process the tables
  const results = await embedMultipleTables(tablesToProcess);
  
  // Test the search functionality
  console.log('\n🧪 Testing vector search...');
  try {
    const testResponse = await fetch('http://localhost:3005/api/vector-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: 'football club', 
        limit: 5,
        score_threshold: 0.1 
      }),
    });
    
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log(`✅ Search test successful! Found ${testData.results?.length || 0} results`);
    } else {
      console.log('⚠️  Search test failed - make sure dev server is running');
    }
  } catch (error) {
    console.log('⚠️  Could not test search - dev server may not be running');
  }
  
  console.log('\n🎉 Embedding process complete!');
}

// Export functions for use in other scripts
export { 
  embedSupabaseTable, 
  embedMultipleTables, 
  TABLE_CONFIGS,
  main as embedSupabaseTables 
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}