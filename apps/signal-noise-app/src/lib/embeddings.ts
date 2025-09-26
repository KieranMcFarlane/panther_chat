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
