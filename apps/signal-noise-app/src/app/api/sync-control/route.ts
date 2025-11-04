import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Sync system state (in-memory, would use Redis in production)
let syncState = {
  isRunning: false,
  isPaused: false,
  lastRun: null,
  currentProgress: 0,
  totalEntities: 0,
  status: 'idle' as 'idle' | 'running' | 'paused' | 'stopped'
};

export async function GET() {
  try {
    // Read sync state from file if it exists
    const fs = require('fs');
    const path = require('path');
    
    if (fs.existsSync('.cache/sync-state.json')) {
      const fileState = JSON.parse(fs.readFileSync('.cache/sync-state.json', 'utf8'));
      syncState.lastRun = fileState.lastSync;
      syncState.totalEntities = fileState.stats?.totalProcessed || 0;
    }

    // Check if process is currently running
    try {
      const { stdout } = await execAsync('ps aux | grep "smart-rfp-sync.js" | grep -v grep');
      syncState.isRunning = stdout.trim().length > 0;
      syncState.status = syncState.isRunning ? 'running' : 'idle';
    } catch {
      syncState.isRunning = false;
      syncState.status = 'idle';
    }

    return NextResponse.json(syncState);
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, limit, forceFull } = await request.json();

    switch (action) {
      case 'start':
        if (syncState.isRunning) {
          return NextResponse.json({ error: 'Sync is already running' }, { status: 400 });
        }
        
        const cmd = `/opt/homebrew/bin/node scripts/smart-rfp-sync.js${forceFull ? ' --force-full' : ''}${limit ? ` --limit=${limit}` : ''}`;
        
        // Start the sync process in background
        execAsync(cmd, { timeout: 300000 }).catch(error => {
          console.error('Sync process error:', error);
          syncState.isRunning = false;
          syncState.status = 'stopped';
        });

        syncState.isRunning = true;
        syncState.isPaused = false;
        syncState.status = 'running';
        syncState.lastRun = new Date().toISOString();

        return NextResponse.json({ 
          message: 'Sync started successfully', 
          command: cmd,
          state: syncState 
        });

      case 'stop':
        try {
          await execAsync('pkill -f "smart-rfp-sync.js"');
          syncState.isRunning = false;
          syncState.isPaused = false;
          syncState.status = 'stopped';
          return NextResponse.json({ message: 'Sync stopped successfully' });
        } catch (error) {
          return NextResponse.json({ error: 'Failed to stop sync' }, { status: 500 });
        }

      case 'pause':
        if (!syncState.isRunning) {
          return NextResponse.json({ error: 'Sync is not running' }, { status: 400 });
        }
        // Pause by sending SIGSTOP
        try {
          await execAsync('pkill -STOP -f "smart-rfp-sync.js"');
          syncState.isPaused = true;
          syncState.status = 'paused';
          return NextResponse.json({ message: 'Sync paused successfully' });
        } catch (error) {
          return NextResponse.json({ error: 'Failed to pause sync' }, { status: 500 });
        }

      case 'resume':
        if (!syncState.isPaused) {
          return NextResponse.json({ error: 'Sync is not paused' }, { status: 400 });
        }
        // Resume by sending SIGCONT
        try {
          await execAsync('pkill -CONT -f "smart-rfp-sync.js"');
          syncState.isPaused = false;
          syncState.status = 'running';
          return NextResponse.json({ message: 'Sync resumed successfully' });
        } catch (error) {
          return NextResponse.json({ error: 'Failed to resume sync' }, { status: 500 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error controlling sync:', error);
    return NextResponse.json({ error: 'Failed to control sync' }, { status: 500 });
  }
}