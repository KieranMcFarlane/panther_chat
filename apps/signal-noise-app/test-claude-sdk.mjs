import { query } from '@anthropic-ai/claude-agent-sdk';

async function test() {
  try {
    console.log('Testing Claude Agent SDK...');
    console.log('API Key:', process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set');
    console.log('Base URL:', process.env.ANTHROPIC_BASE_URL || 'Not set');
    
    const response = query({
      prompt: 'Say hello',
      options: {
        model: 'claude-3-5-haiku-20241022'
      }
    });
    
    console.log('Query function called, iterating...');
    let messageCount = 0;
    
    for await (const message of response) {
      messageCount++;
      console.log('Message type:', message.type);
      console.log('Message:', message);
    }
    
    console.log('Total messages:', messageCount);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
