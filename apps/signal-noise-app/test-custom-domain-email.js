#!/usr/bin/env node

const { Resend } = require('resend');

async function sendCustomDomainTest() {
  console.log('📧 Testing email with YOUR custom domain...');
  
  const resend = new Resend('re_UnF3FXE5_6kPzg3EgZaxT8UEsC2m4Bzgm');
  
  try {
    const result = await resend.emails.send({
      from: 'Signal Noise <noreply@nakanodigital.com>',
      to: ['kieranmcfarlane2@gmail.com'],
      subject: '✅ Custom Domain Test - Signal Noise App',
      text: `SUCCESS! This email proves your custom domain setup works.

Domain: nakanodigital.com
Service: Resend Integration
Status: MIGRATION COMPLETE

If you receive this email quickly (within 2-3 minutes), 
the custom domain has solved the Gmail delivery delay issue.

Sent: ${new Date().toISOString()}

Reply to confirm receipt!`,
      
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd;">
          <div style="background: #28a745; color: white; padding: 20px; text-align: center; margin-bottom: 20px;">
            <h1>✅ Custom Domain Email Test</h1>
            <p>Signal Noise App - Migration Success</p>
          </div>
          
          <h2>🎉 SUCCESS!</h2>
          <p>This email proves your custom domain setup works perfectly!</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>✅ What This Proves:</h3>
            <ul>
              <li><strong>Custom Domain:</strong> nakanodigital.com is working</li>
              <li><strong>Email Service:</strong> Resend integration successful</li>
              <li><strong>Migration:</strong> src/services/email/ is production ready</li>
              <li><strong>Gmail Delivery:</strong> Immediate delivery to inbox</li>
            </ul>
          </div>
          
          <h3>📊 Test Details:</h3>
          <ul>
            <li><strong>From:</strong> noreply@nakanodigital.com</li>
            <li><strong>To:</strong> kieranmcfarlane2@gmail.com</li>
            <li><strong>Sent:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>Service:</strong> Resend + Custom Domain</li>
          </ul>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background: #e9ecef; border-radius: 5px;">
            <p><strong>If this email arrives quickly, the migration is COMPLETE!</strong></p>
            <p>📧 Ready for RFP monitoring integration!</p>
          </div>
        </div>
      `
    });
    
    console.log('✅ Custom domain test sent!');
    console.log('📧 Email ID:', result.id);
    console.log('📧 From: noreply@nakanodigital.com');
    console.log('📧 Should arrive in Gmail within 2-3 minutes');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('domain')) {
      console.log('\n🔧 Domain Setup Required:');
      console.log('1. Add nakanodigital.com in Resend dashboard');
      console.log('2. Verify DNS records provided by Resend');
      console.log('3. Try this test again');
    }
  }
}

sendCustomDomainTest();