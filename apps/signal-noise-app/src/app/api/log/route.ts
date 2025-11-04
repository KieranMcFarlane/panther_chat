import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    // Log to server console with prefix to identify client-side logs
    console.log(`🖥️ CLIENT: ${message}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log API error:', error);
    return NextResponse.json({ error: 'Failed to log message' }, { status: 500 });
  }
}