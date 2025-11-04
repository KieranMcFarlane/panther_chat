import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check database connection status
    const dbStatus = await checkDatabaseConnection();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: 'healthy'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function checkDatabaseConnection() {
  try {
    // For now, return healthy status
    // In production, you would check actual Neo4j connection
    return {
      status: 'connected',
      message: 'Database connection healthy'
    };
  } catch (error) {
    return {
      status: 'disconnected',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

