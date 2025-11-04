'use client';

import { useEffect, useRef, useState } from 'react';

export interface RealtimeMessage {
  id: string;
  type: 'notification' | 'update' | 'alert' | 'system';
  data: any;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface RealtimeSubscription {
  channel: string;
  callback: (message: RealtimeMessage) => void;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private eventSource: EventSource | null = null;
  private subscriptions: Map<string, Set<(message: RealtimeMessage) => void>> = new Map();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  connect(): void {
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      return; // Already connected or connecting
    }

    try {
      this.eventSource = new EventSource('/api/realtime/events');

      this.eventSource.onopen = () => {
        console.log('🔗 Realtime connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectInterval();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing realtime message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('Realtime connection error:', error);
        this.isConnected = false;
        this.scheduleReconnect();
      };

    } catch (error) {
      console.error('Failed to establish realtime connection:', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.clearReconnectInterval();
  }

  subscribe(channel: string, callback: (message: RealtimeMessage) => void): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel)!.add(callback);

    // Auto-connect if not already connected
    if (!this.isConnected) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      const channelSubscribers = this.subscriptions.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(callback);
        if (channelSubscribers.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  private handleMessage(message: RealtimeMessage): void {
    // Broadcast to all subscribers of 'all' channel
    const allSubscribers = this.subscriptions.get('all');
    if (allSubscribers) {
      allSubscribers.forEach(callback => callback(message));
    }

    // Broadcast to specific channel subscribers
    const channelSubscribers = this.subscriptions.get(message.type);
    if (channelSubscribers) {
      channelSubscribers.forEach(callback => callback(message));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    this.reconnectInterval = setTimeout(() => {
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
      this.reconnectAttempts++;
      this.clearReconnectInterval();
      this.connect();
    }, delay);
  }

  private clearReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  getConnectionStatus(): { connected: boolean; attempts: number } {
    return {
      connected: this.isConnected,
      attempts: this.reconnectAttempts
    };
  }

  // Simulate sending a message (for testing purposes)
  simulateMessage(type: string, data: any, priority: RealtimeMessage['priority'] = 'medium'): void {
    const message: RealtimeMessage = {
      id: `sim-${Date.now()}`,
      type: type as any,
      data,
      timestamp: new Date().toISOString(),
      priority
    };
    
    setTimeout(() => {
      this.handleMessage(message);
    }, 100);
  }
}

// React hook for using realtime features
export function useRealtime(channel: string = 'all') {
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, attempts: 0 });
  const realtimeService = useRef(RealtimeService.getInstance());

  useEffect(() => {
    const service = realtimeService.current;

    // Subscribe to messages
    const unsubscribe = service.subscribe(channel, (message) => {
      setMessages(prev => [message, ...prev.slice(0, 99)]); // Keep last 100 messages
    });

    // Update connection status
    const statusInterval = setInterval(() => {
      setConnectionStatus(service.getConnectionStatus());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [channel]);

  const clearMessages = () => setMessages([]);
  
  const simulateMessage = (type: string, data: any, priority: RealtimeMessage['priority'] = 'medium') => {
    realtimeService.current.simulateMessage(type, data, priority);
  };

  return {
    messages,
    connectionStatus,
    clearMessages,
    simulateMessage
  };
}

// React hook for notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<RealtimeMessage[]>([]);
  const realtimeService = useRef(RealtimeService.getInstance());

  useEffect(() => {
    const unsubscribe = realtimeService.current.subscribe('notification', (message) => {
      setNotifications(prev => [message, ...prev]);
      
      // Auto-remove notifications after 10 seconds for low priority
      if (message.priority === 'low') {
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== message.id));
        }, 10000);
      }
    });

    return unsubscribe;
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    dismissNotification,
    clearAllNotifications
  };
}

// Mock realtime data generators for development
export const mockRealtimeData = {
  generateRFPAlert: () => ({
    type: 'notification',
    data: {
      title: 'New High-Value RFP Detected',
      message: 'Premier League Mobile App Development - £2.5M opportunity',
      source: 'RFP Monitor',
      relevanceScore: 0.94,
      action: 'View Details'
    },
    priority: 'high' as const
  }),

  generateSignalUpdate: () => ({
    type: 'update',
    data: {
      title: 'Digital Transformation Signal',
      message: 'Brighton FC announces new Head of Digital Innovation role',
      source: 'LinkedIn Intelligence',
      score: 9.2,
      club: 'Brighton & Hove Albion'
    },
    priority: 'medium' as const
  }),

  generateSystemAlert: () => ({
    type: 'alert',
    data: {
      title: 'System Status Update',
      message: 'Knowledge graph updated with 247 new contacts',
      source: 'Neo4j Sync',
      stats: { newContacts: 247, newRelationships: 156 }
    },
    priority: 'low' as const
  }),

  generateCriticalAlert: () => ({
    type: 'alert',
    data: {
      title: 'Critical Opportunity Window',
      message: 'Chelsea FC Digital Strategy role - Application deadline in 24 hours',
      source: 'LinkedIn Monitor',
      urgency: 'critical',
      timeRemaining: '24 hours'
    },
    priority: 'critical' as const
  })
};
