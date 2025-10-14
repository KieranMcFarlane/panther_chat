'use client';

import { useEffect, useRef, useState } from 'react';

interface AGUIEvent {
  type: 'agent-start' | 'agent-step' | 'agent-message' | 'agent-tool-use' | 'agent-tool-result' | 'agent-end' | 'agent-error';
  data: any;
  timestamp: string;
  id: string;
}

interface AGUIEventHandlerOptions {
  onAgentStart?: (event: AGUIEvent) => void;
  onAgentMessage?: (event: AGUIEvent) => void;
  onAgentToolUse?: (event: AGUIEvent) => void;
  onAgentToolResult?: (event: AGUIEvent) => void;
  onAgentEnd?: (event: AGUIEvent) => void;
  onAgentError?: (event: AGUIEvent) => void;
  onEvent?: (event: AGUIEvent) => void;
}

export function useAGUIEventHandlers(options: AGUIEventHandlerOptions = {}) {
  const [events, setEvents] = useState<AGUIEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const eventBuffer = useRef<AGUIEvent[]>([]);

  const handleEvent = (event: AGUIEvent) => {
    // Add to events list
    setEvents(prev => [...prev, event]);
    eventBuffer.current.push(event);

    // Call specific handlers
    switch (event.type) {
      case 'agent-start':
        setIsProcessing(true);
        options.onAgentStart?.(event);
        break;
      case 'agent-message':
        options.onAgentMessage?.(event);
        break;
      case 'agent-tool-use':
        options.onAgentToolUse?.(event);
        break;
      case 'agent-tool-result':
        options.onAgentToolResult?.(event);
        break;
      case 'agent-end':
        setIsProcessing(false);
        options.onAgentEnd?.(event);
        break;
      case 'agent-error':
        setIsProcessing(false);
        options.onAgentError?.(event);
        break;
    }

    // Call general handler
    options.onEvent?.(event);
  };

  const clearEvents = () => {
    setEvents([]);
    eventBuffer.current = [];
  };

  const getEventsByType = (type: AGUIEvent['type']) => {
    return events.filter(event => event.type === type);
  };

  const getLastEvent = () => {
    return events[events.length - 1];
  };

  return {
    events,
    isProcessing,
    handleEvent,
    clearEvents,
    getEventsByType,
    getLastEvent,
    eventBuffer: eventBuffer.current
  };
}

// Hook for connecting to AG-UI via EventSource (SSE)
export function useAGUIConnection(url: string, options: AGUIEventHandlerOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { handleEvent, clearEvents } = useAGUIEventHandlers(options);

  useEffect(() => {
    const connect = () => {
      try {
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          console.log('🔗 AG-UI connection established');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'agui-event' && data.event) {
              handleEvent(data.event);
            }
          } catch (err) {
            console.error('Failed to parse AG-UI event:', err);
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          setError('AG-UI connection error');
          console.error('❌ AG-UI connection error');
        };

      } catch (err) {
        setError('Failed to establish AG-UI connection');
        console.error('Failed to create AG-UI connection:', err);
      }
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [url]);

  return {
    isConnected,
    error,
    handleEvent,
    clearEvents
  };
}