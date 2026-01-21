'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LucideIcon } from 'lucide-react';

interface Folder {
  id: string;
  label: string;
  icon: LucideIcon;
  count: number;
}

interface MailboxSidebarProps {
  folders: Folder[];
  selectedFolder: string;
  onFolderSelect: (folder: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function MailboxSidebar({
  folders,
  selectedFolder,
  onFolderSelect,
  open,
  onToggle,
}: MailboxSidebarProps) {
  return (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-300',
        open ? 'w-64' : 'w-16'
      )}
    >
      <div className="flex h-16 items-center border-b border-border px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
            />
          </svg>
        </Button>
        {open && (
          <h2 className="ml-3 text-lg font-semibold">Mailbox</h2>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {folders.map((folder) => {
            const Icon = folder.icon;
            const isActive = selectedFolder === folder.id;
            
            return (
              <Button
                key={folder.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3',
                  open ? 'px-3' : 'px-2',
                  isActive && 'bg-accent'
                )}
                onClick={() => onFolderSelect(folder.id)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {open && (
                  <>
                    <span className="flex-1 text-left">{folder.label}</span>
                    {folder.count > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {folder.count}
                      </span>
                    )}
                  </>
                )}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}











