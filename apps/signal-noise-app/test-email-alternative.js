#!/usr/bin/env node

/**
 * Alternative Email Test Script
 * Tests different email formats to troubleshoot delivery issues
 */

const { Resend } = require('resend');

async function testAlternativeEmail() {
  console.log('🔧 Testing alternative email delivery methods...');
  
  const resend = new Resend('re_UnF3FXE5_6kPzg3EgZaxT8UEsC2m4Bzgm');
  
  const emailData = {
    from: 'Kieran Test <kieran@resend.dev>',
    to: ['kieranmcfarlane2@googlemail.com'],
    subject: 'Signal Noise App - Test Message',
    text: 'This is a simple text-only test email to verify delivery.',
    html: '<!DOCTYPE html><html><body><h1>✅ Signal Noise App Test</h1><p>This is a simple test email to verify the Resend integration is working properly.</p><p>If you receive this, the migration is successful!</p><p>Sent: ' + new Date().toISOString() + '</p></body></html>'
  };

  try {
    console.log('📧 Attempting alternative email format...');
    const result = await resend.emails.send(emailData);
    console.log('✅ Alternative email sent successfully!');
    console.log('📧 Email ID:', result.id);
    console.log('📧 Check your inbox for: Signal Noise App - Test Message');
    
    // Wait a moment and check status
    setTimeout(async () => {
      try {
        const status = await resend.emails.get(result.id);
        console.log('📧 Email Status:', status);
        console.log('📧 Delivered:', status.delivered);
        console.log('📧 Delivered At:', status.delivered_at);
      } catch (error) {
        console.log('❌ Could not fetch email status:', error.message);
      }
    }, 5000);
    
    return result;
    
  } catch (error) {
    console.error('❌ Alternative email failed:', error);
    throw error;
  }
}

// Test multiple approaches
async function runEmailTests() {
  console.log('🚀 Running comprehensive email delivery tests...\n');
  
  try {
    await testAlternativeEmail();
    console.log('\n✅ Alternative email test completed!');
    
  } catch (error) {
    console.log('\n❌ Alternative email test failed:', error.message);
    
    console.log('\n🔧 Possible solutions:');
    console.log('1. Check if email is in Spam folder');
    console.log('2. Verify Gmail delivery settings');
    console.log('3. Try a different email address');
    console.log('4. Check if Resend domain is properly verified');
  }
}

// Run the tests
runEmailTests();