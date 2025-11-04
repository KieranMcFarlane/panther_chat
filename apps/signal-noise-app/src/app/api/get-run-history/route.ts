import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface RunMetrics {
  file: string;
  started: string;
  completed?: string;
  duration: string;
  durationMs?: number;
  foundRFPs: number;
  entitiesProcessed: number;
  searchesPerformed: number;
  neo4jQueries: number;
  toolsUsed: string[];
  score: number;
  status: 'completed' | 'partial' | 'error';
  summary?: string;
}

export async function GET(request: NextRequest) {
  try {
    const basePath = path.join(process.cwd(), 'RUN_LOGS');
    
    if (!fs.existsSync(basePath)) {
      return NextResponse.json({ runs: [], summary: { totalRuns: 0, totalRFPs: 0, avgScore: 0 } });
    }

    const files = fs.readdirSync(basePath)
      .filter(f => f.endsWith('.md'))
      .sort((a, b) => {
        // Sort by timestamp (newest first)
        const aTime = fs.statSync(path.join(basePath, a)).mtime;
        const bTime = fs.statSync(path.join(basePath, b)).mtime;
        return bTime.getTime() - aTime.getTime();
      });

    const runs: RunMetrics[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(basePath, file), 'utf8');
        const metrics = parseRunMetrics(content, file);
        runs.push(metrics);
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
        // Add partial entry for files that can't be parsed
        runs.push({
          file,
          started: 'Unknown',
          duration: 'N/A',
          foundRFPs: 0,
          entitiesProcessed: 0,
          searchesPerformed: 0,
          neo4jQueries: 0,
          toolsUsed: [],
          score: 0,
          status: 'error'
        });
      }
    }

    // Calculate summary stats
    const completedRuns = runs.filter(r => r.status === 'completed');
    const summary = {
      totalRuns: runs.length,
      completedRuns: completedRuns.length,
      totalRFPs: completedRuns.reduce((sum, run) => sum + run.foundRFPs, 0),
      totalEntities: completedRuns.reduce((sum, run) => sum + run.entitiesProcessed, 0),
      totalSearches: completedRuns.reduce((sum, run) => sum + run.searchesPerformed, 0),
      avgScore: completedRuns.length > 0 ? 
        Math.round(completedRuns.reduce((sum, run) => sum + run.score, 0) / completedRuns.length) : 0,
      lastRun: runs[0]?.started || null
    };

    return NextResponse.json({ runs, summary });

  } catch (error) {
    console.error('Error reading run history:', error);
    return NextResponse.json(
      { error: 'Failed to read run history', runs: [], summary: { totalRuns: 0, totalRFPs: 0, avgScore: 0 } },
      { status: 500 }
    );
  }
}

function parseRunMetrics(content: string, file: string): RunMetrics {
  // Extract timestamp from filename first
  const timestampMatch = file.match(/RFP_RUN_(.+)\.md/);
  const fileTimestamp = timestampMatch ? timestampMatch[1] : 'unknown';

  // Extract start time
  const startedMatch = content.match(/\*\*Started:\*\* (.+)/);
  const started = startedMatch ? startedMatch[1] : fileTimestamp;

  // Extract completion time
  const completedMatch = content.match(/\*\*Run Completed:\*\* (.+)/);
  const completed = completedMatch ? completedMatch[1] : undefined;

  // Calculate duration in milliseconds if both timestamps are available
  let durationMs: number | undefined;
  let duration: string = 'N/A';

  if (started && completed) {
    try {
      const startTime = new Date(started).getTime();
      const endTime = new Date(completed).getTime();
      durationMs = endTime - startTime;
      duration = formatDuration(durationMs);
    } catch (error) {
      console.warn('Could not calculate duration:', error);
    }
  }

  // Try to extract duration from summary table as fallback
  if (duration === 'N/A') {
    const durationTableMatch = content.match(/\|\s*Duration\s*\|\s*([\d.]+s)\s*\|/);
    if (durationTableMatch) {
      duration = durationTableMatch[1];
      const seconds = parseFloat(durationTableMatch[1]);
      durationMs = Math.round(seconds * 1000);
    }
  }

  // Extract metrics from summary table
  const entitiesMatch = content.match(/\|\s*Entities Processed\s*\|\s*(\d+)\s*\|/);
  const searchesMatch = content.match(/\|\s*Searches Performed\s*\|\s*(\d+)\s*\|/);
  const neo4jMatch = content.match(/\|\s*Neo4j Queries\s*\|\s*(\d+)\s*\|/);
  const rfpsMatch = content.match(/\|\s*RFP Opportunities\s*\|\s*(\d+)\s*\|/);

  const entitiesProcessed = entitiesMatch ? parseInt(entitiesMatch[1]) : 0;
  const searchesPerformed = searchesMatch ? parseInt(searchesMatch[1]) : 0;
  const neo4jQueries = neo4jMatch ? parseInt(neo4jMatch[1]) : 0;
  const foundRFPs = rfpsMatch ? parseInt(rfpsMatch[1]) : 0;

  // Extract tools used
  const toolMatches = content.match(/#### 🔧 Tool Execution: `(.+?)`/g) || [];
  const toolsUsed = [...new Set(
    toolMatches.map(match => {
      const toolNameMatch = match.match(/`(.+?)`/);
      return toolNameMatch ? toolNameMatch[1] : 'unknown';
    })
  )];

  // Determine status
  const isCompleted = content.includes('Run Completed') || content.includes('Execution Summary');
  const isError = content.includes('error') || content.includes('failed') || content.includes('❌');
  const status: 'completed' | 'partial' | 'error' = isCompleted ? 'completed' : isError ? 'error' : 'partial';

  // Calculate score
  const score = calculateScore({
    foundRFPs,
    entitiesProcessed,
    searchesPerformed,
    toolsUsed: toolsUsed.length,
    status
  });

  // Extract summary
  const summaryMatch = content.match(/### 🤖 Agent Analysis\s*\n\s*(.+?)(?=\n\n###|\n####|$)/s);
  const summary = summaryMatch ? summaryMatch[1].trim().substring(0, 200) + '...' : '';

  return {
    file,
    started,
    completed,
    duration,
    durationMs,
    foundRFPs,
    entitiesProcessed,
    searchesPerformed,
    neo4jQueries,
    toolsUsed,
    score,
    status,
    summary
  };
}

function calculateScore(metrics: {
  foundRFPs: number;
  entitiesProcessed: number;
  searchesPerformed: number;
  toolsUsed: number;
  status: 'completed' | 'partial' | 'error';
}): number {
  let score = 0;

  // Base score for RFPs found (highest weight)
  score += metrics.foundRFPs * 25;

  // Score for processing efficiency
  if (metrics.entitiesProcessed > 0) {
    score += Math.min(metrics.entitiesProcessed * 2, 50);
  }

  // Score for thoroughness (searches performed)
  score += Math.min(metrics.searchesPerformed * 1, 25);

  // Score for tool diversity
  score += metrics.toolsUsed * 5;

  // Status modifier
  if (metrics.status === 'completed') {
    score *= 1.2; // 20% bonus for completion
  } else if (metrics.status === 'error') {
    score *= 0.5; // 50% penalty for errors
  }

  return Math.min(Math.round(score), 100); // Cap at 100
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}