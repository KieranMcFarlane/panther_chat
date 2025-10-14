'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface RFPNotification {
  id: string;
  type: 'rfp_detected' | 'analysis_started' | 'analysis_progress' | 'analysis_complete' | 'error';
  timestamp: string;
  data: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface NotificationFilters {
  minFitScore?: number;
  sportTypes?: string[];
  urgencyLevels?: string[];
  organizations?: string[];
}

interface UseRFPNotificationsReturn {
  notifications: RFPNotification[];
  isConnected: boolean;
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  clearAll: () => void;
  updateFilters: (filters: NotificationFilters) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastNotification?: RFPNotification;
}

export function useRFPNotifications(initialFilters?: NotificationFilters): UseRFPNotificationsReturn {
  const [notifications, setNotifications] = useState<RFPNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [filters, setFilters] = useState<NotificationFilters>(initialFilters || {});
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    reconnectAttempts.current = 0;

    // Build URL with filters
    const params = new URLSearchParams();
    if (filters.minFitScore) params.append('minFitScore', filters.minFitScore.toString());
    if (filters.sportTypes) params.append('sportTypes', filters.sportTypes.join(','));
    if (filters.urgencyLevels) params.append('urgencyLevels', filters.urgencyLevels.join(','));
    if (filters.organizations) params.append('organizations', filters.organizations.join(','));

    const url = `/api/notifications/rfp-stream${params.toString() ? '?' + params.toString() : ''}`;
    
    console.log('🔔 Connecting to RFP notification stream...');
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ RFP notification stream connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connection_established':
            console.log('🎉 Connection confirmed:', data.clientId);
            break;
            
          case 'heartbeat':
            // Heartbeat received, connection is alive
            break;
            
          case 'historical_notification':
          case 'notification':
            const notification: RFPNotification = data.notification;
            console.log(`📨 New RFP notification: ${notification.type}`, notification.data);
            
            setNotifications(prev => {
              // Avoid duplicates
              if (prev.some(n => n.id === notification.id)) {
                return prev;
              }
              return [notification, ...prev].slice(0, 50); // Keep last 50
            });
            break;
            
          default:
            console.log('Unknown notification type:', data.type);
        }
      } catch (error) {
        console.error('Failed to parse notification:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ RFP notification stream error:', error);
      setIsConnected(false);
      setConnectionStatus('error');
      eventSource.close();

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        console.log(`🔄 Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts} in ${backoffDelay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffDelay);
      } else {
        console.error('❌ Max reconnection attempts reached');
        setConnectionStatus('error');
      }
    };

  }, [filters]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    reconnectAttempts.current = 0;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const markAsRead = useCallback((notificationId: string) => {
    setReadNotifications(prev => new Set([...prev, notificationId]));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setReadNotifications(new Set());
  }, []);

  const updateFilters = useCallback((newFilters: NotificationFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    // Reconnect with new filters
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  const unreadCount = notifications.filter(n => !readNotifications.has(n.id)).length;
  const lastNotification = notifications[0];

  return {
    notifications,
    isConnected,
    connectionStatus,
    unreadCount,
    markAsRead,
    clearAll,
    updateFilters,
    lastNotification
  };
}

// Export a function to manually trigger notifications (for testing)
export function triggerRFPNotification(notification: Partial<RFPNotification>) {
  return fetch('/api/notifications/rfp-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: notification.type || 'rfp_detected',
      data: notification.data,
      priority: notification.priority || 'MEDIUM'
    })
  });
}