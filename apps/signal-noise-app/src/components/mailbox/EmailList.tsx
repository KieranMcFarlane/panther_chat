'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Email } from './Mailbox';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Filter, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailListProps {
  emails: Email[];
  selectedEmail: Email | null;
  onEmailSelect: (email: Email) => void;
  folder: string;
  unreadCount: number;
  onCompose?: () => void;
}

// Client-side only date formatting to avoid hydration errors
function formatEmailTime(date: Date): string {
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'MMM d');
}

function formatEmailDate(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'MMM d');
}

export function EmailList({
  emails,
  selectedEmail,
  onEmailSelect,
  folder,
  unreadCount,
  onCompose,
}: EmailListProps) {
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const folderLabel = folder.charAt(0).toUpperCase() + folder.slice(1);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">
            {folderLabel} {unreadCount > 0 && folder === 'inbox' && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({unreadCount} new)
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="gap-2"
            onClick={() => router.push('/compose')}
          >
            <PlusCircle className="h-4 w-4" />
            New Message
          </Button>
        </div>
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {emails.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
              <p>No emails in {folderLabel.toLowerCase()}</p>
            </div>
          ) : (
            emails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              const isUnread = !email.read;
              const matchScore = (email as any).matchScore || 0;
              const matchScoreEmoji = matchScore >= 70 ? '🌤️' : matchScore >= 50 ? '🌥️' : '🧊';

              return (
                <div
                  key={email.id}
                  onClick={() => onEmailSelect(email)}
                  className={cn(
                    'cursor-pointer border-l-4 transition-colors hover:bg-accent/50',
                    isSelected
                      ? 'border-l-primary bg-accent'
                      : isUnread
                      ? 'border-l-primary/50 bg-card'
                      : 'border-l-transparent bg-card',
                    'px-6 py-4'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            'truncate font-medium',
                            isUnread ? 'font-semibold' : 'font-normal'
                          )}
                        >
                          {email.fromName}
                        </span>
                        {matchScore > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {matchScoreEmoji} {matchScore}%
                          </span>
                        )}
                        {email.tags && email.tags.length > 0 && (
                          <div className="flex gap-1">
                            {email.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            'truncate',
                            isUnread ? 'font-semibold' : 'font-normal'
                          )}
                        >
                          {email.subject}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'truncate text-sm text-muted-foreground',
                          isUnread && 'text-foreground'
                        )}
                      >
                        — {email.preview}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isClient ? (
                        <>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatEmailDate(email.date)}
                          </span>
                          {isToday(email.date) && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(email.date, 'HH:mm')}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Loading...
                        </span>
                      )}
                      {isUnread && (
                        <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
