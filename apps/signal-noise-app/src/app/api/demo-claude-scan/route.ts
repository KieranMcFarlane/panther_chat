import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

/**
 * Demo endpoint that simulates Claude Agent RFP scanning with real-time logging
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const taskId = `claude_demo_${Date.now()}`;
  
  try {
    // Log scan start
    await liveLogService.addActivity({
      type: 'system_event',
      title: '🤖 Claude Agent RFP Scan Started',
      description: `Daily RFP intelligence scanning initiated with 8 search queries`,
      urgency: 'medium',
      details: {
        task_id: taskId,
        search_queries_count: 8,
        target_industries: ['Sports & Entertainment', 'Venue Management', 'Event Technology']
      },
      actions: [
        {
          label: 'View Dashboard',
          action: 'view_claude_dashboard',
          url: '/claude-agent'
        }
      ]
    });

    liveLogService.info('Starting RFP scanning simulation', {
      category: 'system',
      source: 'ClaudeAgentDemo',
      message: 'Demo RFP scanning started',
      data: {
        task_id: taskId,
        searchQueries: 8,
        startTime: new Date().toISOString()
      },
      tags: ['claude-agent', 'rfp-scraping', 'demo', 'daily-scan']
    });

    // Simulate LinkedIn search
    await new Promise(resolve => setTimeout(resolve, 2000));
    liveLogService.info('Searching LinkedIn for RFP opportunities', {
      category: 'api',
      source: 'ClaudeAgentDemo',
      message: 'Claude Agent tool starting: search_linkedin_rfp',
      data: {
        task_id: taskId,
        toolUseId: 'tool_1',
        toolName: 'search_linkedin_rfp',
        inputSummary: '{"query": "sports technology RFP", "maxResults": 20}'
      },
      tags: ['claude-agent', 'tool-use', 'linkedin']
    });

    // Simulate web search
    await new Promise(resolve => setTimeout(resolve, 1500));
    liveLogService.info('Web news search completed', {
      category: 'api',
      source: 'ClaudeAgentDemo',
      message: 'Claude Agent tool completed: search_web_news',
      data: {
        task_id: taskId,
        toolUseId: 'tool_2',
        toolName: 'search_web_news',
        results: 15
      },
      tags: ['claude-agent', 'tool-use', 'web-search']
    });

    // Get real opportunities from database instead of mock data
    let realOpportunities = [];
    try {
      // Use localhost URL since we're running in the same server environment
      const realDataResponse = await fetch('http://localhost:3005/api/rfp-intelligence/real-data', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (realDataResponse.ok) {
        const realDataResult = await realDataResponse.json();
        if (realDataResult.success) {
          realOpportunities = realDataResult.data.opportunities.slice(0, 3).map((rfp: any) => ({
            id: rfp.id,
            title: rfp.title,
            source: rfp.source || 'Database',
            relevanceScore: rfp.relevanceScore || 0.8,
            description: rfp.description,
            organization: rfp.organization,
            fitScore: rfp.yellow_panther_fit
          }));
        }
      }
    } catch (error) {
      console.log('⚠️ Could not fetch real RFP data, using fallback:', error.message);
    }

    // Use real data if available, otherwise fall back to mock data for demo
    const opportunities = realOpportunities.length > 0 ? realOpportunities : [
      {
        id: 'rfp_1',
        title: 'Stadium Digital Transformation RFP',
        source: 'LinkedIn',
        relevanceScore: 0.92,
        description: 'Major sports stadium seeking digital transformation partner'
      },
      {
        id: 'rfp_2', 
        title: 'Event Management Software Procurement',
        source: 'Web News',
        relevanceScore: 0.85,
        description: 'Large entertainment venue looking for comprehensive event management solution'
      },
      {
        id: 'rfp_3',
        title: 'Sports Facility Security System',
        source: 'LinkedIn',
        relevanceScore: 0.78,
        description: 'Professional sports team requesting advanced security system proposals'
      }
    ];

    // Log real database storage instead of simulated Neo4j
    await new Promise(resolve => setTimeout(resolve, 1000));
    const isRealData = realOpportunities.length > 0;
    liveLogService.info(isRealData ? 'Real RFP data retrieved from database' : 'Storing RFP results in Neo4j', {
      category: 'database',
      source: 'ClaudeAgentDemo',
      message: isRealData ? 'Real database RFP integration completed' : 'Claude Agent tool completed: store_rfp_result',
      data: {
        task_id: taskId,
        stored: opportunities.length,
        entities: isRealData ? opportunities.length * 2 : 12,
        dataSource: isRealData ? 'supabase_database' : 'neo4j',
        isRealData: isRealData
      },
      tags: isRealData ? ['claude-agent', 'database', 'real-rfps', 'integration'] : ['claude-agent', 'tool-use', 'neo4j', 'storage']
    });

    // Log completion with real data
    const duration = Date.now() - startTime;
    const highValueCount = opportunities.filter(r => r.relevanceScore > 0.8).length;

    await liveLogService.addActivity({
      type: 'analysis',
      title: `🎯 RFP Intelligence Complete: ${opportunities.length} ${isRealData ? 'Real' : 'Demo'} Opportunities`,
      description: `Found ${opportunities.length} ${isRealData ? 'verified database' : 'demo'} RFP opportunities with ${highValueCount} high-value targets`,
      urgency: opportunities.some(r => r.relevanceScore > 0.9) ? 'high' : 'medium',
      details: {
        task_id: taskId,
        totalResults: opportunities.length,
        highValueResults: highValueCount,
        toolsExecuted: 3,
        duration: duration,
        dataSource: isRealData ? 'supabase_database' : 'demo_simulation',
        isRealData: isRealData,
        opportunities: opportunities.map(r => ({
          title: r.title,
          score: r.relevanceScore,
          source: r.source,
          organization: r.organization || 'Unknown'
        }))
      },
      actions: [
        {
          label: 'View Opportunities',
          action: 'view_rfp_opportunities',
          url: '/tenders'
        },
        {
          label: isRealData ? 'View Real RFPs' : 'View Demo Report',
          action: isRealData ? 'view_real_rfps' : 'view_claude_report',
          url: isRealData ? '/tenders' : '/claude-agent'
        }
      ]
    });

    liveLogService.info(`${isRealData ? 'Real' : 'Demo'} RFP scanning completed successfully`, {
      category: 'system',
      source: 'ClaudeAgentDemo',
      message: `Claude Agent RFP scanning completed successfully with ${isRealData ? 'real database' : 'demo'} data`,
      data: {
        task_id: taskId,
        duration,
        toolsExecuted: 3,
        responseLength: 1250,
        dataSource: isRealData ? 'supabase_database' : 'demo_simulation',
        realDataCount: realOpportunities.length
      },
      tags: isRealData ? ['claude-agent', 'rfp-scraping', 'completed', 'real-data', 'database'] : ['claude-agent', 'rfp-scraping', 'completed', 'demo']
    });

    return NextResponse.json({
      success: true,
      data: {
        results: opportunities,
        summary: {
          totalFound: opportunities.length,
          highValue: highValueCount,
          duration: duration,
          executedAt: new Date().toISOString(),
          taskId: taskId,
          dataSource: isRealData ? 'supabase_database' : 'demo_simulation',
          isRealData: isRealData
        }
      }
    });

  } catch (error) {
    // Log error
    await liveLogService.addActivity({
      type: 'system_event',
      title: '🚨 Claude Agent RFP Scan Failed',
      description: `Daily RFP scanning encountered an error: ${error.message}`,
      urgency: 'critical',
      details: {
        task_id: taskId,
        error: error.message,
        duration: Date.now() - startTime
      },
      actions: [
        {
          label: 'View Error Details',
          action: 'view_error_details',
          url: `/claude-agent`
        }
      ]
    });

    liveLogService.error('Demo RFP scanning failed', {
      category: 'system',
      source: 'ClaudeAgentDemo',
      message: `Claude Agent RFP scanning failed: ${error.message}`,
      data: {
        task_id: taskId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      },
      metadata: {
        processing_time: Date.now() - startTime,
        error_code: 'CLAUDE_AGENT_ERROR'
      },
      tags: ['claude-agent', 'rfp-scraping', 'error', 'demo']
    });

    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        taskId: taskId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}