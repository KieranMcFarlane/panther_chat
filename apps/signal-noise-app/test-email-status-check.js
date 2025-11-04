#!/usr/bin/env node

/**
 * Email Status Check and Troubleshooting Script
 */

const { Resend } = require('resend');

async function checkEmailStatus() {
  console.log('🔍 Checking email delivery status and troubleshooting...\n');
  
  // Let's try to get recent emails from Resend
  const resend = new Resend('re_UnF3FXE5_6kPzg3EgZaxT8UEsC2m4Bzgm');
  
  try {
    console.log('📧 Testing a new simple email...');
    
    const result = await resend.emails.send({
      from: 'Test <test@resend.dev>',
      to: ['kieranmcfarlane2@googlemail.com'],
      subject: 'Signal Noise - Status Check',
      text: 'This is a status check email to verify delivery. Please reply if you receive this!',
      html: `
        <h2>🔍 Signal Noise App Status Check</h2>
        <p><strong>If you receive this email, the Resend integration is working!</strong></p>
        <p>Test details:</p>
        <ul>
          <li>✅ Resend API working</li>
          <li>✅ Email service migration complete</li>
          <li>✅ Ready for RFP notifications</li>
        </ul>
        <p><em>Sent: ${new Date().toISOString()}</em></p>
      `
    });
    
    console.log('✅ Status check email sent!');
    console.log('📧 Email ID:', result.id);
    console.log('📧 Check your inbox for subject: "Signal Noise - Status Check"');
    
    // Wait and check status
    setTimeout(async () => {
      try {
        const status = await resend.emails.get(result.id);
        console.log('\n📊 Email Delivery Status:');
        console.log('   Status:', status.status);
        console.log('   Delivered:', status.delivered || false);
        console.log('   Delivered At:', status.delivered_at || 'Not yet delivered');
        console.log('   Last Event:', status.last_event || 'No events recorded');
        
        if (!status.delivered) {
          console.log('\n⚠️  Email not yet delivered. This could be normal for:');
          console.log('   • Gmail processing delays (usually <5 minutes)');
          console.log('   • Email still in transit');
          console.log('   • Server-side processing');
          
          console.log('\n📧 Suggestions:');
          console.log('   1. Check your Gmail inbox in 5-10 minutes');
          console.log('   2. Check your Spam/Junk folders');
          console.log('   3. Look for the email with subject: "Signal Noise - Status Check"');
        } else {
          console.log('\n🎉 Email delivered successfully! Migration is working!');
        }
        
        return status;
        
      } catch (error) {
        console.log('❌ Could not fetch email status:', error.message);
        console.log('\n📧 Possible issues:');
        console.log('   • API rate limiting');
        console.log('   • Temporary server issues');
        console.log('   • Invalid email ID format');
        
        return null;
      }
    }, 8000); // Wait 8 seconds
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    console.log('\n📧 Common delivery issues:');
    console.log('   • Recipient email filters');
    console.log('   • Gmail spam filters');
    console.log('   • Network connectivity');
    console.log('   • Email provider blocks');
    
    return null;
  }
}

async function testMultipleRecipients() {
  console.log('\n🔄 Testing multiple recipient approaches...\n');
  
  const testEmails = [
    'kieranmcfarlane2@gmail.com'
    // Add other email addresses for testing if needed
  ];
  
  for (const email of testEmails) {
    try {
      const resend = new Resend('re_UnF3FXE5_6kPzg3EgZaxT8UEsC2m4Bzgm');
      
      const result = await resend.emails.send({
        from: 'Signal Noise <test@resend.dev>',
        to: [email],
        subject: `Test to ${email}`,
        text: `Test email to ${email} from Signal Noise App. Sent at ${new Date().toISOString()}`
      });
      
      console.log(`✅ Test email sent to: ${email}`);
      console.log(`   Email ID: ${result.id}`);
      
    } catch (error) {
      console.log(`❌ Failed to send to ${email}: ${error.message}`);
    }
  }
}

// Run the status check
checkEmailStatus().then((status) => {
  if (status && !status.delivered) {
    console.log('\n🔄 Trying alternative approaches...');
    testMultipleRecipients();
  }
});