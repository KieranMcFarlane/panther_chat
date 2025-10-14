import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { action, options = {} } = await request.json();
    
    switch (action) {
      case 'run-verbose':
        return await runVerboseBatchProcessor(options);
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Verbose batch processor error:', error);
    return NextResponse.json({ 
      error: 'Verbose batch processor failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function runVerboseBatchProcessor(options: any) {
  try {
    const { limit = 5 } = options;
    
    // Build command
    const scriptPath = path.join(process.cwd(), 'scripts/verbose-batch-processor.js');
    const command = `node "${scriptPath}"`;
    
    console.log(`🚀 Starting VERBOSE batch processor: ${command}`);
    
    // Execute with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 180000, // 3 minutes
      cwd: process.cwd()
    });
    
    // Parse output for summary
    const lines = stdout.split('\n');
    const summary = parseVerboseBatchOutput(lines);
    
    return NextResponse.json({
      success: true,
      command,
      stdout,
      stderr,
      summary,
      completedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Verbose batch processor execution error:', error);
    
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

function parseVerboseBatchOutput(lines: string[]) {
  const summary: any = {
    totalEntities: 0,
    totalOpportunities: 0,
    totalRisks: 0,
    totalRecommendations: 0,
    estimatedValue: 0,
    entities: [],
    topOpportunities: []
  };
  
  let currentEntity: any = null;
  
  lines.forEach(line => {
    // Extract total entities processed
    const entityMatch = line.match(/📊 Total Entities Processed: (\d+)/);
    if (entityMatch) summary.totalEntities = parseInt(entityMatch[1]);
    
    // Extract opportunities
    const oppMatch = line.match(/💰 Total Opportunities Identified: (\d+)/);
    if (oppMatch) summary.totalOpportunities = parseInt(oppMatch[1]);
    
    // Extract risks
    const riskMatch = line.match(/⚠️ Total Risks Assessed: (\d+)/);
    if (riskMatch) summary.totalRisks = parseInt(riskMatch[1]);
    
    // Extract recommendations
    const recMatch = line.match(/💡 Total Recommendations: (\d+)/);
    if (recMatch) summary.totalRecommendations = parseInt(recMatch[1]);
    
    // Extract estimated value
    const valueMatch = line.match(/💷 Estimated Portfolio Value: £([\d.]+)M/);
    if (valueMatch) summary.estimatedValue = parseFloat(valueMatch[1]);
    
    // Extract entity information
    const entityNameMatch = line.match(/📋 Entity \d+:\s*\n\s*🏷️\s*Name: (.+)/);
    if (entityNameMatch) {
      currentEntity = { name: entityNameMatch[1] };
      summary.entities.push(currentEntity);
    }
    
    // Extract entity type and sport
    const entityTypeMatch = line.match(/🎪 Type: (.+)/);
    if (entityTypeMatch && currentEntity) currentEntity.type = entityTypeMatch[1];
    
    const entitySportMatch = line.match(/⚽ Sport: (.+)/);
    if (entitySportMatch && currentEntity) currentEntity.sport = entitySportMatch[1];
    
    // Extract top opportunities
    const topOppMatch = line.match(/^\d+\.\s+(.+)/);
    if (topOppMatch && line.includes('Entity:')) {
      const oppLine = line.trim();
      const entityMatch = oppLine.match(/🏢 Entity: (.+) 💵/);
      if (entityMatch) {
        summary.topOpportunities.push({
          title: topOppMatch[1],
          entity: entityMatch[1]
        });
      }
    }
  });
  
  return summary;
}