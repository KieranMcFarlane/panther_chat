export async function embedTextOpenAI(text: string): Promise<number[]> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error('OPENAI_API_KEY not set');
	const { OpenAI } = await import('openai');
	const openai = new OpenAI({ apiKey });
	const res = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: text,
	});
	return res.data[0].embedding as unknown as number[];
}

export async function embedBatchOpenAI(texts: string[]): Promise<number[][]> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error('OPENAI_API_KEY not set');
	const { OpenAI } = await import('openai');
	const openai = new OpenAI({ apiKey });
	const res = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: texts,
	});
	return res.data.map((d: any) => d.embedding as number[]);
}

export async function embedText(text: string): Promise<number[]> {
	return embedTextOpenAI(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
	return embedBatchOpenAI(texts);
}

export function entityToEmbeddingText(entity: any): string {
	const parts: string[] = [];
	if (entity.entity_type === 'club') {
		parts.push(`Club: ${entity.name}`);
		if (entity.location) parts.push(`Location: ${entity.location}`);
		if (entity.tags?.length) parts.push(`Tags: ${entity.tags.join(', ')}`);
		if (entity.notes) parts.push(`Notes: ${entity.notes}`);
	}
	if (entity.entity_type === 'sportsperson') {
		parts.push(`Sportsperson: ${entity.name}`);
		if (entity.role) parts.push(`Role: ${entity.role}`);
		if (entity.club_id) parts.push(`Club ID: ${entity.club_id}`);
		if (entity.tags?.length) parts.push(`Tags: ${entity.tags.join(', ')}`);
	}
	if (entity.entity_type === 'poi' || entity.entity_type === 'contact') {
		parts.push(`Contact: ${entity.name}`);
		if (entity.role) parts.push(`Role: ${entity.role}`);
		if (entity.affiliation) parts.push(`Affiliation: ${entity.affiliation}`);
		if (entity.tags?.length) parts.push(`Tags: ${entity.tags.join(', ')}`);
	}
	if (entity.entity_type === 'tender') {
		parts.push(`Tender: ${entity.title || entity.name}`);
		if (entity.associated_club_id) parts.push(`Club ID: ${entity.associated_club_id}`);
		if (entity.deadline) parts.push(`Deadline: ${entity.deadline}`);
		if (entity.tags?.length) parts.push(`Tags: ${entity.tags.join(', ')}`);
	}
	return parts.join(' | ');
}

// Supabase vector search integration
import { supabase } from '@/lib/supabase-client';

export interface EntityEmbeddingInput {
	entity_id: string;
	entity_type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'contact';
	name: string;
	description?: string;
	metadata?: Record<string, any>;
}

/**
 * Store entity embedding in Supabase
 */
export async function storeEntityEmbedding(
	entity: EntityEmbeddingInput,
	embedding?: number[]
): Promise<void> {
	try {
		// Generate embedding if not provided
		const entityEmbedding = embedding || await embedText(entityToEmbeddingText(entity));

		const { error } = await supabase.rpc('upsert_entity_embedding', {
			p_entity_id: entity.entity_id,
			p_entity_type: entity.entity_type,
			p_name: entity.name,
			p_embedding: entityEmbedding,
			p_description: entity.description || null,
			p_metadata: entity.metadata || {}
		});

		if (error) {
			console.error('Error storing entity embedding:', error);
			throw error;
		}
	} catch (error) {
		console.error('Failed to store entity embedding:', error);
		throw error;
	}
}

/**
 * Perform vector search for entities using Supabase
 */
export async function searchEntityEmbeddings(
	query: string,
	options: {
		entityTypes?: string[];
		matchThreshold?: number;
		matchCount?: number;
	} = {}
): Promise<Array<{
	id: number;
	entity_id: string;
	entity_type: string;
	name: string;
	description: string | null;
	metadata: Record<string, any>;
	similarity: number;
}>> {
	try {
		const queryEmbedding = await embedText(query);

		const { data, error } = await supabase.rpc('match_entities', {
			query_embedding: queryEmbedding,
			entity_types: options.entityTypes || null,
			match_threshold: options.matchThreshold || 0.2,
			match_count: options.matchCount || 10
		});

		if (error) {
			console.error('Error searching entity embeddings:', error);
			throw error;
		}

		return data || [];
	} catch (error) {
		console.error('Failed to search entity embeddings:', error);
		throw error;
	}
}

/**
 * Batch store entity embeddings
 */
export async function storeBatchEntityEmbeddings(
	entities: EntityEmbeddingInput[]
): Promise<void> {
	const texts = entities.map(entityToEmbeddingText);
	const embeddings = await embedBatch(texts);

	for (let i = 0; i < entities.length; i++) {
		try {
			await storeEntityEmbedding(entities[i], embeddings[i]);
		} catch (error) {
			console.error(`Failed to store embedding for entity ${entities[i].entity_id}:`, error);
		}
	}
}

/**
 * Initialize vector search for existing entities
 */
export async function initializeEntityEmbeddings(
	entities: EntityEmbeddingInput[]
): Promise<{ processed: number; failed: number }> {
	let processed = 0;
	let failed = 0;

	console.log(`Initializing embeddings for ${entities.length} entities...`);

	// Process in batches of 50
	const batchSize = 50;
	for (let i = 0; i < entities.length; i += batchSize) {
		const batch = entities.slice(i, i + batchSize);
		
		try {
			await storeBatchEntityEmbeddings(batch);
			processed += batch.length;
			console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entities.length / batchSize)} (${processed}/${entities.length})`);
		} catch (error) {
			console.error(`Failed to process batch ${Math.floor(i / batchSize) + 1}:`, error);
			failed += batch.length;
		}

		// Add delay between batches to avoid rate limits
		if (i + batchSize < entities.length) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}

	console.log(`Embedding initialization complete. Processed: ${processed}, Failed: ${failed}`);
	return { processed, failed };
}
