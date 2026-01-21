#!/usr/bin/env node

/**
 * TDD Test: Compare Claude Agent SDK vs CopilotKit Response Processing
 * 
 * This test will help us identify why Claude Agent SDK works but CopilotKit doesn't display responses properly
 */

const fetch = require('node-fetch');

const TEST_CASES = [
  {
    name: 'Simple Sports Question',
    input: 'who are arsenal?',
    expectEmailHelp: false,
    expectSportsResponse: true
  },
  {
    name: 'Email Help Request', 
    input: 'make my email more professional',
    expectEmailHelp: true,
    expectSportsResponse: false
  },
  {
    name: 'General Chat',
    input: 'tell me about manchester united',
    expectEmailHelp: false,
    expectSportsResponse: true
  }
];

class CopilotKitResponseTester {
  constructor() {
    this.baseUrl = 'http://localhost:3005';
    this.results = [];
  }

  async testDirectCopilotKitAPI(testCase) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log(`📝 Input: "${testCase.input}"`);
    
    try {
      // Test 1: Direct CopilotKit API call (like the frontend does)
      console.log(`\n1️⃣ Testing Direct CopilotKit API Call...`);
      
      const copilotkitResponse = await fetch(`${this.baseUrl}/api/copilotkit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            messages: [{
              id: `test-${Date.now()}`,
              textMessage: {
                role: 'user',
                content: testCase.input
              }
            }],
            threadId: `test-thread-${Date.now()}`,
            context: {
              emailState: {
                to: 'test@example.com',
                subject: 'Test Subject',
                content: 'Test email content'
              }
            }
          }
        })
      });

      console.log(`   📊 Status: ${copilotkitResponse.status}`);
      
      if (!copilotkitResponse.ok) {
        const errorText = await copilotkitResponse.text();
        console.log(`   ❌ Error: ${errorText}`);
        return { success: false, error: errorText };
      }

      // Get the response as text
      const responseText = await copilotkitResponse.text();
      console.log(`   📄 Raw Response Length: ${responseText.length} characters`);
      
      // Parse streaming response
      const lines = responseText.split('\n').filter(line => line.trim());
      console.log(`   📝 Response Lines: ${lines.length}`);
      
      let textResponses = [];
      let emailUpdates = [];
      let claudeSDKResponses = [];
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text' && data.text) {
              textResponses.push(data.text);
              console.log(`   💬 Text Response: "${data.text.substring(0, 100)}..."`);
            }
            if (data.type === 'agent-action') {
              emailUpdates.push(data);
              console.log(`   📧 Email Action: ${data.action}`);
            }
          } catch (e) {
            console.log(`   ⚠️  Invalid JSON: ${line.substring(0, 100)}...`);
          }
        }
      }
      
      console.log(`   ✅ Text Responses: ${textResponses.length}`);
      console.log(`   📧 Email Updates: ${emailUpdates.length}`);
      
      return {
        success: true,
        textResponses,
        emailUpdates,
        rawResponse: responseText.substring(0, 500) + '...'
      };

    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testEmailContextDetection(testCase) {
    console.log(`\n2️⃣ Testing Email Context Detection Logic...`);
    
    // Simulate the frontend logic
    const messageText = testCase.input.toLowerCase();
    
    const emailHelpPatterns = [
      'email', 'improve this email', 'make this email', 'help me write', 'professional email',
      'rewrite this email', 'update email', 'edit email', 'make my email', 'improve my email',
      'write an email', 'draft an email', 'email more professional', 'improve my writing',
      'help me improve', 'make this more professional', 'improve this content', 'make this better'
    ];
    
    const sportsQuestionPatterns = [
      'who is', 'who are', 'what is', 'what are', 'tell me about', 'tell me who',
      'information about', 'do you know', 'can you tell me'
    ];
    
    const isSportsQuestion = sportsQuestionPatterns.some(pattern => 
      messageText.startsWith(pattern)
    );
    
    const isAskingForEmailHelp = !isSportsQuestion && emailHelpPatterns.some(pattern => 
      messageText.includes(pattern)
    );
    
    console.log(`   🔍 Sports Question: ${isSportsQuestion}`);
    console.log(`   📧 Email Help: ${isAskingForEmailHelp}`);
    
    return {
      isSportsQuestion,
      isAskingForEmailHelp,
      expectMatches: {
        sports: testCase.expectSportsResponse === isSportsQuestion,
        email: testCase.expectEmailHelp === isAskingForEmailHelp
      }
    };
  }

  async runTest(testCase) {
    const result = {
      name: testCase.name,
      input: testCase.input,
      expectations: testCase,
      timestamp: new Date().toISOString()
    };

    // Test 1: Direct CopilotKit API
    result.copilotkitResult = await this.testDirectCopilotKitAPI(testCase);
    
    // Test 2: Email Context Detection
    result.contextDetection = await this.testEmailContextDetection(testCase);
    
    this.results.push(result);
    
    return result;
  }

  async runAllTests() {
    console.log('🚀 Starting TDD Test: Claude Agent SDK vs CopilotKit Response Comparison\n');
    
    for (const testCase of TEST_CASES) {
      await this.runTest(testCase);
    }
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TDD TEST SUMMARY');
    console.log('='.repeat(80));
    
    let passedTests = 0;
    let totalTests = this.results.length;
    
    for (const result of this.results) {
      console.log(`\n🧪 Test: ${result.name}`);
      console.log(`📝 Input: "${result.input}"`);
      
      // Context Detection Results
      const ctx = result.contextDetection;
      const ctxPassed = ctx.expectMatches.sports && ctx.expectMatches.email;
      
      console.log(`🔍 Context Detection: ${ctxPassed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Sports Question: ${ctx.isSportsQuestion} (expected: ${result.expectations.expectSportsResponse})`);
      console.log(`   Email Help: ${ctx.isAskingForEmailHelp} (expected: ${result.expectations.expectEmailHelp})`);
      
      // CopilotKit API Results
      const ck = result.copilotkitResult;
      if (ck.success) {
        console.log(`📡 CopilotKit API: ✅ PASS (${ck.textResponses.length} text responses, ${ck.emailUpdates.length} email updates)`);
        
        if (ck.textResponses.length > 0) {
          console.log(`   First response: "${ck.textResponses[0].substring(0, 100)}..."`);
        }
      } else {
        console.log(`📡 CopilotKit API: ❌ FAIL - ${ck.error}`);
      }
      
      // Overall test result
      const testPassed = ctxPassed && ck.success;
      if (testPassed) passedTests++;
      
      console.log(`🎯 Overall: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`🏆 FINAL RESULT: ${passedTests}/${totalTests} tests passed`);
    console.log('='.repeat(80));
    
    // Analysis
    const failedTests = this.results.filter(r => 
      !r.contextDetection.expectMatches.sports || 
      !r.contextDetection.expectMatches.email || 
      !r.copilotkitResult.success
    );
    
    if (failedTests.length > 0) {
      console.log('\n🔍 ANALYSIS OF FAILURES:');
      for (const failure of failedTests) {
        console.log(`\n❌ ${failure.name}:`);
        if (!failure.contextDetection.expectMatches.sports) {
          console.log(`   - Sports question detection failed`);
        }
        if (!failure.contextDetection.expectMatches.email) {
          console.log(`   - Email help detection failed`);
        }
        if (!failure.copilotkitResult.success) {
          console.log(`   - CopilotKit API call failed: ${failure.copilotkitResult.error}`);
        }
      }
    }
  }
}

// Run the tests
const tester = new CopilotKitResponseTester();
tester.runAllTests().catch(console.error);