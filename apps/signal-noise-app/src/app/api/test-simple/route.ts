import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  // Simple test endpoint that returns stored results
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/rfp-intelligence/store`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}