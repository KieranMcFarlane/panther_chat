'use client';

import { useState, useEffect } from 'react';
import { Email } from './Mailbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isYesterday } from 'date-fns';
import { X, Reply, ReplyAll, Forward, Archive, Trash2, Star } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface EmailDetailsProps {
  email: Email;
  onClose: () => void;
  onReply?: () => void;
}

function formatEmailDate(date: Date): string {
  if (isToday(date)) {
    return `Today · ${format(date, 'HH:mm')}`;
  }
  if (isYesterday(date)) {
    return `Yesterday · ${format(date, 'HH:mm')}`;
  }
  return format(date, 'PPpp');
}

export function EmailDetails({ email, onClose, onReply }: EmailDetailsProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-background md:w-1/2 lg:w-2/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <h2 className="text-lg font-semibold">Email Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Email Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Email Header */}
          <div className="mb-6">
            <div className="mb-4">
              <h1 className="mb-2 text-2xl font-semibold">{email.subject}</h1>
              {email.tags && email.tags.length > 0 && (
                <div className="flex gap-2 mb-4">
                  {email.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">From:</span>
                <span>{email.fromName}</span>
                <span className="text-muted-foreground">&lt;{email.from}&gt;</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">Date:</span>
                <span>{isClient ? formatEmailDate(email.date) : 'Loading...'}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Email Body */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap text-foreground">{email.body}</div>
          </div>
        </div>
      </ScrollArea>

      {/* Action Bar */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={onReply}>
            <Reply className="h-4 w-4" />
            Reply
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <ReplyAll className="h-4 w-4" />
            Reply All
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Forward className="h-4 w-4" />
            Forward
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="icon">
              <Star className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

