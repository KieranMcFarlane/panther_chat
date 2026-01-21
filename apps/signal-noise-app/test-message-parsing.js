#!/usr/bin/env node

/**
 * TDD Test: Message Parsing
 * Test that our API can correctly parse different CopilotKit request formats
 */

const testCases = [
  {
    name: 'GraphQL with messages array',
    input: {
      variables: {
        data: {
          messages: [
            {
              id: 'msg1',
              textMessage: {
                role: 'user',
                content: 'make this email more professional'
              }
            }
          ],
          threadId: 'thread123'
        }
      }
    },
    expectedOutput: {
      messages: [{
        role: 'user',
        content: 'make this email more professional',
        id: 'msg1'
      }],
      userId: 'thread123'
    }
  },
  {
    name: 'GraphQL with single prompt',
    input: {
      variables: {
        data: {
          prompt: 'help me write a better email',
          threadId: 'thread456'
        }
      }
    },
    expectedOutput: {
      messages: [{
        role: 'user',
        content: 'help me write a better email',
        id: 'user-message'
      }],
      userId: 'thread456'
    }
  },
  {
    name: 'Legacy REST format',
    input: {
      messages: [
        { role: 'user', content: 'improve this email' },
        { role: 'assistant', content: 'I can help with that' }
      ],
      userId: 'user789'
    },
    expectedOutput: {
      messages: [{
        role: 'user',
        content: 'improve this email'
      }],
      userId: 'user789'
    }
  },
  {
    name: 'Simple prompt format',
    input: {
      prompt: 'make my email sound better'
    },
    expectedOutput: {
      messages: [{
        role: 'user',
        content: 'make my email sound better',
        id: 'simple-prompt'
      }],
      userId: undefined
    }
  }
];

/**
 * Simulate the message parsing logic from our API
 */
function parseMessages(body) {
  let messages = [];
  let userId;

  if (body.variables && body.variables.data && body.variables.data.messages) {
    const copilotMessages = body.variables.data.messages;
    userId = body.variables.data.threadId;
    
    messages = copilotMessages
      .filter((msg) => msg.textMessage && msg.textMessage.role !== 'assistant' || msg.textMessage.content)
      .map((msg) => ({
        role: msg.textMessage.role,
        content: msg.textMessage.content,
        id: msg.id
      }));
  } else if (body.variables && body.variables.data && body.variables.data.prompt) {
    messages = [{
      role: 'user',
      content: body.variables.data.prompt,
      id: 'user-message'
    }];
    userId = body.variables.data.threadId;
  } else if (body.messages && Array.isArray(body.messages)) {
    messages = body.messages.filter((msg) => msg.role === 'user' && msg.content);
    userId = body.userId;
  } else if (body.prompt) {
    messages = [{
      role: 'user',
      content: body.prompt,
      id: 'simple-prompt'
    }];
  } else {
    const possibleMessageFields = ['message', 'query', 'text', 'input'];
    for (const field of possibleMessageFields) {
      if (body[field]) {
        messages = [{
          role: 'user',
          content: body[field],
          id: `extracted-${field}`
        }];
        break;
      }
    }
  }

  return { messages, userId };
}

/**
 * Run the test cases
 */
console.log('🧪 Running Message Parsing Tests\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  
  const result = parseMessages(testCase.input);
  const expected = testCase.expectedOutput;
  
  // Test messages array
  const messagesMatch = JSON.stringify(result.messages) === JSON.stringify(expected.messages);
  const userIdMatch = result.userId === expected.userId;
  
  if (messagesMatch && userIdMatch) {
    console.log('  ✅ PASSED');
    console.log(`  📧 Messages: ${JSON.stringify(result.messages)}`);
    console.log(`  👤 User ID: ${result.userId}`);
    passed++;
  } else {
    console.log('  ❌ FAILED');
    console.log(`  Expected messages: ${JSON.stringify(expected.messages)}`);
    console.log(`  Actual messages: ${JSON.stringify(result.messages)}`);
    console.log(`  Expected userId: ${expected.userId}`);
    console.log(`  Actual userId: ${result.userId}`);
    failed++;
  }
  console.log('');
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All message parsing tests passed!');
  console.log('\nNext Step: Test with actual server by sending a request to /api/copilotkit');
} else {
  console.log('🔧 Need to fix message parsing logic before proceeding');
}