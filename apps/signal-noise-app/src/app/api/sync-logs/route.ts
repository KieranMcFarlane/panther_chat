import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'cron'; // 'cron' or 'daily'
    const lines = parseInt(searchParams.get('lines') || '100');

    let logPath: string;
    
    if (type === 'cron') {
      logPath = join(process.cwd(), 'logs', 'smart-rfp-cron.log');
    } else if (type === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      logPath = join(process.cwd(), 'logs', `smart-sync-${today}.log`);
    } else {
      return NextResponse.json({ error: 'Invalid log type' }, { status: 400 });
    }

    try {
      const logContent = await readFile(logPath, 'utf8');
      const logLines = logContent.split('\n');
      const recentLines = logLines.slice(-lines);
      
      return NextResponse.json({
        content: recentLines.join('\n'),
        totalLines: logLines.length,
        requestedLines: recentLines.length,
        logPath,
        type
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return NextResponse.json({
          content: 'Log file does not exist yet.',
          totalLines: 0,
          requestedLines: 0,
          logPath,
          type
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading logs:', error);
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'list':
        try {
          const logsDir = join(process.cwd(), 'logs');
          const files = await readdir(logsDir);
          const logFiles = files
            .filter(file => file.startsWith('smart-sync-') || file === 'smart-rfp-cron.log')
            .map(file => ({
              name: file,
              type: file === 'smart-rfp-cron.log' ? 'cron' : 'daily',
              path: join(logsDir, file)
            }))
            .sort((a, b) => b.name.localeCompare(a.name));

          return NextResponse.json({ files: logFiles });
        } catch (error) {
          return NextResponse.json({ files: [] }, { status: 200 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling log request:', error);
    return NextResponse.json({ error: 'Failed to handle log request' }, { status: 500 });
  }
}