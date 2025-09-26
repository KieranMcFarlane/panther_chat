import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { embedText } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
	try {
		const { query, limit = 10, score_threshold = 0.2 } = await request.json();
		if (!query || typeof query !== 'string') {
			return NextResponse.json({ results: [], total: 0, query: '', note: 'empty_query' });
		}

		// If no embedding key, return empty results gracefully
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json({ results: [], total: 0, query, note: 'missing_openai_api_key' });
		}

		const vector = await embedText(query);
		const res = await fetch(`${config.qdrant.url}/collections/${config.qdrant.collection}/points/search`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'api-key': config.qdrant.apiKey,
			},
			body: JSON.stringify({ vector, limit, score_threshold, with_payload: true }),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => '');
			return NextResponse.json({ results: [], total: 0, query, note: `qdrant_error:${res.status}`, details: text });
		}
		const data = await res.json().catch(() => ({ result: [] }));
		const results = (data.result || []).map((r: any) => {
			const payload = r.payload || {};
			return {
				id: String(r.id),
				name: payload.title || payload.name || String(r.id),
				type: payload.entity_type || 'unknown',
				score: r.score,
				metadata: payload,
			};
		});

		return NextResponse.json({ results, total: results.length, query });
	} catch (error: any) {
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
