import { NextRequest, NextResponse } from 'next/server';

// EC2 Backend configuration
const CLAUDE_WEBHOOK_URL = "http://13.60.60.50:8001/webhook/chat/no-stream";

// Simple communication function with EC2 backend
async function communicateWithBackend(message: string, sessionId?: string, context: any = {}) {
  // Prepare messages in the format expected by the FastAPI server
  const messages = [
    { role: 'user', content: message }
  ];

  // Create request payload
  const payload = {
    messages,
    context: {
      ...context,
      userId: context.userId || sessionId || 'default',
      sessionId
    },
    userId: context.userId || sessionId || 'default',
    stream: false
  };

  console.log('Sending request to EC2 backend:', CLAUDE_WEBHOOK_URL);
  
  const response = await fetch(CLAUDE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Received response from EC2 backend:', result);
  
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, context = {} } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    try {
      // Communicate with EC2 backend
      console.log('Sending message to EC2 backend:', message);
      const data = await communicateWithBackend(message, sessionId, context);

      // Extract the text content from the Claude response
      let responseText = 'Sorry, I could not process your request.';
      
      if (data && data.content && Array.isArray(data.content)) {
        // Extract text from content array
        const textContent = data.content.find((item: any) => item.type === 'text');
        if (textContent && textContent.text) {
          responseText = textContent.text;
        }
      } else if (data && data.text) {
        responseText = data.text;
      } else if (data && typeof data === 'string') {
        responseText = data;
      } else if (data && data.response) {
        responseText = data.response;
      }

      // Return successful response
      return NextResponse.json({
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
        usage: data.usage || null,
        sessionId,
        backendType: 'EC2'
      });

    } catch (backendError) {
      console.error('Backend connection error:', backendError);
      
      // Fallback response when backend is unavailable
      return NextResponse.json({
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: `I apologize, but I'm having trouble connecting to the AI backend right now. 

Your message was: "${message}"

Please try again later or check if the backend service is running.

Error: ${backendError instanceof Error ? backendError.message : 'Unknown backend error'}`,
        timestamp: new Date().toISOString(),
        error: 'Backend unavailable'
      }, { status: 503 });
    }

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  try {
    let ec2Status = 'unknown';

    // Check EC2 backend connectivity
    try {
      const response = await fetch(CLAUDE_WEBHOOK_URL.replace('/webhook/chat/no-stream', '/health'), {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const healthData = await response.json();
        ec2Status = 'connected';
        return NextResponse.json({ 
          status: 'healthy',
          ec2Backend: ec2Status,
          backendUrl: CLAUDE_WEBHOOK_URL,
          healthData
        }, { status: 200 });
      } else {
        ec2Status = 'failed';
      }
    } catch (error) {
      ec2Status = 'failed';
      console.error('EC2 backend health check failed:', error);
    }

    return NextResponse.json({ 
      status: 'unhealthy',
      ec2Backend: ec2Status,
      backendUrl: CLAUDE_WEBHOOK_URL,
      error: 'EC2 backend is not responding'
    }, { status: 503 });

  } catch (error) {
    return NextResponse.json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}