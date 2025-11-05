import { NextRequest, NextResponse } from 'next/server';
import { searchEntityEmbeddings } from '@/lib/embeddings';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
	try {
		const { query, limit = 10, score_threshold = 0.2, entity_types } = await request.json();
		if (!query || typeof query !== 'string') {
			console.log('⚠️ Vector search: Empty query');
			return NextResponse.json({ results: [], total: 0, query: '', note: 'empty_query' });
		}

		// If no embedding key, return empty results gracefully with helpful message
		if (!process.env.OPENAI_API_KEY) {
			console.log('⚠️ Vector search: Missing OPENAI_API_KEY');
			return NextResponse.json({ 
				results: [], 
				total: 0, 
				query, 
				note: 'missing_openai_api_key',
				error: 'OPENAI_API_KEY environment variable is not set. Please configure it in your Vercel project settings.'
			});
		}

		// Check for Supabase configuration
		if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
			console.log('⚠️ Vector search: Missing Supabase configuration', {
				hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
				hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
			});
			return NextResponse.json({ 
				results: [], 
				total: 0, 
				query, 
				note: 'missing_supabase_config',
				error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Vercel project settings.',
				config: {
					hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
					hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
				}
			});
		}

		console.log('🔍 Vector search starting:', { query, limit, score_threshold, entity_types });

		// Use Supabase vector search instead of Qdrant
		const results = await searchEntityEmbeddings(query, {
			entityTypes: entity_types,
			matchThreshold: score_threshold,
			matchCount: limit
		});

		console.log(`✅ Vector search found ${results.length} results for "${query}"`);

		// If no results but query was valid, log a warning
		if (results.length === 0) {
			console.warn(`⚠️ No results found for query "${query}". This might mean:`);
			console.warn('   1. No embeddings have been initialized in Supabase');
			console.warn('   2. The match_threshold (0.2) is too high');
			console.warn('   3. The entity_embeddings table is empty');
			console.warn('   Run: npm run vector-search:init to initialize embeddings');
		}

		// Transform results to match expected format
		const transformedResults = results.map((r: any) => ({
			id: String(r.id),
			entity_id: r.entity_id,
			name: r.name,
			type: r.entity_type,
			score: r.similarity,
			metadata: r.metadata || {},
		}));

		return NextResponse.json({ 
			results: transformedResults, 
			total: transformedResults.length, 
			query,
			...(results.length === 0 && { 
				note: 'no_results',
				help: 'No embeddings found. Run npm run vector-search:init to initialize embeddings in Supabase.'
			})
		});
	} catch (error: any) {
		console.error('❌ Vector search error:', error);
		console.error('Error details:', {
			message: error?.message,
			stack: error?.stack,
			name: error?.name
		});
		// Graceful fallback
		return NextResponse.json({ 
			results: [], 
			total: 0, 
			query: '', 
			note: 'internal_error',
			error: error?.message || 'Unknown error'
		});
	}
}

export async function GET() {
	return NextResponse.json({
		message: 'Vector search API endpoint',
		usage: 'POST /api/vector-search { query, limit?, score_threshold? }',
	});
}
