'use client';

import { Mailbox } from '@/components/mailbox/Mailbox';

// Sample email data matching the Sales Intelligence design
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
    date: new Date('2024-12-24T20:17:00'),
    read: false,
    folder: 'inbox',
    tags: ['RFI', 'Premier League', 'Qualified'],
    matchScore: 72,
  },
  {
    id: '2',
    from: 'digital@aeltc.com',
    fromName: 'Wimbledon',
    subject: 'Post‑Championships Digital Review',
    preview: "Let's book a workshop to scope 2026 roadmap.",
    body: `Hello,

Following up on our previous discussion about digital transformation opportunities post-Championships.

We'd like to schedule a call to discuss next steps.

Best,
Wimbledon Digital Team`,
    date: new Date('2024-12-24T15:37:00'),
    read: false,
    folder: 'inbox',
    tags: ['Workshop', 'Tennis', 'Proposal'],
    matchScore: 63,
  },
  {
    id: '3',
    from: 'cto@mlsclub.com',
    fromName: 'MLS Club',
    subject: 'Fan Data Platform brief',
    preview: "We're exploring AI personalization for 24/25 season.",
    body: `Dear Partner,

We're exploring AI personalization for our fan data platform for the 24/25 season.

We'd like to discuss your capabilities in this area.

Regards,
MLS Club CTO`,
    date: new Date('2024-12-23T18:37:00'),
    read: false,
    folder: 'inbox',
    tags: ['AI', 'RFP', 'Contacted'],
    matchScore: 38,
  },
];

export default function MailboxPage() {
  return (
    <div className="h-full w-full">
      <Mailbox initialEmails={sampleEmails} />
    </div>
  );
}

