/**
 * 🔄 Batch Processing API with Claude Agent
 * 
 * Handles bulk data processing jobs using Claude Agent for enriched analysis
 * and business intelligence at scale
 */

import { NextRequest, NextResponse } from 'next/server';
import { rfpIntelligenceAgent } from '@/lib/claude-agent-rfp-intelligence';

interface BatchJobRequest {
  type: 'enrichment' | 'analysis' | 'reasoning' | 'classification' | 'market_intelligence';
  data: any[];
  priority?: 'high' | 'medium' | 'low';
  options?: {
    useClaudeAgent?: boolean;
    batchSize?: number;
    timeout?: number;
    mcpTools?: string[];
  };
  metadata?: {
    source: string;
    userId?: string;
    projectId?: string;
    tags?: string[];
  };
}

interface BatchJobResponse {
  success: boolean;
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  itemCount: number;
  estimatedDuration?: number;
  queuePosition?: number;
  timestamp: string;
  message?: string;
}

// In-memory storage for demo (use database in production)
const batchJobs = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body: BatchJobRequest = await request.json();
    
    // Validate batch job request
    if (!body.type || !body.data || !Array.isArray(body.data)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: type, data (array)',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (body.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Data array cannot be empty',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const jobId = rfpIntelligenceAgent.addBatchJob(
      body.data,
      body.type,
      body.priority || 'medium'
    );

    // Store job metadata for tracking
    batchJobs.set(jobId, {
      id: jobId,
      type: body.type,
      status: 'queued',
      itemCount: body.data.length,
      priority: body.priority || 'medium',
      options: body.options || {},
      metadata: body.metadata || {},
      createdAt: new Date().toISOString(),
      estimatedDuration: calculateEstimatedDuration(body.type, body.data.length, body.options)
    });

    const queueStatus = rfpIntelligenceAgent.getBatchStatus();
    const queuePosition = queueStatus.queue.findIndex(job => job.id === jobId) + 1;

    const response: BatchJobResponse = {
      success: true,
      jobId,
      status: 'queued',
      itemCount: body.data.length,
      estimatedDuration: calculateEstimatedDuration(body.type, body.data.length, body.options),
      queuePosition: queuePosition > 0 ? queuePosition : undefined,
      timestamp: new Date().toISOString(),
      message: `Batch job queued with ${body.data.length} items for ${body.type} processing`
    };

    console.log(`🔄 Batch job created:`, {
      jobId,
      type: body.type,
      itemCount: body.data.length,
      priority: body.priority,
      queuePosition
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Batch job creation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const jobId = searchParams.get('jobId');

    switch (action) {
      case 'status':
        // Get overall batch processing status
        const status = rfpIntelligenceAgent.getBatchStatus();
        return NextResponse.json({
          success: true,
          data: status,
          timestamp: new Date().toISOString()
        });

      case 'job':
        // Get specific job status
        if (!jobId) {
          return NextResponse.json({
            success: false,
            error: 'Job ID required',
            timestamp: new Date().toISOString()
          }, { status: 400 });
        }

        const job = batchJobs.get(jobId);
        if (!job) {
          return NextResponse.json({
            success: false,
            error: 'Job not found',
            timestamp: new Date().toISOString()
          }, { status: 404 });
        }

        // Get current status from agent
        const agentStatus = rfpIntelligenceAgent.getBatchStatus();
        const currentJob = agentStatus.queue.find(j => j.id === jobId);
        
        if (currentJob) {
          job.status = currentJob.status;
          job.processedAt = currentJob.processedAt;
          if (currentJob.status === 'completed' && currentJob.results) {
            job.results = currentJob.results;
          }
        }

        return NextResponse.json({
          success: true,
          data: job,
          timestamp: new Date().toISOString()
        });

      case 'list':
        // List all jobs with filtering
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const filter = searchParams.get('filter') || 'all';
        const userId = searchParams.get('userId');

        let allJobs = Array.from(batchJobs.values());

        // Apply filters
        if (userId) {
          allJobs = allJobs.filter(job => job.metadata.userId === userId);
        }
        if (filter !== 'all') {
          allJobs = allJobs.filter(job => job.status === filter);
        }

        // Sort by creation time (newest first)
        allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Apply pagination
        const paginatedJobs = allJobs.slice(offset, offset + limit);

        return NextResponse.json({
          success: true,
          data: {
            jobs: paginatedJobs,
            total: allJobs.length,
            limit,
            offset,
            hasMore: offset + limit < allJobs.length
          },
          timestamp: new Date().toISOString()
        });

      case 'health':
        // Health check for batch processing system
        const queueHealth = rfpIntelligenceAgent.getBatchStatus();
        
        return NextResponse.json({
          success: true,
          status: 'healthy',
          system: 'Batch Processing with Claude Agent',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          queue: {
            totalInQueue: queueHealth.totalInQueue,
            availableHandlers: queueHealth.availableHandlers.length
          }
        });

      default:
        return NextResponse.json({
          success: true,
          message: 'Claude Agent Batch Processing API',
          endpoints: {
            'POST /': 'Create batch job for bulk processing',
            'GET /?action=status': 'Get overall batch processing status',
            'GET /?action=job&jobId={id}': 'Get specific job status and results',
            'GET /?action=list&limit=50&offset=0': 'List all jobs with pagination',
            'GET /?action=health': 'Health check'
          },
          jobTypes: [
            'enrichment - Enrich entity data with intelligence',
            'analysis - Analyze RFPs and opportunities',
            'reasoning - Apply AI reasoning to alerts',
            'classification - Classify and categorize data',
            'market_intelligence - Analyze market context'
          ],
          examples: getBatchJobExamples(),
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('❌ Batch API GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({
        success: false,
        error: 'Job ID required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const job = batchJobs.get(jobId);
    if (!job) {
      return NextResponse.json({
        success: false,
        error: 'Job not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    if (job.status === 'running') {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete job that is currently running',
        timestamp: new Date().toISOString()
      }, { status: 409 });
    }

    batchJobs.delete(jobId);

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
      jobId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Batch job deletion failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * 🔢 Calculate estimated processing duration based on job type and complexity
 */
function calculateEstimatedDuration(
  jobType: string, 
  itemCount: number, 
  options?: any
): number {
  const baseTimePerItem = {
    enrichment: 15000,  // 15 seconds per entity
    analysis: 10000,    // 10 seconds per RFP
    reasoning: 8000,    // 8 seconds per alert
    classification: 3000, // 3 seconds per item
    market_intelligence: 12000 // 12 seconds per analysis
  };

  const batchMultiplier = options?.useClaudeAgent ? 0.7 : 1.0; // Claude Agent is faster
  const baseTime = baseTimePerItem[jobType as keyof typeof baseTimePerItem] || 10000;
  
  return Math.ceil((baseTime * itemCount * batchMultiplier) / 1000); // Return in seconds
}

/**
 * 📋 Example batch job payloads for testing
 */
function getBatchJobExamples() {
  return {
    entity_enrichment: {
      type: 'enrichment',
      data: [
        {
          id: 'company-1',
          name: 'Sports Tech Company',
          type: 'company',
          industry: 'Sports',
          size: 'large',
          location: 'Boston, MA'
        }
      ],
      priority: 'medium',
      options: {
        useClaudeAgent: true,
        mcpTools: ['neo4j', 'brightdata', 'memory']
      }
    },
    
    rfp_analysis: {
      type: 'analysis',
      data: [
        {
          id: 'rfp-123',
          title: 'Sports Platform Implementation',
          organization: 'Major League',
          description: 'Complete digital transformation',
          value: '$2.5M',
          category: 'Technology'
        }
      ],
      priority: 'high',
      options: {
        useClaudeAgent: true,
        batchSize: 10
      }
    },

    alert_reasoning: {
      type: 'reasoning',
      data: [
        {
          id: 'alert-456',
          type: 'promotion',
          entity: 'Sarah Johnson',
          description: 'promoted to VP of Digital Strategy',
          impact: 0,
          source: 'linkedin',
          timestamp: new Date().toISOString()
        }
      ],
      priority: 'medium',
      options: {
        useClaudeAgent: true
      }
    }
  };
}