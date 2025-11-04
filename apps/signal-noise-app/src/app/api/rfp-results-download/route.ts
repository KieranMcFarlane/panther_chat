import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // This would typically pull from a database or session storage
    // For now, we'll return a template response
    
    const timestamp = new Date().toISOString();
    const filename = `rfp-analysis-results-${timestamp.split('T')[0]}.json`;
    
    const results = {
      rfp_analysis_session: {
        timestamp,
        download_generated_at: timestamp,
        message: "This is a template. In production, this would contain the actual RFP results from the analysis.",
        note: "To capture actual results, use the SSE stream and parse the RFP data in real-time."
      }
    };
    
    // Return the file as a download
    return new NextResponse(JSON.stringify(results, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate results file' },
      { status: 500 }
    );
  }
}