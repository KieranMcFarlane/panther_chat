'use client';

import React from 'react';
import { useThreads } from '@/contexts/ThreadContext';
import { ThreadNotification } from '@/types/thread-system';
import { 
  Bell, 
  BellRing, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Archive,
  Trash2,
  Clock,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NotificationCenterProps {
  className?: string;
}

export default function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const { state, actions, helpers } = useThreads();

  const getNotificationIcon = (type: ThreadNotification['type']) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'insight_found':
        return <div className="w-4 h-4 bg-yellow-400 rounded-full" />;
      case 'resource_discovered':
        return <div className="w-4 h-4 bg-blue-400 rounded-full" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const getNotificationColor = (type: ThreadNotification['type']) => {
    switch (type) {
      case 'task_completed':
        return 'border-green-500/20 bg-green-500/10';
      case 'error':
        return 'border-red-500/20 bg-red-500/10';
      case 'insight_found':
        return 'border-yellow-500/20 bg-yellow-500/10';
      case 'resource_discovered':
        return 'border-blue-500/20 bg-blue-500/10';
      default:
        return 'border-gray-500/20 bg-gray-500/10';
    }
  };

  const handleMarkAsRead = (notification: ThreadNotification) => {
    actions.markNotificationRead(notification.id, notification.threadId);
  };

  const handleMarkAllAsRead = () => {
    state.notifications
      .filter(notif => !notif.isRead)
      .forEach(notif => actions.markNotificationRead(notif.id, notif.threadId));
  };

  const handleGoToThread = (threadId: string) => {
    actions.setActiveThread(threadId);
    actions.setViewMode('threads');
  };

  const handleClearAllNotifications = () => {
    // This would clear all notifications - implement as needed
    console.log('Clear all notifications');
  };

  const unreadNotifications = state.notifications.filter(notif => !notif.isRead);
  const readNotifications = state.notifications.filter(notif => notif.isRead);

  return (
    <div className={`flex flex-col h-full bg-custom-bg ${className}`}>
      {/* Header */}
      <div className="border-b border-custom-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {unreadNotifications.length > 0 ? (
              <BellRing className="w-5 h-5 text-yellow-400" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            Notifications
            {unreadNotifications.length > 0 && (
              <Badge variant="secondary" className="bg-yellow-500 text-black text-xs">
                {unreadNotifications.length}
              </Badge>
            )}
          </h2>
          
          <div className="flex items-center gap-2">
            {unreadNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-gray-400 hover:text-white text-xs"
              >
                Mark all as read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllNotifications}
              className="text-gray-400 hover:text-white text-xs"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {state.notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No notifications yet</p>
            <p className="text-sm mt-2">
              Notifications will appear here when threads complete tasks
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Unread notifications */}
            {unreadNotifications.length > 0 && (
              <>
                <div className="text-sm font-medium text-gray-400 mb-2">
                  Unread ({unreadNotifications.length})
                </div>
                {unreadNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    isRead={false}
                    onMarkAsRead={() => handleMarkAsRead(notification)}
                    onGoToThread={() => handleGoToThread(notification.threadId)}
                    getIcon={getNotificationIcon}
                    getColor={getNotificationColor}
                  />
                ))}
                
                {readNotifications.length > 0 && (
                  <div className="border-t border-custom-border my-4 pt-4">
                    <div className="text-sm font-medium text-gray-400 mb-2">
                      Earlier ({readNotifications.length})
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Read notifications */}
            {readNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isRead={true}
                onMarkAsRead={() => {}}
                onGoToThread={() => handleGoToThread(notification.threadId)}
                getIcon={getNotificationIcon}
                getColor={getNotificationColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-custom-border p-4">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {state.notifications.length} {state.notifications.length === 1 ? 'notification' : 'notifications'}
          </span>
          {unreadNotifications.length > 0 && (
            <span className="text-yellow-400">
              {unreadNotifications.length} unread
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: ThreadNotification;
  isRead: boolean;
  onMarkAsRead: () => void;
  onGoToThread: () => void;
  getIcon: (type: ThreadNotification['type']) => React.ReactNode;
  getColor: (type: ThreadNotification['type']) => string;
}

function NotificationItem({ 
  notification, 
  isRead, 
  onMarkAsRead, 
  onGoToThread, 
  getIcon, 
  getColor 
}: NotificationItemProps) {
  const { helpers } = useThreads();
  const thread = helpers.getThreadById(notification.threadId);

  return (
    <div
      className={`
        ${isRead ? 'opacity-60' : ''}
        ${getNotificationColor(notification.type)}
        border rounded-lg p-3 cursor-pointer hover:opacity-100 transition-all
      `}
      onClick={() => {
        if (!isRead) {
          onMarkAsRead();
        }
        onGoToThread();
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {getIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white font-medium text-sm">{notification.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {new Date(notification.timestamp).toLocaleTimeString()}
              </span>
              {!isRead && (
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              )}
            </div>
          </div>
          
          <p className="text-gray-300 text-sm">{notification.message}</p>
          
          <div className="flex items-center gap-3 mt-2">
            {thread && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-xs text-gray-400">{thread.name}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1">
              <span className={`text-xs px-2 py-0.5 rounded ${
                notification.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                notification.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {notification.priority}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}