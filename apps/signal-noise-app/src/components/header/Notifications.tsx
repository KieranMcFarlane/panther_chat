'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

type GraphitiNotification = {
  insight_id: string;
  insight_type?: 'opportunity' | 'watch_item' | 'operational';
  entity_id: string;
  title: string;
  short_message: string;
  priority: 'high' | 'medium' | 'low';
  destination_url: string;
  created_at: string;
  sent_state?: string;
  read_state?: string;
}

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<GraphitiNotification[]>([]);
  const unreadCount = notifications.filter((notification) => notification.read_state !== 'read').length;

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/graphiti', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load notifications (${response.status})`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
        }
      } catch (error) {
        if (!cancelled) {
          setNotifications([]);
        }
      }
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleMarkAllAsRead = () => {
    fetch('/api/notifications/graphiti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    }).catch(() => undefined)
    setNotifications((current) => current.map((notification) => ({ ...notification, read_state: 'read' })));
  };

  const handleClearAll = () => {
    handleMarkAllAsRead();
    setNotifications([]);
  };

  const handleNotificationOpen = (insightId: string) => {
    fetch('/api/notifications/graphiti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', insight_ids: [insightId] }),
    }).catch(() => undefined)
    setNotifications((current) => current.map((notification) => (
      notification.insight_id === insightId ? { ...notification, read_state: 'read' } : notification
    )));
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20V10" />
            <path d="m18 14-6-6-6 6" />
          </svg>
        );
      case 'operational':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        );
      case 'watch_item':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        );
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-white hover:bg-white/10"
          aria-label="Notifications"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.insight_id}
                className={`p-3 cursor-pointer flex flex-col items-start ${
                  notification.read_state !== 'read' ? 'bg-blue-50/50' : ''
                }`}
                asChild
              >
                <Link href={notification.destination_url} className="flex items-start gap-3 w-full" onClick={() => handleNotificationOpen(notification.insight_id)}>
                  <div className="flex-shrink-0 text-muted-foreground mt-0.5">
                    {getNotificationIcon(notification.insight_type || 'watch_item')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${
                        notification.read_state !== 'read' ? 'text-blue-600' : 'text-foreground'
                      }`}>
                        {notification.title}
                      </span>
                      {notification.read_state !== 'read' && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.short_message}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {notification.priority}
                      </Badge>
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="flex-1 text-xs"
              >
                Mark all as read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="flex-1 text-xs"
              >
                Clear all
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
