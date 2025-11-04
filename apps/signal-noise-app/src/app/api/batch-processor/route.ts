import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Check if batch processor exists
    const processorPath = path.join(process.cwd(), 'scripts/batch-processor.js');
    const { existsSync } = require('fs');
    
    return NextResponse.json({
      status: 'ready',
      processorExists: existsSync(processorPath),
      message: 'Batch processor is ready for manual triggering'
    });
  } catch (error) {
    console.error('Error checking batch processor status:', error);
    return NextResponse.json({ 
      error: 'Failed to check batch processor status' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, options = {} } = await request.json();
    
    switch (action) {
      case 'run':
        return await runBatchProcessor(options);
        
      case 'status':
        return await getBatchStatus();
        
      case 'logs':
        return await getBatchLogs(options);
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Batch processor error:', error);
    return NextResponse.json({ 
      error: 'Batch processor failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function runBatchProcessor(options: any) {
  try {
    const { sync = false, analyze = false, limit = 5 } = options;
    
    // Build command
    const scriptPath = path.join(process.cwd(), 'scripts/batch-processor.js');
    let command = `node "${scriptPath}"`;
    
    if (sync) command += ' --sync';
    if (analyze) command += ' --analyze';
    command += ` --limit=${limit}`;
    
    console.log(`🚀 Starting batch processor: ${command}`);
    
    // Execute with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minutes
      cwd: process.cwd()
    });
    
    // Parse output for summary
    const lines = stdout.split('\n');
    const summary = parseBatchOutput(lines);
    
    return NextResponse.json({
      success: true,
      command,
      stdout,
      stderr,
      summary,
      completedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Batch processor execution error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      signal: error.signal,
      code: error.code
    }, { status: 500 });
  }
}

function parseBatchOutput(lines: string[]) {
  const summary: any = {
    totalEntities: 0,
    totalOpportunities: 0,
    estimatedValue: 0,
    entities: []
  };
  
  // Extract key metrics from output
  lines.forEach(line => {
    // Extract entity count
    const entityMatch = line.match(/📊 Total Entities Processed: (\d+)/);
    if (entityMatch) summary.totalEntities = parseInt(entityMatch[1]);
    
    // Extract opportunities
    const oppMatch = line.match(/💰 Total Opportunities Identified: (\d+)/);
    if (oppMatch) summary.totalOpportunities = parseInt(oppMatch[1]);
    
    // Extract value
    const valueMatch = line.match(/💷 Estimated Portfolio Value: £([\d.]+)M/);
    if (valueMatch) summary.estimatedValue = parseFloat(valueMatch[1]);
    
    // Extract individual entities
    const entityNameMatch = line.match(/📋 Entity \d+:\s*\n\s*🏷️\s*Name: (.+)/);
    if (entityNameMatch) {
      summary.entities.push(entityNameMatch[1]);
    }
  });
  
  return summary;
}

async function getBatchStatus() {
  try {
    const cacheFile = path.join(process.cwd(), '.cache/entity-cache.json');
    const { existsSync, readFileSync } = require('fs');
    
    let cacheInfo = null;
    if (existsSync(cacheFile)) {
      const cacheData = JSON.parse(readFileSync(cacheFile, 'utf8'));
      cacheInfo = {
        exists: true,
        entityCount: cacheData.length,
        lastUpdated: new Date().toISOString(), // Would be stored in real implementation
        size: JSON.stringify(cacheData).length
      };
    } else {
      cacheInfo = {
        exists: false,
        entityCount: 0,
        lastUpdated: null,
        size: 0
      };
    }
    
    return NextResponse.json({
      status: 'ready',
      cache: cacheInfo,
      neo4jConnected: true, // Would check actual connection
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function getBatchLogs(options: any) {
  try {
    // In a real implementation, you'd read from log files
    // For now, return recent activity
    return NextResponse.json({
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Batch processor is ready for manual execution'
        }
      ]
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get logs' }, { status: 500 });
  }
}