import { NextRequest, NextResponse } from 'next/server'

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    
    if (!process.env.OPENAI_API_KEY) {
      // Return a dummy embedding for demo purposes
      const dummyEmbedding = Array(1536).fill(0).map(() => Math.random())
      return NextResponse.json({
        embedding: dummyEmbedding,
        model: 'dummy-model',
        usage: { prompt_tokens: 0, total_tokens: 0 }
      })
    }
    
    // Lazy-load OpenAI client only when needed (not during build)
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    })
    
    return NextResponse.json({
      embedding: embedding.data[0].embedding,
      model: embedding.model || "text-embedding-3-small",
      usage: embedding.usage
    })
  } catch (error) {
    console.error('❌ Embedding generation failed:', error)
    
    // Return a dummy embedding for demo purposes
    const dummyEmbedding = Array(1536).fill(0).map(() => Math.random())
    return NextResponse.json({
      embedding: dummyEmbedding,
      model: 'fallback-dummy',
      usage: { prompt_tokens: 0, total_tokens: 0 },
      error: 'Failed to generate real embedding'
    })
  }
}