import { NextRequest, NextResponse } from 'next/server'
import { entityClassificationService } from '@/services/EntityClassificationService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchSize = 50 } = body

    console.log('🚀 Starting entity classification process...')
    
    // Run classification
    await entityClassificationService.classifyUnknownEntities(batchSize)
    
    // Generate report
    const report = await entityClassificationService.generateClassificationReport()
    
    return NextResponse.json({
      success: true,
      message: 'Entity classification completed',
      report,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Classification failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Classification process failed' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const report = await entityClassificationService.generateClassificationReport()
    
    return NextResponse.json({
      report,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to generate classification report:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate report' 
      },
      { status: 500 }
    )
  }
}