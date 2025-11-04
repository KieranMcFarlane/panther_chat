'use client';

import { useEffect, useRef, useState } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: string;
  source: string;
  message: string;
  entity_name?: string;
  isHistorical?: boolean;
}

interface SimpleLogViewerProps {
  onLog?: (log: any) => void;
  isPaused?: boolean;
  maxHeight?: string;
}

export default function SimpleLogViewer({ onLog, isPaused = false, maxHeight = '60vh' }: SimpleLogViewerProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const addLog = (log: LogEntry) => {
    if (!isPaused) {
      setLogs(prev => {
        // Keep only last 500 logs to prevent memory issues
        const newLogs = [...prev, log];
        return newLogs.slice(-500);
      });
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const writeLog = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', source = 'System') => {
    const log: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      category: 'claude-agent',
      source,
      message
    };
    addLog(log);
  };

  // Expose functions to parent
  useEffect(() => {
    if (onLog) {
      onLog({
        write: writeLog,
        clear: clearLogs,
        addLog: addLog,
        logs: logs
      });
    }
  }, [onLog, isPaused, logs]);

  // Auto-scroll when new logs are added
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Clear logs when paused state changes
  useEffect(() => {
    if (isPaused) {
      writeLog('⏸️ Log streaming paused', 'info', 'LogViewer');
    } else {
      writeLog('▶️ Log streaming resumed', 'info', 'LogViewer');
    }
  }, [isPaused]);

  const getLogIcon = (level: string, category: string) => {
    if (level === 'error' || level === 'critical') return '🔥';
    if (level === 'warn') return '⚠️';
    if (category === 'claude-agent') return '🤖';
    if (category === 'enrichment') return '⚡';
    if (category === 'system') return '🔧';
    if (level === 'debug') return '🔍';
    return '📝';
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-400';
      case 'error': return 'text-red-300';
      case 'warn': return 'text-yellow-300';
      case 'debug': return 'text-gray-400';
      default: return 'text-green-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Log Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-300">Claude Agent Activity Log</span>
          {isPaused && (
            <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded">
              PAUSED
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {logs.length} logs • Auto-scroll enabled
        </div>
      </div>

      {/* Log Container */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto bg-black font-mono text-sm p-4 space-y-1"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            <div className="mb-2">⏳ Waiting for Claude Agent activity...</div>
            <div className="text-xs">This will show real-time Claude Agent SDK activities</div>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start space-x-2 ${getLogColor(log.level)} ${
                log.isHistorical ? 'opacity-60' : ''
              }`}
            >
              <span className="flex-shrink-0 mt-0.5">
                {getLogIcon(log.level, log.category)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span>
                  <span className="text-gray-400 uppercase">{log.level}</span>
                  {log.source && (
                    <span className="text-gray-500">({log.source})</span>
                  )}
                  {log.entity_name && (
                    <span className="text-blue-400">[{log.entity_name}]</span>
                  )}
                  {log.isHistorical && (
                    <span className="text-gray-500">[HIST]</span>
                  )}
                </div>
                <div className="text-gray-200 break-words">
                  {log.message}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Log Footer */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-2">
        <div className="text-xs text-gray-500 flex items-center justify-between">
          <span>Real-time Claude Agent SDK activity stream</span>
          <span>{logs.filter(log => !log.isHistorical).length} active events</span>
        </div>
      </div>
    </div>
  );
}