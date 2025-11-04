import { NextRequest } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

interface SlashCommandRequest {
  command: string;
  sessionId?: string;
}

interface SlashCommandResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body: SlashCommandRequest = await req.json();
    const { command, sessionId = 'default' } = body;

    if (!command) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Command is required'
      } as SlashCommandResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ensure scheduler is configured
    try {
      claudeAgentScheduler.configure({
        brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
        brightdataZone: process.env.BRIGHTDATA_ZONE || '',
        neo4jUri: process.env.NEO4J_URI || '',
        neo4jUsername: process.env.NEO4J_USERNAME || '',
        neo4jPassword: process.env.NEO4J_PASSWORD || '',
        teamsWebhookUrl: '',
        perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
        searchQueries: [],
        targetIndustries: []
      });
    } catch (error) {
      // Scheduler might already be configured, which is fine
    }

    // Execute the slash command with session ID
    const result = await claudeAgentScheduler.executeSlashCommand(command, sessionId);

    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: `Command executed: ${command}`
    } as SlashCommandResponse), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to execute slash command'
    } as SlashCommandResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function GET(): Promise<Response> {
  try {
    // Ensure scheduler is configured
    try {
      claudeAgentScheduler.configure({
        brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
        brightdataZone: process.env.BRIGHTDATA_ZONE || '',
        neo4jUri: process.env.NEO4J_URI || '',
        neo4jUsername: process.env.NEO4J_USERNAME || '',
        neo4jPassword: process.env.NEO4J_PASSWORD || '',
        teamsWebhookUrl: '',
        perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
        searchQueries: [],
        targetIndustries: []
      });
    } catch (error) {
      // Scheduler might already be configured, which is fine
    }

    const status = await claudeAgentScheduler.getAgentStatus();
    const commands = claudeAgentScheduler.getAvailableCommands();

    return new Response(JSON.stringify({
      success: true,
      data: {
        status,
        availableCommands: commands,
        help: await claudeAgentScheduler.executeSlashCommand('/help')
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}