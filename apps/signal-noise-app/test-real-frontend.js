#!/usr/bin/env node

/**
 * Test Email Improvement with Real Frontend Data
 * Test the system with the actual email content from the compose page
 */

const http = require('http');

// Test with the exact email content I saw in the browser
const testEmailRequest = {
  variables: {
    data: {
      messages: [
        {
          id: 'real-test-frontend',
          textMessage: {
            role: 'user',
            content: 'make my email more professional'
          }
        }
      ],
      threadId: 'real-frontend-test',
      context: {
        emailState: {
          to: 'kieran@sanshu.com',
          subject: 'wordpress',
          content: 'To kieran, can I sell you a wordpress site?'
        }
      }
    }
  }
};

console.log('🧪 Testing Email Improvement with Real Frontend Data');
console.log('Email content from compose page:', {
  to: 'kieran@sanshu.com',
  subject: 'wordpress', 
  content: 'To kieran, can I sell you a wordpress site?'
});

const postData = JSON.stringify(testEmailRequest);

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
  let emailUpdateAction = null;
  
  res.on('data', (chunk) => {
    responseData += chunk;
    
    // Parse for email update actions
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          // Check for email update action
          if (data.type === 'action' && data.action === 'updateEmailContent') {
            emailUpdateAction = data;
            console.log('\n🎯 SUCCESS! Email update action received:');
            console.log(JSON.stringify(data.args, null, 2));
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    }
  });
  
  res.on('end', () => {
    console.log('\n✅ Test Completed');
    
    if (emailUpdateAction) {
      console.log('\n📧 EMAIL IMPROVEMENT SUCCESSFUL:');
      console.log(`Subject: ${emailUpdateAction.args.subject}`);
      console.log(`To: ${emailUpdateAction.args.to}`);
      console.log(`Content: ${emailUpdateAction.args.content.substring(0, 200)}...`);
      
      // Verify the improvement
      const improvedContent = emailUpdateAction.args.content.toLowerCase();
      const professionalWords = ['dear', 'regards', 'professional', 'services', 'opportunity'];
      const foundProfessional = professionalWords.some(word => improvedContent.includes(word));
      
      if (foundProfessional) {
        console.log('\n🎉 EXCELLENT: Email was made more professional!');
      } else {
        console.log('\n⚠️  Email may need further professional improvement');
      }
    } else {
      console.log('\n❌ No email update action received');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('1. The compose page should now show an "improved email" option');
    console.log('2. Test with the actual compose page UI');
    console.log('3. Verify accept/reject buttons work correctly');
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.setTimeout(60000);
req.write(postData);
req.end();

console.log('\n⏳ Testing with real email content from compose page...');