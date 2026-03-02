import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    
    // Security check - only allow .md files
    if (!filename.endsWith('.md')) {
      return NextResponse.json(
        { error: 'Only .md files are allowed' },
        { status: 400 }
      );
    }
    
    // Security check - prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    const logFilePath = path.join(process.cwd(), 'RUN_LOGS', filename);
    
    if (!fs.existsSync(logFilePath)) {
      return NextResponse.json(
        { error: 'Log file not found' },
        { status: 404 }
      );
    }
    
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    
    return new NextResponse(logContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Error serving log file:', error);
    return NextResponse.json(
      { error: 'Failed to serve log file' },
      { status: 500 }
    );
  }
}