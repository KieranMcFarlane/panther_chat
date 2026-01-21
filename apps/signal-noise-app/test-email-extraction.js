#!/usr/bin/env node

/**
 * TDD Test: Extract Email from Claude Agent SDK Result
 * Test extracting improved email from Claude Agent SDK's result field
 */

const http = require('http');

// Test data that we know works
const testData = {
  variables: {
    data: {
      messages: [
        {
          id: 'test-extraction',
          textMessage: {
            role: 'user',
            content: 'Current email:\nSubject: meeting tomorrow\nTo: john.doe@company.com\nContent: hey john, wanna meet tomorrow to talk about the project? let me know what time works. cheers, alex\n\nPlease make this email more professional.'
          }
        }
      ],
      threadId: 'extraction-test'
    }
  }
};

console.log('🧪 Testing Email Extraction from Claude Agent SDK Response\n');
console.log('Strategy: Include email in user message and extract improved version from result');

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/copilotkit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`\n📡 Response Status: ${res.statusCode}`);
  
  let responseData = '';
  let agentEndEvent = null;
  
  res.on('data', (chunk) => {
    responseData += chunk;
    
    // Parse streaming data for AGUI events
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          // Look for agent-end events which contain the final result
          if (data.type === 'agui-event' && 
              data.event && 
              data.event.type === 'agent-end') {
            agentEndEvent = data.event;
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    }
  });
  
  res.on('end', () => {
    console.log('\n✅ Email Extraction Test Completed');
    
    if (agentEndEvent && agentEndEvent.data && agentEndEvent.data.finalResponse) {
      const finalResponse = agentEndEvent.data.finalResponse;
      console.log('\n📧 Final AI Response Extracted:');
      console.log(finalResponse);
      
      // Test Case 1: Response contains professional email
      if (finalResponse.includes('Dear John') && 
          finalResponse.includes('Best regards') &&
          finalResponse.includes('Project Meeting')) {
        console.log('\n🎉 TEST PASSED: Professional email generated successfully');
        console.log('✅ Contains proper greeting');
        console.log('✅ Contains professional closing');
        console.log('✅ Contains improved subject');
      } else {
        console.log('\n❌ TEST FAILED: Email improvements not found');
      }
      
      // Test Case 2: Extract structured email data
      const subjectMatch = finalResponse.match(/\*\*Subject:\*\* ([^\n]+)/);
      const contentMatch = finalResponse.match(/\*\*Content:\*\*\n\n([\s\S]+?)(?=\n\n|\n$|$)/);
      
      if (subjectMatch && contentMatch) {
        console.log('\n🎉 TEST PASSED: Structured email extraction successful');
        console.log(`📧 Subject: ${subjectMatch[1].trim()}`);
        console.log(`📧 Content: ${contentMatch[1].trim()}`);
        
        // Test Case 3: Email content is professional
        const improvedContent = contentMatch[1].trim();
        const professionalWords = ['Dear', 'hope this email finds you well', 'Thank you', 'Best regards'];
        const professionalCount = professionalWords.filter(word => 
          improvedContent.toLowerCase().includes(word.toLowerCase())
        ).length;
        
        if (professionalCount >= 3) {
          console.log(`🎉 TEST PASSED: Email contains ${professionalCount}/4 professional elements`);
        } else {
          console.log(`⚠️  WARNING: Email only contains ${professionalCount}/4 professional elements`);
        }
        
      } else {
        console.log('\n❌ TEST FAILED: Could not extract structured email data');
      }
      
    } else {
      console.log('\n❌ TEST FAILED: No agent-end event with final response found');
      console.log('Agent events found:', agentEndEvent ? 'yes' : 'no');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.setTimeout(60000);
req.write(postData);
req.end();

console.log('\n⏳ Testing email extraction from Claude Agent SDK response...');