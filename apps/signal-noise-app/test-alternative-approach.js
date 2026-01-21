#!/usr/bin/env node

/**
 * TDD Test: Alternative Approach - Process Claude Agent SDK Response
 * Test if we can extract email improvements from Claude Agent SDK's natural response
 */

const http = require('http');

// Test data with email context
const testData = {
  variables: {
    data: {
      messages: [
        {
          id: 'test-alt-approach',
          textMessage: {
            role: 'user',
            content: 'Current email:\nSubject: meeting tomorrow\nTo: john.doe@company.com\nContent: hey john, wanna meet tomorrow to talk about the project? let me know what time works. cheers, alex\n\nPlease make this email more professional.'
          }
        }
      ],
      threadId: 'alt-approach-test',
      context: {
        emailState: {
          to: 'john.doe@company.com',
          subject: 'meeting tomorrow',
          content: 'hey john, wanna meet tomorrow to talk about the project? let me know what time works. cheers, alex'
        }
      }
    }
  }
};

console.log('🧪 Testing Alternative Approach\n');
console.log('Strategy: Include email in user message instead of relying on system prompt');
console.log('Test data:', JSON.stringify(testData, null, 2));

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
  let fullTextResponse = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
    
    // Parse streaming data for text responses
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text' && data.text) {
            fullTextResponse += data.text;
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    }
  });
  
  res.on('end', () => {
    console.log('\n✅ Alternative Approach Test Completed');
    console.log('\n📧 Full AI Response:');
    console.log(fullTextResponse || 'No text response found');
    
    console.log('\n🔍 Analysis:');
    if (fullTextResponse.length > 200) {
      console.log('🎉 PASSED: AI provided substantial response');
    } else {
      console.log('❌ FAILED: Response too short');
    }
    
    // Check for professional language indicators
    const professionalIndicators = [
      'Dear', 'Sincerely', 'Best regards', 'I would like to', 
      'professional', 'formal', 'respectfully', 'regarding'
    ];
    
    const hasProfessionalLanguage = professionalIndicators.some(indicator => 
      fullTextResponse.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasProfessionalLanguage) {
      console.log('🎉 PASSED: Response contains professional language');
    } else {
      console.log('⚠️  WARNING: No professional language detected');
    }
    
    // Check for email improvement patterns
    const improvementPatterns = [
      'Here is a more professional version',
      'I would suggest', 'revised version', 'improved email',
      'professional version', 'better version'
    ];
    
    const hasImprovementPatterns = improvementPatterns.some(pattern => 
      fullTextResponse.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (hasImprovementPatterns) {
      console.log('🎉 PASSED: Response appears to contain email improvements');
    } else {
      console.log('⚠️  WARNING: No clear improvement patterns detected');
    }
    
    console.log('\n💡 Next Steps:');
    if (fullTextResponse.length > 200 && hasProfessionalLanguage) {
      console.log('✅ This approach works! Now implement email content extraction logic');
    } else {
      console.log('❌ This approach needs refinement - try different message formatting');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.setTimeout(60000);
req.write(postData);
req.end();

console.log('\n⏳ Testing alternative approach (including email in user message)...');