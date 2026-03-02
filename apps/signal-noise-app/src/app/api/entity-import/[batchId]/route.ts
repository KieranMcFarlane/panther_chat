import { NextRequest, NextResponse } from 'next/server'
import { getEntityImportBatchStatus } from '@/lib/entity-import-jobs'

export async function GET(
  _request: NextRequest,
  { params }: { params: { batchId: string } },
) {
  try {
    const status = await getEntityImportBatchStatus(params.batchId)

    if (!status.batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 },
      )
    }

    return NextResponse.json(status)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch batch status' },
      { status: 500 },
    )
  }
}
