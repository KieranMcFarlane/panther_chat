import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'inbox';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Try to fetch from Supabase emails table
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('folder', folder)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error && error.code !== '42P01') {
        // Table doesn't exist, return sample data
        throw error;
      }

      if (data) {
        // Transform Supabase data to Email format
        const emails = data.map((email: any) => ({
          id: email.id,
          from: email.from,
          fromName: email.from_name || email.from.split('@')[0],
          subject: email.subject,
          preview: email.preview || email.body?.substring(0, 100) || '',
          body: email.body || '',
          date: new Date(email.sent_at || email.created_at),
          read: email.read || false,
          folder: email.folder || 'inbox',
          tags: email.tags || [],
        }));

        return NextResponse.json({
          emails,
          total: data.length,
          folder,
        });
      }
    } catch (dbError) {
      // Table doesn't exist or other error, return sample data
      console.warn('Using sample email data:', dbError instanceof Error ? dbError.message : 'Unknown error');
    }

    // Return sample data if database table doesn't exist
    const sampleEmails = [
      {
        id: '1',
        from: 'commercial@arsenal.co.uk',
        fromName: 'Arsenal FC',
        subject: 'Website Revamp RFI',
        preview: 'Can you share creds and a rough timeline?',
        body: `Hi there,

We're looking to revamp our website and would like to discuss this opportunity with you.

Could you please share:
- Your credentials and portfolio
- A rough timeline for the project
- Your approach to website redesigns

Looking forward to hearing from you.

Best regards,
Arsenal FC Commercial Team`,
        date: new Date('2024-12-24T20:10:00'),
        read: false,
        folder: 'inbox',
        tags: ['RFI', 'Premier League', 'Qualified'],
      },
      {
        id: '2',
        from: 'wimbledon@aeltc.com',
        fromName: 'Wimbledon',
        subject: 'Post‑Championships Digital Review',
        preview: 'Following up on our previous discussion about digital transformation...',
        body: `Hello,

Following up on our previous discussion about digital transformation opportunities post-Championships.

We'd like to schedule a call to discuss next steps.

Best,
Wimbledon Digital Team`,
        date: new Date('2024-12-24T18:30:00'),
        read: false,
        folder: 'inbox',
        tags: ['Review', 'Digital'],
      },
    ].filter(email => email.folder === folder);

    return NextResponse.json({
      emails: sampleEmails,
      total: sampleEmails.length,
      folder,
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch emails',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}











