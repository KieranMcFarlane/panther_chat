import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Generate a simple embedding for demo purposes
    // In production, you would use a proper embedding service like OpenAI's embeddings API
    const embedding = Array.from({ length: 1536 }, () => Math.random())

    return NextResponse.json({
      embedding
    })
  } catch (error) {
    console.error('Embedding generation error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Embedding generation failed'
      },
      { status: 500 }
    )
  }
}