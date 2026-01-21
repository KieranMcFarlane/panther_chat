#!/usr/bin/env node

/**
 * TDD Comprehensive Test: End-to-End Email Improvement System
 * Test the complete email improvement implementation
 */

const http = require('http');

// Test Case 1: Email context extraction and message modification
const testCase1 = {
  name: 'Email Context and Message Modification',
  input: {
    variables: {
      data: {
        messages: [
          {
            id: 'test-end-to-end-1',
            textMessage: {
              role: 'user',
              content: 'make this email more professional'
            }
          }
        ],
        threadId: 'end-to-end-test-1',
        context: {
          emailState: {
            to: 'john.doe@company.com',
            subject: 'meeting tomorrow',
            content: 'hey john, wanna meet tomorrow to talk about the project? let me know what time works. cheers, alex'
          }
        }
      }
    }
  },
  expectedResults: {
    shouldModifyMessage: true,
    shouldHaveEmailContext: true,
    shouldGenerateImprovedEmail: true,
    shouldSendActionToFrontend: true
  }
};

// Test Case 2: No email context (should work normally)
const testCase2 = {
  name: 'No Email Context (Normal Operation)',
  input: {
    variables: {
      data: {
        messages: [
          {
            id: 'test-end-to-end-2',
            textMessage: {
              role: 'user',
              content: 'tell me about Arsenal football club'
            }
          }
        ],
        threadId: 'end-to-end-test-2'
      }
    }
  },
  expectedResults: {
    shouldModifyMessage: false,
    shouldHaveEmailContext: false,
    shouldGenerateImprovedEmail: false,
    shouldSendActionToFrontend: false
  }
};

function runTestCase(testCase, callback) {
  console.log(`\n🧪 ${testCase.name}`);
  console.log('=' .repeat(50));
  
  const postData = JSON.stringify(testCase.input);
  
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
    console.log(`📡 Response Status: ${res.statusCode}`);
    
    let responseData = '';
    let events = [];
    let hasEmailAction = false;
    let hasTextResponse = false;
    
    res.on('data', (chunk) => {
      responseData += chunk;
      
      // Parse streaming data
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push(data);
            
            // Check for email update action
            if (data.type === 'action' && data.action === 'updateEmailContent') {
              hasEmailAction = true;
              console.log('🎯 Email update action detected:', data.args);
            }
            
            // Check for text response
            if (data.type === 'text' && data.text) {
              hasTextResponse = true;
            }
          } catch (e) {
            // Skip parsing errors
          }
        }
      }
    });
    
    res.on('end', () => {
      console.log(`\n📊 Results for ${testCase.name}:`);
      console.log(`- Events received: ${events.length}`);
      console.log(`- Text response: ${hasTextResponse ? '✅' : '❌'}`);
      console.log(`- Email action sent: ${hasEmailAction ? '✅' : '❌'}`);
      
      // Analyze results
      const results = {
        eventsReceived: events.length,
        hasTextResponse,
        hasEmailAction,
        events
      };
      
      callback(results);
    });
  });
  
  req.on('error', (error) => {
    console.error(`❌ Request failed for ${testCase.name}:`, error.message);
    callback({ error: error.message });
  });
  
  req.setTimeout(60000);
  req.write(postData);
  req.end();
  
  console.log('⏳ Running test...');
}

// Run all test cases
console.log('🚀 TDD Comprehensive Test: Email Improvement System');
console.log('Testing complete end-to-end email improvement functionality\n');

let completedTests = 0;
const totalTests = 2;

function analyzeAndReportResults(testCase, results) {
  if (results.error) {
    console.log(`❌ ${testCase.name} FAILED: ${results.error}`);
    return;
  }
  
  console.log(`\n🔍 Analysis for ${testCase.name}:`);
  
  let passedTests = 0;
  let totalChecks = 0;
  
  // Check 1: Should modify message (for email context)
  if (testCase.expectedResults.shouldModifyMessage) {
    totalChecks++;
    // This would be verified in server logs, but we can infer from behavior
    if (results.hasEmailAction) {
      console.log('✅ PASSED: Email context properly handled');
      passedTests++;
    } else {
      console.log('❌ FAILED: Email context not properly handled');
    }
  }
  
  // Check 2: Should generate improved email
  if (testCase.expectedResults.shouldGenerateImprovedEmail) {
    totalChecks++;
    if (results.hasEmailAction) {
      console.log('✅ PASSED: Improved email generated');
      passedTests++;
    } else {
      console.log('❌ FAILED: Improved email not generated');
    }
  }
  
  // Check 3: Should send action to frontend
  if (testCase.expectedResults.shouldSendActionToFrontend) {
    totalChecks++;
    if (results.hasEmailAction) {
      console.log('✅ PASSED: Action sent to frontend');
      passedTests++;
    } else {
      console.log('❌ FAILED: Action not sent to frontend');
    }
  }
  
  // Check 4: Should NOT send email action for non-email requests
  if (!testCase.expectedResults.shouldSendActionToFrontend) {
    totalChecks++;
    if (!results.hasEmailAction) {
      console.log('✅ PASSED: No email action sent for non-email request');
      passedTests++;
    } else {
      console.log('❌ FAILED: Email action sent for non-email request');
    }
  }
  
  // Check 5: Should have text response for all requests
  totalChecks++;
  if (results.hasTextResponse) {
    console.log('✅ PASSED: Text response provided');
    passedTests++;
  } else {
    console.log('❌ FAILED: No text response provided');
  }
  
  const successRate = (passedTests / totalChecks) * 100;
  console.log(`\n📈 ${testCase.name}: ${passedTests}/${totalChecks} tests passed (${successRate}%)`);
  
  completedTests++;
  
  if (completedTests === totalTests) {
    console.log('\n🏁 All tests completed!');
    
    // Final summary
    console.log('\n🎯 IMPLEMENTATION STATUS:');
    
    // Check server logs manually for message modification verification
    console.log('\n📋 Manual Verification Required:');
    console.log('1. Check server logs for "📧 Modified user message to include email content directly"');
    console.log('2. Check server logs for "📧 Processing improved email from result..."');
    console.log('3. Check server logs for "✅ Email update action sent to frontend"');
    
    console.log('\n💡 Next Steps:');
    console.log('- If tests pass: Test with actual compose page UI');
    console.log('- If tests fail: Debug server logs for specific issues');
    console.log('- Verify frontend can handle the email update action');
  }
}

// Run tests sequentially
runTestCase(testCase1, (results1) => {
  analyzeAndReportResults(testCase1, results1);
  
  // Wait a bit between tests
  setTimeout(() => {
    runTestCase(testCase2, (results2) => {
      analyzeAndReportResults(testCase2, results2);
    });
  }, 2000);
});