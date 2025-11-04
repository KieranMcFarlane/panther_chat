import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Test SSE endpoint with fast processing
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: any) => {
        const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(event));
      };

      // Send immediate events
      sendEvent('log', { type: 'system', message: '🚀 SSE Test Started', timestamp: new Date().toISOString() });
      
      // Simulate quick processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      sendEvent('progress', { type: 'progress', message: 'Processing entity 1...', progress: 25 });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      sendEvent('progress', { type: 'progress', message: 'Processing entity 1...', progress: 50 });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      sendEvent('progress', { type: 'progress', message: 'Processing entity 1...', progress: 75 });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      sendEvent('result', { type: 'final', totalFound: 1, message: 'Test completed successfully' });
      
      controller.close();
    }
  });

  return new Response(stream, { headers });
}