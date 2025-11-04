'use client';

import React, { useState } from 'react';
import { Bell, X, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNotifications, RealtimeMessage } from '@/lib/realtime';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, dismissNotification, clearAllNotifications } = useNotifications();

  const getIcon = (type: string, priority: string) => {
    if (priority === 'critical') return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (priority === 'high') return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    if (type === 'notification') return <Bell className="h-4 w-4 text-blue-500" />;
    if (type === 'update') return <Info className="h-4 w-4 text-cyan-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative border-slate-600 bg-slate-700/50 text-white hover:bg-slate-600/50"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-hidden bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearAllNotifications}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear all
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No new notifications</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={dismissNotification}
                    getIcon={getIcon}
                    getPriorityColor={getPriorityColor}
                    formatTimestamp={formatTimestamp}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: RealtimeMessage;
  onDismiss: (id: string) => void;
  getIcon: (type: string, priority: string) => React.ReactNode;
  getPriorityColor: (priority: string) => string;
  formatTimestamp: (timestamp: string) => string;
}

function NotificationItem({ 
  notification, 
  onDismiss, 
  getIcon, 
  getPriorityColor, 
  formatTimestamp 
}: NotificationItemProps) {
  return (
    <div className="p-4 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon(notification.type, notification.priority)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white truncate">
                {notification.data.title || 'Notification'}
              </h4>
              <p className="text-sm text-slate-300 mt-1 line-clamp-2">
                {notification.data.message || JSON.stringify(notification.data)}
              </p>
              
              {/* Additional data */}
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                <span className="text-xs text-slate-400">
                  {notification.data.source || notification.type}
                </span>
                <span className="text-xs text-slate-500">
                  {formatTimestamp(notification.timestamp)}
                </span>
              </div>
            </div>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDismiss(notification.id)}
              className="p-1 text-slate-400 hover:text-white flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
