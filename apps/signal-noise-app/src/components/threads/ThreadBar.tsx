'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useThreads } from '@/contexts/ThreadContext';
import { ThreadStatus } from '@/types/thread-system';
import { 
  Plus, 
  X, 
  Pin, 
  PinOff, 
  Copy, 
  Share2, 
  Settings, 
  ChevronDown,
  Search,
  Filter,
  History,
  Grid3x3,
  Bell,
  BellRing,
  Play,
  Pause,
  CheckCircle,
  Clock,
  AlertCircle,
  Brain,
  Database,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { THREAD_TEMPLATES, ThreadTemplate } from '@/types/thread-system';

interface ThreadBarProps {
  className?: string;
}

export default function ThreadBar({ className = '' }: ThreadBarProps) {
  const { 
    state, 
    actions, 
    helpers 
  } = useThreads();
  
  const [draggedThreadId, setDraggedThreadId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredThreads = helpers.getFilteredThreads();
  const unreadCount = helpers.getUnreadNotificationCount();

  // Auto-scroll to active thread
  useEffect(() => {
    if (state.activeThreadId && scrollContainerRef.current) {
      const activeThreadElement = scrollContainerRef.current.querySelector(
        `[data-thread-id="${state.activeThreadId}"]`
      ) as HTMLElement;
      
      if (activeThreadElement) {
        activeThreadElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
      }
    }
  }, [state.activeThreadId]);

  const handleDragStart = (e: React.DragEvent, threadId: string) => {
    setDraggedThreadId(threadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedThreadId) {
      const draggedThread = filteredThreads.find(thread => thread.id === draggedThreadId);
      if (draggedThread) {
        const newThreads = [...filteredThreads];
        const dragIndex = newThreads.findIndex(thread => thread.id === draggedThreadId);
        
        if (dragIndex !== dropIndex) {
          newThreads.splice(dragIndex, 1);
          newThreads.splice(dropIndex, 0, draggedThread);
          // Reorder threads (this would need to be implemented in the context)
          // actions.reorderThreads(newThreads);
        }
      }
    }
    setDraggedThreadId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedThreadId(null);
    setDragOverIndex(null);
  };

  const createNewThread = async (template: ThreadTemplate, name?: string) => {
    await actions.createThread(template, name);
  };

  const startThreadExecution = (threadId: string) => {
    const thread = helpers.getThreadById(threadId);
    if (thread) {
      actions.startExecution(
        threadId, 
        'Starting Claude Agent SDK execution', 
        'chat',
        'Processing with AI and MCP tools',
        30000 // 30 seconds estimated
      );
      
      // Simulate async execution (in real implementation, this would call the API)
      setTimeout(() => {
        actions.addNotification(threadId, {
          type: 'task_completed',
          title: 'Processing Complete',
          message: 'Thread has finished processing and is ready for interaction',
          priority: 'medium'
        });
        actions.completeExecution(threadId, 'Thread processing completed successfully');
      }, 3000);
    }
  };

  const getStatusIcon = (status: ThreadStatus) => {
    switch (status) {
      case 'idle':
        return <Clock className="w-3 h-3" />;
      case 'thinking':
        return <Brain className="w-3 h-3 animate-pulse" />;
      case 'processing':
        return <Play className="w-3 h-3" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3" />;
      case 'error':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: ThreadStatus) => {
    switch (status) {
      case 'idle':
        return 'text-gray-400';
      case 'thinking':
        return 'text-blue-400';
      case 'processing':
        return 'text-yellow-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getThreadTypeIcon = (tags: string[]) => {
    if (tags.includes('research')) return <Search className="w-4 h-4" />;
    if (tags.includes('analysis')) return <Brain className="w-4 h-4" />;
    if (tags.includes('rfp')) return <Lightbulb className="w-4 h-4" />;
    if (tags.includes('entities') || tags.includes('knowledge-graph')) return <Database className="w-4 h-4" />;
    return <Grid3x3 className="w-4 h-4" />;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 't':
          e.preventDefault();
          actions.createThread('quick_research');
          break;
        case 'w':
          e.preventDefault();
          if (state.activeThreadId) {
            actions.deleteThread(state.activeThreadId);
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const threadIndex = parseInt(e.key) - 1;
          if (threadIndex < filteredThreads.length) {
            actions.setActiveThread(filteredThreads[threadIndex].id);
          }
          break;
      }
    }
  };

  return (
    <div className={`flex flex-col bg-custom-box border-b border-custom-border ${className}`}>
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-custom-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.setViewMode('threads')}
            className={`p-2 ${state.viewMode === 'threads' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.setViewMode('teams-store')}
            className={`p-2 ${state.viewMode === 'teams-store' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <Database className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.setViewMode('notifications')}
            className={`p-2 relative ${state.viewMode === 'notifications' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            {unreadCount > 0 ? (
              <BellRing className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search threads..."
              value={state.filters.tags?.join(', ') || ''}
              onChange={(e) => actions.setFilters({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
              className="pl-8 bg-custom-bg border-custom-border text-white placeholder-gray-400 w-48 h-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="p-2 text-gray-400 hover:text-white">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-custom-box border-custom-border">
              <DropdownMenuItem 
                onClick={() => actions.setFilters({ status: undefined })}
                className={!state.filters.status ? 'bg-yellow-500 text-black' : 'text-gray-300'}
              >
                All Threads
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => actions.setFilters({ status: 'idle' })}
                className={state.filters.status === 'idle' ? 'bg-yellow-500 text-black' : 'text-gray-300'}
              >
                <Clock className="w-4 h-4 mr-2" />
                Idle
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => actions.setFilters({ status: 'processing' })}
                className={state.filters.status === 'processing' ? 'bg-yellow-500 text-black' : 'text-gray-300'}
              >
                <Play className="w-4 h-4 mr-2" />
                Processing
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => actions.setFilters({ status: 'completed' })}
                className={state.filters.status === 'completed' ? 'bg-yellow-500 text-black' : 'text-gray-300'}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Completed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {filteredThreads.length} {filteredThreads.length === 1 ? 'thread' : 'threads'}
          </span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="bg-red-500 text-white text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>
      </div>

      {/* Thread Strip */}
      <div 
        ref={scrollContainerRef}
        className="flex items-center overflow-x-auto scrollbar-hide"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="flex items-center p-1">
          {/* New Thread Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-custom-border rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-custom-box border-custom-border">
              <DropdownMenuItem onClick={() => createNewThread('quick_research')}>
                <Search className="w-4 h-4 mr-2" />
                Quick Research
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createNewThread('deep_analysis')}>
                <Brain className="w-4 h-4 mr-2" />
                Deep Analysis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createNewThread('rfp_monitoring')}>
                <Lightbulb className="w-4 h-4 mr-2" />
                RFP Monitoring
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createNewThread('entity_mapping')}>
                <Database className="w-4 h-4 mr-2" />
                Entity Mapping
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Threads */}
          {filteredThreads.map((thread, index) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === state.activeThreadId}
              isDragging={draggedThreadId === thread.id}
              dragOverIndex={dragOverIndex === index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              index={index}
              onStartExecution={() => startThreadExecution(thread.id)}
              getStatusIcon={getStatusIcon}
              getStatusColor={getStatusColor}
              getThreadTypeIcon={getThreadTypeIcon}
            />
          ))}

          {/* Overflow indicator */}
          {scrollContainerRef.current && 
           scrollContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth && (
            <div className="flex-shrink-0 w-2 h-8 bg-gradient-to-l from-custom-box to-transparent" />
          )}
        </div>
      </div>
    </div>
  );
}

interface ThreadItemProps {
  thread: any;
  isActive: boolean;
  isDragging: boolean;
  dragOverIndex: number | null;
  onDragStart: (e: React.DragEvent, threadId: string) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  index: number;
  onStartExecution: () => void;
  getStatusIcon: (status: ThreadStatus) => React.ReactNode;
  getStatusColor: (status: ThreadStatus) => string;
  getThreadTypeIcon: (tags: string[]) => React.ReactNode;
}

function ThreadItem({ 
  thread, 
  isActive, 
  isDragging, 
  dragOverIndex, 
  onDragStart, 
  onDragOver, 
  onDrop, 
  onDragEnd,
  index,
  onStartExecution,
  getStatusIcon,
  getStatusColor,
  getThreadTypeIcon
}: ThreadItemProps) {
  const { actions, helpers } = useThreads();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(thread.name);

  const handleRename = () => {
    if (editName.trim() && editName !== thread.name) {
      actions.updateThread(thread.id, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(thread.name);
      setIsEditing(false);
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditName(thread.name);
  };

  const isProcessing = helpers.isThreadProcessing(thread.id);
  const hasUnreadActivity = thread.hasUnreadActivity;

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, thread.id)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      data-thread-id={thread.id}
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 min-w-0
        ${isActive 
          ? 'bg-yellow-500 text-black shadow-lg' 
          : 'text-gray-400 hover:text-white hover:bg-custom-border'
        }
        ${isDragging ? 'opacity-50' : ''}
        ${dragOverIndex === index ? 'border-t-2 border-yellow-500' : ''}
        ${thread.isPinned ? 'font-semibold' : ''}
      `}
      onClick={() => actions.setActiveThread(thread.id)}
    >
      {/* Thread type icon */}
      <span className="flex-shrink-0">
        {getThreadTypeIcon(thread.tags)}
      </span>

      {/* Status indicator */}
      <div className={`flex-shrink-0 ${getStatusColor(thread.status)}`}>
        {getStatusIcon(thread.status)}
      </div>

      {/* Bell notification */}
      {hasUnreadActivity && (
        <div className="flex-shrink-0 relative">
          <Bell className="w-3 h-3 text-yellow-400" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        </div>
      )}

      {/* Thread name */}
      {isEditing ? (
        <Input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className="flex-1 h-6 px-1 text-sm bg-transparent border-b border-current"
          autoFocus
        />
      ) : (
        <span 
          className="flex-1 truncate text-sm font-medium"
          onDoubleClick={handleDoubleClick}
          title={thread.name}
        >
          {thread.name}
        </span>
      )}

      {/* Pin indicator */}
      {thread.isPinned && (
        <Pin className="w-3 h-3 flex-shrink-0" />
      )}

      {/* Message count badge */}
      {thread.messages.length > 0 && (
        <span className="flex-shrink-0 px-1 py-0.5 text-xs rounded-full bg-current bg-opacity-20">
          {thread.messages.length}
        </span>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex-shrink-0">
          <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Thread actions */}
      {!isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 p-1 h-6 w-6 hover:bg-current hover:bg-opacity-10 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-custom-box border-custom-border" align="end">
            <DropdownMenuItem onClick={() => actions.setActiveThread(thread.id)}>
              Focus Thread
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              Rename
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => actions.updateThread(thread.id, { isPinned: !thread.isPinned })}>
              {thread.isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
              {thread.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>

            {!isProcessing && thread.status === 'idle' && (
              <DropdownMenuItem onClick={onStartExecution}>
                <Play className="w-4 h-4 mr-2" />
                Start Processing
              </DropdownMenuItem>
            )}

            {isProcessing && (
              <DropdownMenuItem>
                <Pause className="w-4 h-4 mr-2" />
                Pause Processing
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem 
              onClick={() => actions.deleteThread(thread.id)}
              className="text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4 mr-2" />
              Close Thread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Quick close button */}
      {!isEditing && (
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0 p-1 h-6 w-6 hover:bg-current hover:bg-opacity-10 rounded"
          onClick={(e) => {
            e.stopPropagation();
            actions.deleteThread(thread.id);
          }}
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}