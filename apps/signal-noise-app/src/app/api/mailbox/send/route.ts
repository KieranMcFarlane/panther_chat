import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { render } from '@react-email/render';
import EmailTemplate from '@/components/mailbox/EmailTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface SendEmailRequest {
  to: string | string[];
  subject: string;
  body: string;
  textBody?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const { to, subject, body: emailBody, textBody, from, replyTo, cc, bcc, tags } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'noreply@nakanodigital.com';
    const fromName = process.env.RESEND_FROM_NAME || 'Signal Noise';
    const companyName = process.env.EMAIL_COMPANY || 'Signal Noise';
    const logoUrl = process.env.EMAIL_LOGO_URL;

    // Render React Email template to HTML
    const emailHtml = await render(
      EmailTemplate({
        fromName,
        fromEmail,
        subject,
        body: emailBody,
        companyName,
        logoUrl,
      })
    );

    // Prepare email data for Resend
    const emailData: any = {
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: emailHtml,
      text: textBody || emailBody.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
    };

    if (replyTo) {
      emailData.reply_to = replyTo;
    }

    if (cc) {
      emailData.cc = Array.isArray(cc) ? cc : [cc];
    }

    if (bcc) {
      emailData.bcc = Array.isArray(bcc) ? bcc : [bcc];
    }

    if (tags && tags.length > 0) {
      emailData.tags = tags.map(tag => ({ name: 'category', value: tag }));
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error },
        { status: 500 }
      );
    }

    // Store email in Supabase (optional - for mailbox history)
    try {
      const emailRecord = {
        id: data?.id || `email_${Date.now()}`,
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        body: emailBody,
        folder: 'sent',
        read: true,
        sent_at: new Date().toISOString(),
        resend_id: data?.id,
        tags: tags || [],
        created_at: new Date().toISOString(),
      };

      // Try to insert into emails table (if it exists)
      const { error: dbError } = await supabase
        .from('emails')
        .insert(emailRecord);

      if (dbError && dbError.code !== '42P01') {
        // Ignore table doesn't exist error, log others
        console.warn('Could not store email in database:', dbError.message);
      }
    } catch (dbError) {
      // Silently fail if table doesn't exist
      console.warn('Email storage skipped:', dbError instanceof Error ? dbError.message : 'Unknown error');
    }

    return NextResponse.json({
      success: true,
      id: data?.id,
      message: 'Email sent successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
