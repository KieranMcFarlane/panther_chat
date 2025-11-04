import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

export async function POST(req: NextRequest) {
  try {
    const { autoConfigure } = await req.json();

    if (autoConfigure) {
      try {
        // Configure scheduler with environment variables
        claudeAgentScheduler.configureFromEnvironment();
        
        return NextResponse.json({ 
          success: true, 
          message: '✅ Claude Agent scheduler configured with environment variables',
          status: claudeAgentScheduler.getStatus()
        });
      } catch (configError) {
        return NextResponse.json({
          error: 'Configuration failed',
          details: configError instanceof Error ? configError.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Set autoConfigure to true to configure with environment variables' 
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to configure Claude Agents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const status = claudeAgentScheduler.getStatus();
    return NextResponse.json({ 
      success: true, 
      status 
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get scheduler status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}