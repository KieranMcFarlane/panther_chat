'use client';

import React, { useState, useMemo } from 'react';
import { useTabs } from '@/contexts/TabContext';
import { ChatHistory, Message } from '@/types/tab-system';
import { 
  Search, 
  Calendar, 
  Tag, 
  MessageSquare, 
  Clock, 
  Star, 
  Archive, 
  Download,
  Filter,
  Trash2,
  RotateCcw,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

interface TabHistoryProps {
  className?: string;
}

interface HistoryEntry {
  id: string;
  tabId: string;
  tabName: string;
  tabType: string;
  lastMessage: string;
  messageCount: number;
  timestamp: Date;
  isFavorite: boolean;
  isArchived: boolean;
  tags: string[];
  preview: string;
}

export default function TabHistory({ className = '' }: TabHistoryProps) {
  const { state, actions, helpers } = useTabs();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'favorites' | 'archived'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Generate history entries from tabs
  const historyEntries: HistoryEntry[] = useMemo(() => {
    return state.tabs
      .filter(tab => tab.messages.length > 0) // Only tabs with messages
      .map(tab => {
        const lastMessage = tab.messages[tab.messages.length - 1];
        const preview = tab.messages
          .slice(-3) // Last 3 messages for preview
          .map(msg => msg.content.substring(0, 100))
          .join(' | ');

        return {
          id: `history_${tab.id}`,
          tabId: tab.id,
          tabName: tab.name,
          tabType: tab.type,
          lastMessage: lastMessage?.content || '',
          messageCount: tab.metadata.messageCount,
          timestamp: tab.updatedAt,
          isFavorite: tab.metadata.isFavorite,
          isArchived: tab.metadata.isArchived,
          tags: tab.metadata.tags,
          preview
        };
      });
  }, [state.tabs]);

  // Filter history entries
  const filteredEntries = useMemo(() => {
    let filtered = [...historyEntries];

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.tabName.toLowerCase().includes(query) ||
        entry.preview.toLowerCase().includes(query) ||
        entry.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (selectedFilter === 'favorites') {
      filtered = filtered.filter(entry => entry.isFavorite);
    } else if (selectedFilter === 'archived') {
      filtered = filtered.filter(entry => entry.isArchived);
    }

    // Date filter
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(entry => entry.timestamp >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(entry => entry.timestamp >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(entry => entry.timestamp >= monthAgo);
    }

    // Sort by timestamp (most recent first)
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [historyEntries, searchQuery, selectedFilter, dateFilter]);

  const handleRestoreTab = (tabId: string) => {
    actions.setActiveTab(tabId);
    actions.setViewMode('tabs');
  };

  const handleDuplicateTab = (tabId: string) => {
    actions.duplicateTab(tabId);
    actions.setViewMode('tabs');
  };

  const handleToggleFavorite = (tabId: string) => {
    const tab = helpers.getTabById(tabId);
    if (tab) {
      actions.updateTab(tabId, {
        metadata: {
          ...tab.metadata,
          isFavorite: !tab.metadata.isFavorite
        }
      });
    }
  };

  const handleToggleArchive = (tabId: string) => {
    const tab = helpers.getTabById(tabId);
    if (tab) {
      actions.updateTab(tabId, {
        metadata: {
          ...tab.metadata,
          isArchived: !tab.metadata.isArchived
        }
      });
    }
  };

  const handleExportTab = (tabId: string, format: 'markdown' | 'json') => {
    const tab = helpers.getTabById(tabId);
    if (!tab) return;

    let content = '';
    let filename = '';

    if (format === 'markdown') {
      content = `# ${tab.name}\n\n**Type:** ${tab.type}\n**Created:** ${tab.createdAt.toLocaleString()}\n**Messages:** ${tab.metadata.messageCount}\n\n## Messages\n\n`;
      tab.messages.forEach(msg => {
        const role = msg.type === 'user' ? '👤 User' : msg.type === 'assistant' ? '🤖 Assistant' : '🔧 System';
        content += `### ${role} - ${msg.timestamp.toLocaleString()}\n\n${msg.content}\n\n`;
      });
      filename = `${tab.name.replace(/[^a-z0-9]/gi, '_')}.md`;
    } else {
      content = JSON.stringify(tab, null, 2);
      filename = `${tab.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    }

    const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteTab = (tabId: string) => {
    if (confirm('Are you sure you want to delete this tab and its history?')) {
      actions.deleteTab(tabId);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-custom-box ${className}`}>
      {/* Header */}
      <div className="border-b border-custom-border p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Chat History
        </h2>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-custom-bg border-custom-border text-white placeholder-gray-400"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex gap-1">
              <Button
                variant={selectedFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFilter('all')}
                className={selectedFilter === 'all' ? 'bg-yellow-500 text-black' : 'text-gray-400'}
              >
                All
              </Button>
              <Button
                variant={selectedFilter === 'favorites' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFilter('favorites')}
                className={selectedFilter === 'favorites' ? 'bg-yellow-500 text-black' : 'text-gray-400'}
              >
                <Star className="w-4 h-4" />
              </Button>
              <Button
                variant={selectedFilter === 'archived' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFilter('archived')}
                className={selectedFilter === 'archived' ? 'bg-yellow-500 text-black' : 'text-gray-400'}
              >
                <Archive className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-1">
              <Button
                variant={dateFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('all')}
                className={dateFilter === 'all' ? 'bg-yellow-500 text-black' : 'text-gray-400'}
              >
                All Time
              </Button>
              <Button
                variant={dateFilter === 'today' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('today')}
                className={dateFilter === 'today' ? 'bg-yellow-500 text-black' : 'text-gray-400'}
              >
                Today
              </Button>
              <Button
                variant={dateFilter === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('week')}
                className={dateFilter === 'week' ? 'bg-yellow-500 text-black' : 'text-gray-400'}
              >
                This Week
              </Button>
              <Button
                variant={dateFilter === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('month')}
                className={dateFilter === 'month' ? 'bg-yellow-500 text-black' : 'text-gray-400'}
              >
                This Month
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No chat history found</p>
            <p className="text-sm mt-2">
              {searchQuery ? 'Try a different search term' : 'Start a conversation to see it here'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <HistoryEntryCard
              key={entry.id}
              entry={entry}
              onRestore={() => handleRestoreTab(entry.tabId)}
              onDuplicate={() => handleDuplicateTab(entry.tabId)}
              onToggleFavorite={() => handleToggleFavorite(entry.tabId)}
              onToggleArchive={() => handleToggleArchive(entry.tabId)}
              onExport={(format) => handleExportTab(entry.tabId, format)}
              onDelete={() => handleDeleteTab(entry.tabId)}
            />
          ))
        )}
      </div>

      {/* Stats */}
      <div className="border-t border-custom-border p-4">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {filteredEntries.length} of {historyEntries.length} conversations
          </span>
          <span>
            {historyEntries.reduce((sum, entry) => sum + entry.messageCount, 0)} total messages
          </span>
        </div>
      </div>
    </div>
  );
}

interface HistoryEntryCardProps {
  entry: HistoryEntry;
  onRestore: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onExport: (format: 'markdown' | 'json') => void;
  onDelete: () => void;
}

function HistoryEntryCard({
  entry,
  onRestore,
  onDuplicate,
  onToggleFavorite,
  onToggleArchive,
  onExport,
  onDelete
}: HistoryEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-custom-bg border border-custom-border rounded-lg p-4 hover:border-yellow-500 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{entry.tabName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {entry.tabType}
            </Badge>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {entry.messageCount} messages
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFavorite}
            className={`p-1 ${entry.isFavorite ? 'text-yellow-500' : 'text-gray-400'}`}
          >
            <Star className={`w-4 h-4 ${entry.isFavorite ? 'fill-current' : ''}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleArchive}
            className={`p-1 ${entry.isArchived ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <Archive className={`w-4 h-4 ${entry.isArchived ? 'fill-current' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1 text-gray-400">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-custom-box border-custom-border" align="end">
              <DropdownMenuItem onClick={onRestore}>
                <Eye className="w-4 h-4 mr-2" />
                Restore Tab
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Duplicate Tab
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport('markdown')}>
                <Download className="w-4 h-4 mr-2" />
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('json')}>
                <Download className="w-4 h-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Preview */}
      <div className="text-sm text-gray-300 mb-2">
        <p className="line-clamp-2">{entry.preview}</p>
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {entry.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Expand/Collapse */}
      {entry.preview.length > 200 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-gray-400 p-0 h-auto"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}