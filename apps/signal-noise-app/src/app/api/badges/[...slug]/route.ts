import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug.join('/')
  console.log(`🏷️ Badge API: Requesting badge for slug: ${slug}`)
  
  const s3Url = `https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/${slug}`
  console.log(`🏷️ Badge API: Trying S3 URL: ${s3Url}`)

  try {
    const response = await fetch(s3Url)
    console.log(`🏷️ Badge API: S3 response status: ${response.status}`)
    
    if (!response.ok) {
      console.log(`🏷️ Badge API: Badge not found in S3, returning fallback`)
      
      // Return a fallback badge SVG
      const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
        <rect width="64" height="64" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
        <circle cx="32" cy="24" r="8" fill="#666"/>
        <rect x="20" y="36" width="24" height="16" rx="4" fill="#666"/>
        <text x="32" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#999">NO BADGE</text>
      </svg>`
      
      return new NextResponse(fallbackSvg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const imageBuffer = await response.arrayBuffer()
    
    // Get content type from response or default to image/png
    const contentType = response.headers.get('content-type') || 'image/png'
    
    // Return the image with proper caching headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Error fetching badge from S3:', error)
    return NextResponse.json(
      { error: 'Failed to fetch badge' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}