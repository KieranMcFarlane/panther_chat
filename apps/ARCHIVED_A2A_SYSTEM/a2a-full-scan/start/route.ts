/**
 * API endpoint to trigger full Neo4j entity scan using A2A methodology
 * Mirrors the successful curl approach but with progress tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

// Global flag to prevent multiple full scans
let isFullScanRunning = false;

// Function to update global progress
async function updateProgress(updates: any, currentSessionId: string) {
  try {
    const requestBody = {
      sessionId: currentSessionId,
      ...updates
    };
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/a2a-full-scan/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.error('Failed to update progress:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    } else {
      console.log(`✅ Progress updated: ${JSON.stringify(requestBody)}`);
    }
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if full scan is already running by checking progress API
    const currentProgress = await getCurrentProgress();
    const isCurrentlyRunning = currentProgress.status === 'running' || currentProgress.status === 'starting';
    
    if (isCurrentlyRunning && isFullScanRunning) {
      return NextResponse.json({
        success: false,
        error: 'Full A2A scan is already running',
        status: currentProgress.status,
        progress: currentProgress,
        message: `Session ${currentProgress.sessionId?.slice(-8)} started at ${new Date(currentProgress.startTime || 0).toLocaleTimeString()} is currently processing ${currentProgress.processedEntities}/${currentProgress.totalEntities} entities`,
        recommendation: 'Please wait for the current scan to complete or stop it first'
      }, { status: 409 });
    }

    // Force cleanup: Reset any existing progress and stop previous scans
    console.log('🧹 Cleaning up previous sessions before starting new scan...');
    isFullScanRunning = false;
    
    const resetResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/a2a-full-scan/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset',
        reason: 'Starting new full scan - cleaning up previous sessions'
      })
    });

    const body = await request.json();
    const { 
      batchSize = 250, // Use original methodology batch size
      startEntityId = 0,
      sessionId = `full_scan_${Date.now()}`
    } = body;

    isFullScanRunning = true;
    
    const initialProgress = {
      totalEntities: 0,
      processedEntities: 0,
      currentBatch: 0,
      totalBatches: 0,
      opportunitiesFound: 0,
      startTime: new Date().toISOString(),
      currentEntity: null,
      status: 'starting',
      sessionId
    };

    // Set the global progress sessionId first
    const progressResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/a2a-full-scan/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialProgress)
    });
    
    if (!progressResponse.ok) {
      console.error('Failed to set initial progress:', await progressResponse.text());
    }

    console.log('🚀 Starting Full A2A Neo4j Scan...');
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Batch Size: ${batchSize}`);
    console.log(`   Start Entity: ${startEntityId}`);

    // Log the start
    await liveLogService.info('🚀 Starting Full A2A Neo4j Scan', {
      category: 'a2a-full-scan',
      source: 'API',
      message: `Full Neo4j entity scan started with ${batchSize} entity batches`,
      data: {
        sessionId,
        batchSize,
        startEntityId,
        timestamp: new Date().toISOString()
      },
      tags: ['a2a-full-scan', 'neo4j-scan', 'batch-processing']
    });

    // Get total entity count first
    const countResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/neo4j-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          MATCH (e:Entity)
          WHERE e.yellowPantherPriority <= 5
          AND e.digitalTransformationScore >= 60
          RETURN count(e) as total
        `
      })
    });

    const countResult = await countResponse.json();
    console.log('📊 Neo4j count response:', JSON.stringify(countResult, null, 2));
    
    // Handle Neo4j Integer format (low/high properties)
    const rawCount = countResult.data?.[0]?.total;
    const totalEntities = rawCount && typeof rawCount === 'object' ? rawCount.low || rawCount.high || 0 : (rawCount || 0);
    const totalBatches = Math.ceil(totalEntities / batchSize);

    await updateProgress({
      totalEntities,
      totalBatches,
      status: 'running'
    }, sessionId);

    console.log(`📊 Total entities to process: ${totalEntities}`);
    console.log(`📊 Total batches: ${totalBatches}`);

    // Start processing in background
    processFullScan(sessionId, batchSize, startEntityId, totalEntities);

    return NextResponse.json({
      success: true,
      message: 'Full A2A Neo4j scan started successfully',
      sessionId,
      progress: {
        totalEntities,
        totalBatches,
        status: 'running',
        startTime: new Date().toISOString(),
        processedEntities: 0,
        opportunitiesFound: 0
      },
      nextSteps: [
        'Processing all high-priority Neo4j entities',
        `Total ${totalEntities} entities in ${totalBatches} batches`,
        'Real-time progress tracking enabled',
        'Check progress on this page or via API'
      ]
    });

  } catch (error) {
    isFullScanRunning = false;
    await updateProgress({
      status: 'error',
      errors: [error.message]
    }, sessionId);
    
    console.error('❌ Error starting full A2A scan:', error);
    
    await liveLogService.error('❌ Failed to Start Full A2A Scan', {
      category: 'a2a-full-scan',
      source: 'API',
      message: `Full scan startup failed: ${error.message}`,
      data: { error: error.message },
      tags: ['a2a-full-scan', 'error']
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to start full A2A scan',
      details: error.message
    }, { status: 500 });
  }
}

// Background processing function
async function processFullScan(sessionId: string, batchSize: number, startEntityId: number, totalEntities: number) {
  try {
    const totalBatches = Math.ceil(totalEntities / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const currentStart = startEntityId + (batchIndex * batchSize);
      const currentEnd = Math.min(currentStart + batchSize, totalEntities);
      
      await updateProgress({
        currentBatch: batchIndex + 1,
        processedEntities: currentStart,
        currentEntity: `Starting batch ${batchIndex + 1}/${totalBatches}`
      }, sessionId);

      console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches}: entities ${currentStart}-${currentEnd}`);

      // Execute the curl-based batch processing
      const batchResult = await processBatchWithCurl(sessionId, currentStart, batchSize);
      
      if (batchResult.success) {
        const totalOpportunities = (await getCurrentProgress()).opportunitiesFound + (batchResult.opportunitiesFound || 0);
        
        await updateProgress({
          processedEntities: currentEnd,
          opportunitiesFound: totalOpportunities,
          currentEntity: `Batch ${batchIndex + 1} completed - ${batchResult.opportunitiesFound} opportunities found`
        }, sessionId);

        console.log(`✅ Batch ${batchIndex + 1} completed. Found ${batchResult.opportunitiesFound} opportunities`);

        // Store opportunities to database
        if (batchResult.results && batchResult.results.length > 0) {
          await storeOpportunities(batchResult.results);
        }
      } else {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, batchResult.error);
        
        await updateProgress({
          errors: [`Batch ${batchIndex + 1} failed: ${batchResult.error}`]
        }, sessionId);
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Mark as completed - final progress stage
    isFullScanRunning = false;
    
    await updateProgress({
      status: 'completed',
      endTime: new Date().toISOString(),
      currentEntity: 'Full scan completed successfully!'
    }, sessionId);

    const finalProgress = await getCurrentProgress();
    
    await liveLogService.info('✅ Full A2A Neo4j Scan Completed', {
      category: 'a2a-full-scan',
      source: 'API',
      message: `Full scan completed. Processed ${finalProgress.totalEntities} entities, found ${finalProgress.opportunitiesFound} opportunities`,
      data: {
        sessionId,
        totalEntities: finalProgress.totalEntities,
        opportunitiesFound: finalProgress.opportunitiesFound,
        totalBatches,
        duration: new Date().getTime() - new Date(finalProgress.startTime).getTime()
      },
      tags: ['a2a-full-scan', 'completed', 'success']
    });

    console.log('🎉 Full A2A Neo4j scan completed!');
    console.log(`   Total entities processed: ${finalProgress.totalEntities}`);
    console.log(`   Total opportunities found: ${finalProgress.opportunitiesFound}`);

  } catch (error) {
    const currentProgress = await getCurrentProgress();
    isFullScanRunning = false;
    
    console.error('❌ Full scan processing error:', error);
    
    await updateProgress({
      status: 'error',
      errors: [error.message]
    }, sessionId);
  }
}

// Simulate the curl approach using the existing streaming endpoint
async function processBatchWithCurl(sessionId: string, startEntity: number, batchSize: number) {
  try {
    console.log(`🔍 Starting batch processing for entities ${startEntity}-${startEntity + batchSize}`);
    
    // Use the existing reliable service streaming endpoint
    const streamUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/claude-agent-demo/stream?service=reliable&query=Comprehensive%20RFP%20intelligence%20analysis&mode=batch&entityLimit=${batchSize}&startEntityId=${startEntity}&sessionId=${sessionId}`;
    
    console.log(`📡 Stream URL: ${streamUrl}`);

    // Make the request similar to curl
    const response = await fetch(streamUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let results = [];
    let opportunitiesFound = 0;
    let currentEntity = null;
    let processedCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Update current entity from progress
            if (data.type === 'entity_search_start') {
              currentEntity = data.message?.match(/Starting.*for: (.+)/)?.[1] || data.message;
              processedCount++;
              
              await updateProgress({
                currentEntity,
                processedEntities: startEntity + processedCount
              }, sessionId);

              console.log(`🔍 Processing: ${currentEntity}`);
            }

            // Log results
            if (data.type === 'log') {
              console.log(`📝 ${data.message}`);
            }

            // Count opportunities found
            if (data.type === 'result' && data.data?.results) {
              for (const result of data.data.results) {
                if (result.rfpOpportunities && result.rfpOpportunities.length > 0) {
                  opportunitiesFound += result.rfpOpportunities.length;
                  results = results.concat(result.rfpOpportunities);
                }
              }
            }

          } catch (parseError) {
            // Skip malformed JSON
          }
        }
      }
    }

    console.log(`✅ Batch completed: ${opportunitiesFound} opportunities found`);

    return {
      success: true,
      opportunitiesFound,
      results,
      processedEntities: startEntity + batchSize,
      sessionId
    };

  } catch (error) {
    console.error(`❌ Batch processing error:`, error);
    return {
      success: false,
      error: error.message,
      opportunitiesFound: 0,
      results: []
    };
  }
}

// Store opportunities to database
async function storeOpportunities(opportunities: any[]) {
  try {
    for (const opportunity of opportunities) {
      const response = await fetch('/api/a2a-opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...opportunity,
          source: 'Full A2A Neo4j Scan',
          discoveredAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log(`💾 Stored opportunity: ${opportunity.title}`);
      } else {
        console.error(`❌ Failed to store opportunity: ${opportunity.title}`);
      }
    }
  } catch (error) {
    console.error('❌ Error storing opportunities:', error);
  }
}

// Helper function to get current progress
async function getCurrentProgress() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/a2a-full-scan/progress`);
    const data = await response.json();
    return data.progress || {
      totalEntities: 0,
      processedEntities: 0,
      opportunitiesFound: 0,
      status: 'idle'
    };
  } catch (error) {
    console.error('Failed to get current progress:', error);
    return {
      totalEntities: 0,
      processedEntities: 0,
      opportunitiesFound: 0,
      status: 'error'
    };
  }
}

// GET endpoint for progress tracking
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  return NextResponse.json({
    success: true,
    progress: await getCurrentProgress(),
    isRunning: isFullScanRunning,
    sessionId
  });
}