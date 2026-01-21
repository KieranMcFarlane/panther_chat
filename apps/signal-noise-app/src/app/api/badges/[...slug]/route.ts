import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { join } from 'path'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug.join('/')
  console.log(`🏷️ Badge API: Requesting badge for slug: ${slug}`)
  
  // First try local file system (since S3 upload failed in our workflow)
  const localPath = join(process.cwd(), 'public', 'badges', slug)
  console.log(`🏷️ Badge API: Checking local file: ${localPath}`)
  
  try {
    // Check if local file exists
    await access(localPath)
    console.log(`🏷️ Badge API: Found local file, serving from disk`)
    
    const imageBuffer = await readFile(localPath)
    const extension = slug.toLowerCase().split('.').pop()
    const contentType = extension === 'png' ? 'image/png' : 
                        extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 
                        extension === 'svg' ? 'image/svg+xml' : 'image/png'
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (localError) {
    console.log(`🏷️ Badge API: Local file not found, trying S3 for ${slug}`)

    try {
      // Use AWS SDK to fetch from S3 (handles private objects)
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'eu-north-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        }
      })

      const bucketName = process.env.S3_BUCKET || 'sportsintelligence'
      const key = `badges/${slug}`
      
      console.log(`🏷️ Badge API: Fetching from S3 bucket: ${bucketName}, key: ${key}`)
      
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })

      const response = await s3Client.send(command)
      
      if (!response.Body) {
        throw new Error('Empty response body from S3')
      }

      // Convert stream to buffer
      const byteArray = await response.Body.transformToByteArray()
      const imageBuffer = Buffer.from(byteArray)
      
      // Get content type from response or default to image/png
      const contentType = response.ContentType || 'image/png'
      
      console.log(`🏷️ Badge API: Successfully fetched from S3, size: ${imageBuffer.length}`)

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
    } catch (s3Error: any) {
      console.error('Error fetching badge from S3:', s3Error.message)

      // If S3 fails (e.g. 404), return 404 status to let Next.js handle fallback
      console.log(`🏷️ Badge API: Badge not found in S3 or error occurred, returning 404`)

      return new NextResponse('Badge not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
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
