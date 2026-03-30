# Vector Search Migration: Qdrant → Supabase + OpenAI

This document outlines the migration from Qdrant to Supabase with pgvector for your vector search functionality.

## Overview

The vector search system has been successfully migrated to use:
- **Supabase** with pgvector extension for vector storage
- **OpenAI** embeddings for vector generation
- **Next.js API** routes for search functionality

## What's Been Changed

### 1. Database Schema (`lib/supabase-vector-schema.sql`)
- ✅ Added pgvector extension
- ✅ Created `entity_embeddings` table for sports entities
- ✅ Created `documents` table for general document search
- ✅ Added vector similarity search functions
- ✅ Added indexes for performance optimization

### 2. Embeddings Utility (`src/lib/embeddings.ts`)
- ✅ Added Supabase integration functions
- ✅ Enhanced batch processing capabilities
- ✅ Added entity embedding initialization
- ✅ Maintained existing OpenAI compatibility

### 3. API Route (`src/app/api/vector-search/route.ts`)
- ✅ Replaced Qdrant calls with Supabase RPC functions
- ✅ Maintained same response format for frontend compatibility
- ✅ Added entity type filtering
- ✅ Improved error handling

### 4. Frontend Component (`src/components/ui/VectorSearch.tsx`)
- ✅ Updated to work with new API structure
- ✅ Added entity_id navigation
- ✅ Enhanced result display
- ✅ Maintained existing UI/UX

## Setup Instructions

### 1. Environment Variables
Ensure these are set in your `.env` file:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
```

### 2. Database Setup
Run the SQL schema in your Supabase dashboard:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `lib/supabase-vector-schema.sql`
3. Click **Run** to execute

Or use the setup script:
```bash
npm run vector-search:setup
```

### 3. Initialize Embeddings
After setting up the database schema, initialize embeddings for existing entities:

```bash
npm run vector-search:init
```

This will:
- Fetch all entities from your Neo4j database
- Generate embeddings using OpenAI
- Store them in Supabase
- Test the vector search functionality

## Usage Examples

### Basic Entity Search
```typescript
import { searchEntityEmbeddings } from '@/lib/embeddings';

// Search for football clubs
const results = await searchEntityEmbeddings('football clubs in London', {
  entityTypes: ['club'],
  matchThreshold: 0.3,
  matchCount: 10
});

// Search across all entity types
const allResults = await searchEntityEmbeddings('sports marketing opportunities');
```

### Store New Entity Embedding
```typescript
import { storeEntityEmbedding } from '@/lib/embeddings';

await storeEntityEmbedding({
  entity_id: 'club_123',
  entity_type: 'club',
  name: 'Arsenal FC',
  description: 'Professional football club in London',
  metadata: {
    location: 'London, England',
    division: 'Premier League',
    tags: ['football', 'premier league', 'london']
  }
});
```

### Batch Initialize Embeddings
```typescript
import { initializeEntityEmbeddings } from '@/lib/embeddings';

const entities = [
  {
    entity_id: 'club_1',
    entity_type: 'club',
    name: 'Chelsea FC',
    metadata: { location: 'London' }
  },
  // ... more entities
];

const result = await initializeEntityEmbeddings(entities);
console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
```

## API Endpoint

### POST /api/vector-search
Search entities using vector similarity.

**Request Body:**
```json
{
  "query": "football clubs in London",
  "limit": 10,
  "score_threshold": 0.2,
  "entity_types": ["club", "sportsperson"]
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "123",
      "entity_id": "club_123",
      "name": "Arsenal FC",
      "type": "club",
      "score": 0.89,
      "metadata": { "location": "London", "division": "Premier League" }
    }
  ],
  "total": 1,
  "query": "football clubs in London"
}
```

## Performance Benefits

### vs Qdrant
- ✅ **Integrated with existing Supabase setup**
- ✅ **No additional service dependencies**
- ✅ **Better SQL integration for complex queries**
- ✅ **Cost-effective (uses existing Supabase plan)**
- ✅ **Simplified deployment and maintenance**

### Search Performance
- **Indexed vector search** with ivfflat indexes
- **Configurable similarity thresholds**
- **Batch processing for bulk operations**
- **Result caching through Supabase**

## Troubleshooting

### Common Issues

1. **Missing pgvector extension**
   ```
   Error: extension "vector" does not exist
   ```
   **Solution**: Ensure the SQL schema was executed in your Supabase dashboard

2. **OpenAI API errors**
   ```
   Error: OPENAI_API_KEY not set
   ```
   **Solution**: Set the OPENAI_API_KEY environment variable

3. **No search results**
   ```
   Results: []
   ```
   **Solution**: Run the embedding initialization script to populate the database

4. **Connection errors**
   ```
   Error: Supabase connection failed
   ```
   **Solution**: Verify Supabase URL and keys are correct

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=vector-search npm run dev
```

## Migration Checklist

- [x] Database schema created
- [x] Embeddings utility updated
- [x] API route migrated
- [x] Frontend component updated
- [x] Setup scripts created
- [x] Documentation provided
- [ ] Execute SQL schema in Supabase dashboard
- [ ] Run embedding initialization
- [ ] Test search functionality
- [ ] Remove Qdrant dependencies (optional)

## Next Steps

1. **Execute Setup**: Run `npm run vector-search:setup`
2. **Initialize Data**: Run `npm run vector-search:init`
3. **Test Functionality**: Use the VectorSearch component in your app
4. **Monitor Performance**: Check search speed and result quality
5. **Optimize**: Adjust similarity thresholds and batch sizes as needed

## Files Modified/Created

### New Files
- `lib/supabase-vector-schema.sql` - Database schema
- `scripts/setup-vector-search.sh` - Setup automation
- `scripts/initialize-embeddings.js` - Data initialization

### Modified Files
- `src/lib/embeddings.ts` - Added Supabase functions
- `src/app/api/vector-search/route.ts` - Migrated to Supabase
- `src/components/ui/VectorSearch.tsx` - Enhanced UI integration
- `package.json` - Added new scripts

## Support

For issues with:
- **Database setup**: Check Supabase dashboard SQL Editor
- **API errors**: Check environment variables and logs
- **Search quality**: Adjust similarity thresholds and entity descriptions
- **Performance**: Monitor Supabase query performance and indexing

The migration maintains full backward compatibility for the frontend while providing a more integrated and maintainable backend solution.