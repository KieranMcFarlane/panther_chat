import { NextRequest, NextResponse } from 'next/server';
import { searchEntityEmbeddings } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
	try {
		const { query, limit = 10, score_threshold = 0.2, entity_types } = await request.json();
		if (!query || typeof query !== 'string') {
			return NextResponse.json({ results: [], total: 0, query: '', note: 'empty_query' });
		}

		// If no embedding key, return empty results gracefully
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json({ results: [], total: 0, query, note: 'missing_openai_api_key' });
		}

		// Use Supabase vector search instead of Qdrant
		const results = await searchEntityEmbeddings(query, {
			entityTypes: entity_types,
			matchThreshold: score_threshold,
			matchCount: limit
		});

		// Transform results to match expected format
		const transformedResults = results.map((r: any) => ({
			id: String(r.id),
			entity_id: r.entity_id,
			name: r.name,
			type: r.entity_type,
			score: r.similarity,
			metadata: r.metadata || {},
		}));

		return NextResponse.json({ results: transformedResults, total: transformedResults.length, query });
	} catch (error: any) {
		console.error('Vector search error:', error);
		// Graceful fallback
		return NextResponse.json({ results: [], total: 0, query: '', note: 'internal_error' });
	}
}

export async function GET() {
	return NextResponse.json({
		message: 'Vector search API endpoint',
		usage: 'POST /api/vector-search { query, limit?, score_threshold? }',
	});
}
