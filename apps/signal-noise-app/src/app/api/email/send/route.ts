import { NextRequest, NextResponse } from 'next/server';
import { Inbound } from '@inboundemail/sdk';

// Initialize Inbound with your API key
const inbound = new Inbound({
  apiKey: process.env.INBOUND_API_KEY || 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
});

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, from } = await request.json();

    console.log('📧 Email API Called:', {
      to,
      subject,
      from,
      timestamp: new Date().toISOString(),
      apiKey: process.env.INBOUND_API_KEY?.substring(0, 10) + '...'
    });

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    // Send email using Inbound
    const emailData = {
      from: from || 'team@yellowpanther.ai',
      to: to,
      subject: subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">${process.env.EMAIL_COMPANY}</h1>
          <p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 16px;">${process.env.EMAIL_SIGNATURE}</p>
        </div>
        
        <div style="background: white; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #3b82f6;">
            <h2 style="color: #1e293b; margin: 0 0 10px 0; font-size: 20px;">${subject}</h2>
          </div>
          <div style="line-height: 1.6; color: #374151;">
            ${body.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <div style="margin-top: 30px; padding: 25px; background: #f8fafc; border-radius: 12px; text-align: center; border: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
              <span style="color: white; font-weight: bold; font-size: 18px;">YP</span>
            </div>
            <div style="text-align: left;">
              <h3 style="margin: 0; color: #1e293b; font-size: 16px;">${process.env.EMAIL_COMPANY}</h3>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Digital Transformation Solutions</p>
            </div>
          </div>
          <p style="margin: 15px 0 0 0; font-size: 13px; color: #64748b;">
            📧 <a href="mailto:team@${process.env.EMAIL_FROM_DOMAIN}" style="color: #3b82f6; text-decoration: none;">team@${process.env.EMAIL_FROM_DOMAIN}</a> | 
            🌐 <a href="https://${process.env.EMAIL_FROM_DOMAIN}" style="color: #3b82f6; text-decoration: none;">${process.env.EMAIL_FROM_DOMAIN}</a>
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8;">
            Leading sports organizations into the digital age
          </p>
        </div>
      </div>`
    };

    console.log('📤 Sending email via Inbound SDK:', {
      emailData,
      isDemoKey: process.env.INBOUND_API_KEY === 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
    });

    // Override the from address to use professional domain
    const professionalEmailData = {
      ...emailData,
      from: `${process.env.EMAIL_FROM_NAME} <team@${process.env.EMAIL_FROM_DOMAIN}>`,
      replyTo: emailData.from
    };

    console.log('📤 Sending professional email via Inbound SDK:', {
      from: professionalEmailData.from,
      to: professionalEmailData.to,
      subject: professionalEmailData.subject,
      isDemoKey: process.env.INBOUND_API_KEY === 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
    });

    const { id } = await inbound.emails.send(professionalEmailData);

    console.log('✅ Email sent successfully:', { id, timestamp: new Date().toISOString() });

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      id: id,
      timestamp: new Date().toISOString(),
      isDemoKey: process.env.INBOUND_API_KEY === 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
    });

  } catch (error) {
    console.error('💥 Email send error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      isDemoKey: process.env.INBOUND_API_KEY === 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
    });
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        isDemoKey: process.env.INBOUND_API_KEY === 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}