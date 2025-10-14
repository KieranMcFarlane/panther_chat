import { NextRequest, NextResponse } from 'next/server';
import { HeadlessClaudeAgentService } from '@/services/HeadlessClaudeAgentService';
import { ClaudeAgentCronScheduler } from '@/services/ClaudeAgentCronScheduler';
import { liveLogService } from '@/services/LiveLogService';

// Global instances (in production, use dependency injection)
let claudeService: HeadlessClaudeAgentService | null = null;
let cronScheduler: ClaudeAgentCronScheduler | null = null;

/**
 * Initialize services with environment configuration
 */
function initializeServices() {
  if (claudeService && cronScheduler) {
    return { claudeService, cronScheduler };
  }

  const config = {
    brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN,
    brightdataZone: process.env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor',
    neo4jUri: process.env.NEO4J_URI,
    neo4jUsername: process.env.NEO4J_USERNAME,
    neo4jPassword: process.env.NEO4J_PASSWORD,
    teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL,
    searchQueries: [
      'sports technology RFP',
      'venue management Request for Proposal',
      'event services procurement',
      'stadium digital transformation',
      'sports sponsorship opportunities',
      'athletic department technology',
      'sports facility management software',
      'ticketing system RFP'
    ],
    targetIndustries: [
      'Sports & Entertainment',
      'Venue Management',
      'Event Technology',
      'Digital Sports',
      'Facility Operations'
    ]
  };

  claudeService = new HeadlessClaudeAgentService(config);
  
  cronScheduler = new ClaudeAgentCronScheduler(claudeService, {
    schedule: '0 9 * * *', // 9:00 AM daily
    enabled: process.env.CLAUDE_AGENT_CRON_ENABLED === 'true',
    timezone: process.env.CLAUDE_AGENT_TIMEZONE || 'America/New_York'
  });

  return { claudeService, cronScheduler };
}

/**
 * GET /api/claude-agent/status - Get status of Claude Agent and cron jobs
 */
export async function GET(request: NextRequest) {
  try {
    const { claudeService, cronScheduler } = initializeServices();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        const status = cronScheduler.getStatus();
        return NextResponse.json({
          success: true,
          data: {
            claudeAgent: status.claudeService,
            cronScheduler: {
              enabled: status.enabled,
              jobs: status.jobs,
              timezone: process.env.CLAUDE_AGENT_TIMEZONE || 'America/New_York'
            },
            environment: {
              cronEnabled: process.env.CLAUDE_AGENT_CRON_ENABLED === 'true',
              brightdataConfigured: !!process.env.BRIGHTDATA_API_TOKEN,
              neo4jConfigured: !!(process.env.NEO4J_URI && process.env.NEO4J_USERNAME),
              teamsConfigured: !!process.env.TEAMS_WEBHOOK_URL
            }
          }
        });

      case 'trigger':
        const jobName = searchParams.get('job');
        if (!jobName) {
          return NextResponse.json({
            success: false,
            error: 'Job name is required for trigger action'
          }, { status: 400 });
        }

        const triggerResult = await cronScheduler.triggerJob(jobName);
        return NextResponse.json({
          success: triggerResult,
          message: triggerResult 
            ? `Successfully triggered job: ${jobName}` 
            : `Failed to trigger job: ${jobName}`
        });

      case 'logs':
        try {
          // Get logs using existing LiveLogService
          const logs = await liveLogService.getLogs({
            source: 'HeadlessClaudeAgentService',
            limit: 50,
            hours: 24
          });

          // Get activity feed for Claude Agent
          const activities = await liveLogService.getActivityFeed({
            limit: 20,
            hours: 24
          });

          // Filter for Claude Agent related activities
          const claudeActivities = activities.filter(activity => 
            activity.title.includes('Claude Agent') || 
            activity.title.includes('RFP') ||
            activity.details?.task_id?.startsWith('claude_agent')
          );

          return NextResponse.json({
            success: true,
            data: {
              logs: logs.map(log => ({
                id: log.id,
                type: log.level,
                title: log.message,
                timestamp: log.timestamp,
                metadata: {
                  category: log.category,
                  source: log.source,
                  data: log.data,
                  tags: log.tags,
                  task_id: log.data?.task_id
                }
              })),
              activities: claudeActivities,
              stats: await liveLogService.getLogStats(24)
            }
          });
        } catch (error) {
          console.error('Failed to fetch Claude Agent logs:', error);
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch logs',
            data: {
              logs: [],
              activities: [],
              stats: { total: 0, by_level: {}, by_category: {}, error_rate: 0, top_sources: [] }
            }
          });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: status, trigger, or logs'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Claude Agent API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/claude-agent - Manual execution or configuration updates
 */
export async function POST(request: NextRequest) {
  try {
    const { claudeService, cronScheduler } = initializeServices();
    
    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'run-scraping':
        const results = await claudeService.runDailyRFPScraping();
        return NextResponse.json({
          success: true,
          data: {
            results,
            summary: {
              totalFound: results.length,
              highValue: results.filter(r => r.relevanceScore > 0.8).length,
              executedAt: new Date().toISOString()
            }
          }
        });

      case 'update-cron':
        if (!config) {
          return NextResponse.json({
            success: false,
            error: 'Configuration is required for update-cron action'
          }, { status: 400 });
        }

        cronScheduler.updateConfig(config);
        return NextResponse.json({
          success: true,
          message: 'Cron configuration updated successfully'
        });

      case 'stop-job':
        const { jobName } = body;
        if (!jobName) {
          return NextResponse.json({
            success: false,
            error: 'Job name is required for stop-job action'
          }, { status: 400 });
        }

        const stopResult = cronScheduler.stopJob(jobName);
        return NextResponse.json({
          success: stopResult,
          message: stopResult 
            ? `Successfully stopped job: ${jobName}` 
            : `Job not found: ${jobName}`
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: run-scraping, update-cron, or stop-job'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Claude Agent POST API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Initialize cron scheduler on server startup
 */
if (typeof window === 'undefined') {
  // Only run on server side
  try {
    const { cronScheduler } = initializeServices();
    cronScheduler.start();
    console.log('Claude Agent cron scheduler initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Claude Agent cron scheduler:', error);
  }
}