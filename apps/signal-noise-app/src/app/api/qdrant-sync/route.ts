import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { embedBatch, entityToEmbeddingText } from '@/lib/embeddings';

function getQdrantUrlVariants() {
	const urls: string[] = [];
	const u = config.qdrant.url.replace(/\/$/, '');
	urls.push(u);
	if (u.includes(':6333')) urls.push(u.replace(':6333', ''));
	return urls;
}

async function qdrantRequest(path: string, init: RequestInit) {
	for (const base of getQdrantUrlVariants()) {
		try {
			const res = await fetch(`${base}${path}`, init);
			if (res.ok) return res;
		} catch {}
	}
	throw new Error('All Qdrant endpoints failed');
}

async function qdrantUpsert(points: Array<{ id: string; vector: number[]; payload: any }>) {
	const res = await qdrantRequest(`/collections/${config.qdrant.collection}/points`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', 'api-key': config.qdrant.apiKey },
		body: JSON.stringify({ points }),
	});
	return res.json();
}

async function qdrantEnsureCollection(vectorSize: number) {
	const res = await fetch(`${config.qdrant.url}/collections/${config.qdrant.collection}`, {
		headers: { 'api-key': config.qdrant.apiKey },
	});
	if (res.ok) return;
	await qdrantRequest(`/collections/${config.qdrant.collection}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', 'api-key': config.qdrant.apiKey },
		body: JSON.stringify({ vectors: { size: vectorSize, distance: 'Cosine' } }),
	});
}

export async function POST(req: NextRequest) {
	const notes: string[] = [];
	try {
		const body = await req.json().catch(() => ({}));
		const limit: number = Math.min(body.limit ?? 200, 1000);

		if (!process.env.OPENAI_API_KEY) {
			notes.push('missing_openai_api_key');
			return NextResponse.json({ message: 'ok', indexed: 0, notes });
		}

		// Primary source: FastAPI backend sports-entities shape
		const apiRes = await fetch(`${config.api.baseUrl}/sports-entities`, { cache: 'no-store' });
		if (!apiRes.ok) {
			notes.push(`backend_status_${apiRes.status}`);
			return NextResponse.json({ message: 'ok', indexed: 0, notes });
		}
		const data = await apiRes.json();
		const entities: any[] = data?.sports_entities ?? [];
		notes.push(`source_count_${entities.length}`);

		if (!entities.length) {
			return NextResponse.json({ message: 'ok', indexed: 0, notes: [...notes, 'no_entities'] });
		}

		// Map backend items into schema-like payloads and texts
		const selected = entities.slice(0, limit);
		const payloads = selected.map((e, i) => ({
			entity_id: e.id || `sports-${i}`,
			entity_type: 'club',
			name: e.name,
			source: 'backend_sports_entities',
			last_updated: new Date().toISOString(),
			trust_score: 0.5,
			vector_embedding: [],
			priority_score: 0.5,
			notes: '',
			division_id: e.level || '',
			location: `${e.country || ''}`,
			digital_presence_score: 0,
			revenue_estimate: '',
			key_personnel: [],
			opportunity_score: 0,
			linked_tenders: [],
			tags: [e.sport].filter(Boolean),
		}));

		const texts = payloads.map(entityToEmbeddingText);
		const vectors = await embedBatch(texts);
		await qdrantEnsureCollection(vectors[0].length);

		const points = payloads.map((p, i) => ({ id: p.entity_id, vector: vectors[i], payload: p }));
		// Upsert in chunks
		const batchSize = 100;
		for (let i = 0; i < points.length; i += batchSize) {
			await qdrantUpsert(points.slice(i, i + batchSize));
		}

		return NextResponse.json({ message: 'ok', indexed: points.length, notes });
	} catch (e: any) {
		notes.push(`error:${e?.message || 'unknown'}`);
		return NextResponse.json({ message: 'ok', indexed: 0, notes });
	}
}
