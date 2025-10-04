import { NextRequest, NextResponse } from 'next/server';
import { Inbound } from '@inboundemail/sdk';

// Initialize Inbound with your API key
const inbound = new Inbound({
  apiKey: process.env.INBOUND_API_KEY || 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
});

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, from } = await request.json();

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
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1a1a1a; margin: 0 0 10px 0;">${subject}</h2>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 8px; border: 1px solid #e9ecef;">
          ${body.replace(/\n/g, '<br>')}
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #6c757d;">
            This email was sent from Yellow Panther Sports Intelligence Platform
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #adb5bd;">
            Digital transformation solutions for the sports industry
          </p>
        </div>
      </div>`
    };

    const { id } = await inbound.emails.send(emailData);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      id: id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
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