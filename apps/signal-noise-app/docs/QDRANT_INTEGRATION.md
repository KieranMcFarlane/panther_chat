# Qdrant Vector Search Integration

This document describes the Qdrant vector search integration added to the Signal Noise App.

## Overview

The app now includes Qdrant vector search functionality in the top-right corner of the header, providing semantic search across all entities (clubs, sportspeople, POIs, tenders, and contacts).

## Features Added

### 1. Vector Search Component
- **Location**: Top-right corner of the app header
- **Functionality**: Semantic search across all entity types
- **UI**: Dropdown search with real-time results
- **Integration**: Connected to Qdrant API endpoint

### 2. New Navigation Pages
- **Sports** (`/sports`): Hierarchical view of divisions → clubs → sportspeople
- **Contacts** (`/contacts`): POI and contact management with scoring
- **Graph** (`/graph`): Network visualization of entity relationships
- **Terminal** (`/terminal`): Advanced querying and enrichment controls
- **Opportunities** (`/opportunities`): High-value opportunities with scoring matrix

### 3. Qdrant API Integration
- **Endpoint**: `/api/vector-search`
- **Configuration**: Uses provided Qdrant credentials
- **Search**: Semantic search with scoring and metadata
- **Fallback**: Mock results for development/testing

## Technical Implementation

### Vector Search Component
```tsx
// src/components/ui/VectorSearch.tsx
- Real-time search with debouncing
- Type-based result categorization
- Score-based result ranking
- Responsive dropdown interface
```

### API Endpoint
```typescript
// src/app/api/vector-search/route.ts
- POST endpoint for search queries
- Qdrant client integration ready
- Mock results for development
- Error handling and validation
```

### Qdrant Utilities
```typescript
// src/lib/qdrant.ts
- Client configuration
- Collection management
- Point operations
- Search functions
```

## Configuration

### Qdrant Settings
```typescript
const QDRANT_CONFIG = {
  url: 'https://fbd5ba7f-7aed-442a-9ac1-0a3f1024bffd.eu-west-2-0.aws.cloud.qdrant.io:6333',
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.psevOgtPfPHKnCb2DUnxFBwIMF_ShCB76voNnCD5qHg',
  collectionName: 'sports_entities'
};
```

## Usage

### Vector Search
1. Click the "Vector Search" button in the top-right header
2. Type your search query (e.g., "Manchester United", "stadium tender")
3. View real-time results with scores and metadata
4. Click on results to navigate to detailed views

### Navigation
- Use the sidebar to navigate between different sections
- Each page provides specialized functionality for its domain
- Consistent UI/UX across all pages

## Entity Types

### Supported Entities
- **Clubs**: Football clubs with revenue, digital presence, and opportunity scores
- **Sportspeople**: Players with influence scores and career statistics
- **POIs**: Persons of Interest with relationship strength and contact info
- **Tenders**: Business opportunities with deadlines and values
- **Contacts**: Centralized contact management with scoring

### Scoring Matrix
Each entity includes:
- **Priority Score**: Goal alignment (40% weight)
- **Trust Score**: Source reliability (20% weight)
- **Influence Score**: Social/network influence (20% weight)
- **POI Score**: Contact relevance (10% weight)
- **Vector Similarity**: Semantic match (10% weight)

**Critical Opportunity Score** = Weighted combination of all scores

## Future Enhancements

### Qdrant Integration
1. **Real Vector Search**: Replace mock API with actual Qdrant client
2. **Embedding Generation**: Create vector embeddings for all entities
3. **Collection Management**: Automated collection creation and maintenance
4. **Real-time Updates**: Sync entity changes with vector database

### Advanced Features
1. **Semantic Clustering**: Group similar entities automatically
2. **Recommendation Engine**: Suggest related opportunities
3. **Trend Analysis**: Track entity changes over time
4. **Alert System**: Notify users of high-priority changes

## Development Notes

### Current State
- Mock data and API responses for development
- UI components fully functional
- Navigation structure complete
- Qdrant integration framework ready

### Next Steps
1. Implement actual Qdrant client calls
2. Create vector embeddings for existing entities
3. Set up automated data synchronization
4. Add real-time search capabilities

### Testing
- All pages build successfully
- Navigation works correctly
- Vector search API responds
- UI components render properly

## Dependencies

### Added Packages
```json
{
  "@qdrant/js-client-rest": "Latest version"
}
```

### Required Environment
- Node.js 18+
- Next.js 14+
- TypeScript 5+
- Tailwind CSS

## Troubleshooting

### Common Issues
1. **Vector Search Not Working**: Check API endpoint and Qdrant credentials
2. **Build Errors**: Ensure all dependencies are installed
3. **Navigation Issues**: Verify page components are properly exported
4. **API Errors**: Check network requests and server logs

### Debug Mode
Enable debug logging in the Qdrant utilities:
```typescript
console.log('Qdrant search:', { config, params });
```

## Support

For issues or questions about the Qdrant integration:
1. Check the browser console for errors
2. Verify API endpoint responses
3. Review Qdrant service status
4. Check network connectivity to Qdrant endpoint





