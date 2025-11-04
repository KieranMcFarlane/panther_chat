#!/usr/bin/env node

/**
 * Test script to verify Inbound email sending functionality
 * Sends a test email to kieranmcfarlane2@gmail.com
 */

const fetch = require('node-fetch');

const TEST_EMAIL = {
  to: 'kieranmcfarlane2@gmail.com',
  subject: '🧪 Test Email from Yellow Panther Sports Intelligence Platform',
  body: `Hello Kieran,

This is a test email from the Yellow Panther Sports Intelligence Platform to verify that the Inbound email integration is working correctly.

Test Details:
- Platform: Yellow Panther Sports Intelligence
- Email Service: Inbound API
- Timestamp: ${new Date().toISOString()}
- Test ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}

✅ Email Features Tested:
• Inbound SDK integration
• Email sending functionality  
• HTML email formatting
• Professional email templates

🎯 Next Steps:
1. Verify this email arrives in your Gmail inbox
2. Check email formatting and appearance
3. Test reply functionality if needed
4. Proceed with full email workflow testing

This confirms that the email integration is ready for production use across the Entity Browser, Person Profiles, and Entity Dossier systems.

Best regards,
The Yellow Panther Team
Digital Transformation Solutions for Sports Industry

---
🏆 Yellow Panther Sports Intelligence Platform
📧 team@yellowpanther.ai | 🌐 https://yellowpanther.ai`,
  from: 'team@yellowpanther.ai'
};

async function testInboundEmail() {
  console.log('🚀 Testing Inbound email integration...');
  console.log('📧 Sending test email to:', TEST_EMAIL.to);
  console.log('📝 Subject:', TEST_EMAIL.subject);
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('─'.repeat(60));

  try {
    const response = await fetch('http://127.0.0.1:3005/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_EMAIL)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ SUCCESS! Email sent successfully');
      console.log('📬 Email ID:', result.id);
      console.log('📊 Response:', JSON.stringify(result, null, 2));
      console.log('─'.repeat(60));
      console.log('🎉 Test completed! Check your Gmail inbox at:', TEST_EMAIL.to);
      console.log('💡 If you received this email, the Inbound integration is working perfectly!');
    } else {
      console.log('❌ FAILED! Email sending failed');
      console.log('📊 Error Response:', JSON.stringify(result, null, 2));
      console.log('🔍 Status Code:', response.status);
      console.log('📝 Status Text:', response.statusText);
    }
  } catch (error) {
    console.log('💥 ERROR! Network or server error occurred');
    console.log('🔍 Error Details:', error.message);
    console.log('💡 Make sure the development server is running on localhost:3005');
  }
}

// Check if development server is running first
async function checkServer() {
  try {
    const response = await fetch('http://127.0.0.1:3005/api/email/send', {
      method: 'OPTIONS'
    });
    console.log('✅ Development server is running and accessible');
    await testInboundEmail();
  } catch (error) {
    console.log('❌ Development server is not running or not accessible');
    console.log('💡 Please start the development server with: npm run dev');
    console.log('🔗 Server should be running on http://127.0.0.1:3005');
    process.exit(1);
  }
}

// Run the test
console.log('🧪 Yellow Panther Email Integration Test');
console.log('==========================================');
checkServer();