import { query } from '@anthropic-ai/claude-agent-sdk';

async function test() {
  try {
    console.log('Testing message structure...\n');
    
    const response = query({
      prompt: 'Say hello briefly',
      options: {
        model: 'claude-3-5-haiku-20241022'
      }
    });
    
    for await (const message of response) {
      console.log('Message type:', message.type);
      console.log('Message subtype:', message.subtype);
      console.log('Message structure:', JSON.stringify(message, null, 2).substring(0, 500));
      console.log('---\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
