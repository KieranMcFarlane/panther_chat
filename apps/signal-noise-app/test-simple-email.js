#!/usr/bin/env node

const { Resend } = require('resend');

async function sendSimpleTest() {
  console.log('📧 Sending simple plain text email...');
  
  const resend = new Resend('re_UnF3FXE5_6kPzg3EgZaxT8UEsC2m4Bzgm');
  
  try {
    const result = await resend.emails.send({
      from: 'Test <notifications@resend.dev>',
      to: ['kieranmcfarlane2@gmail.com'],
      subject: 'Simple Test - Signal Noise',
      text: `This is a simple test email from Signal Noise App.

If you receive this, the email service is working.

Sent: ${new Date().toISOString()}

Please reply if you get this.`
    });
    
    console.log('✅ Simple test sent!');
    console.log('📧 Email ID:', result.id);
    console.log('📧 Check Gmail in 2-3 minutes');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

sendSimpleTest();