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
      return NextResponse.json(
        {
          error: 'OPENAI_API_KEY is not configured for embedding generation'
        },
        { status: 503 }
      )
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

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate embedding'
      },
      { status: 503 }
    )
  }
}
