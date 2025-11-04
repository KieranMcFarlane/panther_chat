// Test endpoint to demonstrate SSE differences
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
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

      // Send test events
      sendEvent('connected', { message: 'SSE test started', timestamp: new Date().toISOString() });
      
      for (let i = 1; i <= 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        sendEvent('progress', { step: i, message: `Processing step ${i}`, timestamp: new Date().toISOString() });
      }
      
      sendEvent('completed', { message: 'Test complete', timestamp: new Date().toISOString() });
      controller.close();
    }
  });

  return new Response(stream, { headers });
}