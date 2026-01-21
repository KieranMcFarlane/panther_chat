'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { MailboxSidebar } from './MailboxSidebar';
import { EmailList } from './EmailList';
import { EmailDetails } from './EmailDetails';
import { ComposeEmail } from './ComposeEmail';
import { Inbox, Send, Archive, Trash2, Star } from 'lucide-react';

export interface Email {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  body: string;
  date: Date;
  read: boolean;
  folder: string;
  tags?: string[];
  matchScore?: number;
}

interface MailboxProps {
  initialEmails?: Email[];
}

type Folder = 'inbox' | 'sent' | 'archive' | 'trash' | 'starred';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function Mailbox({ initialEmails = [] }: MailboxProps) {
  const [selectedFolder, setSelectedFolder] = useState<Folder>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ from: string; fromName: string; subject: string } | undefined>();

  // Fetch emails from API
  const { data, error, mutate } = useSWR(
    `/api/mailbox/list?folder=${selectedFolder}`,
    fetcher,
    {
      fallbackData: { emails: initialEmails, total: initialEmails.length, folder: selectedFolder },
      revalidateOnFocus: true,
    }
  );

  const emails: Email[] = data?.emails?.map((email: any) => ({
    ...email,
    date: new Date(email.date),
  })) || [];

  const folders = [
    { id: 'inbox' as Folder, label: 'Inbox', icon: Inbox, count: emails.filter(e => e.folder === 'inbox' && !e.read).length },
    { id: 'starred' as Folder, label: 'Starred', icon: Star, count: 0 },
    { id: 'sent' as Folder, label: 'Sent', icon: Send, count: 0 },
    { id: 'archive' as Folder, label: 'Archive', icon: Archive, count: 0 },
    { id: 'trash' as Folder, label: 'Trash', icon: Trash2, count: 0 },
  ];

  const unreadCount = emails.filter(e => e.folder === 'inbox' && !e.read).length;

  const handleSendEmail = () => {
    mutate(); // Refresh email list after sending
  };

  const handleReply = (email: Email) => {
    setReplyTo({
      from: email.from,
      fromName: email.fromName,
      subject: email.subject,
    });
    setComposeOpen(true);
  };

  return (
    <div className="flex h-full w-full bg-background">
      {/* Mailbox Sidebar */}
      <MailboxSidebar
        folders={folders}
        selectedFolder={selectedFolder}
        onFolderSelect={setSelectedFolder}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Email List */}
        <div className={`flex flex-1 overflow-hidden ${selectedEmail ? 'border-r border-border' : ''}`}>
          <EmailList
            emails={emails}
            selectedEmail={selectedEmail}
            onEmailSelect={setSelectedEmail}
            folder={selectedFolder}
            unreadCount={unreadCount}
            onCompose={() => {
              setReplyTo(undefined);
              setComposeOpen(true);
            }}
          />
          
          {/* Email Details */}
          {selectedEmail && (
            <EmailDetails
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onReply={() => handleReply(selectedEmail)}
            />
          )}
        </div>
      </div>

      {/* Compose Email Dialog */}
      <ComposeEmail
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setReplyTo(undefined);
        }}
        onSend={handleSendEmail}
        replyTo={replyTo}
      />
    </div>
  );
}

