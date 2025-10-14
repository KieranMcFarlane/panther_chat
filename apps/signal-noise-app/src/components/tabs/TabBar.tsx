'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTabs } from '@/contexts/TabContext';
import { TabType, TAB_TYPE_CONFIGS } from '@/types/tab-system';
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
  Grid3x3
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

interface TabBarProps {
  className?: string;
}

export default function TabBar({ className = '' }: TabBarProps) {
  const { 
    state, 
    actions, 
    helpers 
  } = useTabs();
  
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredTabs = helpers.getFilteredTabs();

  // Auto-scroll to active tab
  useEffect(() => {
    if (state.activeTabId && scrollContainerRef.current) {
      const activeTabElement = scrollContainerRef.current.querySelector(
        `[data-tab-id="${state.activeTabId}"]`
      ) as HTMLElement;
      
      if (activeTabElement) {
        activeTabElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
      }
    }
  }, [state.activeTabId]);

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedTabId) {
      const draggedTab = filteredTabs.find(tab => tab.id === draggedTabId);
      if (draggedTab) {
        const newTabs = [...filteredTabs];
        const dragIndex = newTabs.findIndex(tab => tab.id === draggedTabId);
        
        if (dragIndex !== dropIndex) {
          newTabs.splice(dragIndex, 1);
          newTabs.splice(dropIndex, 0, draggedTab);
          actions.reorderTabs(newTabs);
        }
      }
    }
    setDraggedTabId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverIndex(null);
  };

  const createNewTab = (type: TabType, name?: string) => {
    actions.createTab(type, name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 't':
          e.preventDefault();
          actions.createTab('general');
          break;
        case 'w':
          e.preventDefault();
          if (state.activeTabId && helpers.canUserDeleteTab(state.activeTabId)) {
            actions.deleteTab(state.activeTabId);
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
          const tabIndex = parseInt(e.key) - 1;
          if (tabIndex < filteredTabs.length) {
            actions.setActiveTab(filteredTabs[tabIndex].id);
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
            onClick={() => actions.setViewMode('tabs')}
            className={`p-2 ${state.viewMode === 'tabs' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.setViewMode('history')}
            className={`p-2 ${state.viewMode === 'history' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <History className="w-4 h-4" />
          </Button>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search tabs..."
              value={state.searchQuery}
              onChange={(e) => actions.setSearchQuery(e.target.value)}
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
                onClick={() => actions.setFilterType('all')}
                className={state.filterType === 'all' ? 'bg-yellow-500 text-black' : 'text-gray-300'}
              >
                All Tabs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(TAB_TYPE_CONFIGS).map(([type, config]) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => actions.setFilterType(type as TabType)}
                  className={`flex items-center gap-2 ${
                    state.filterType === type ? 'bg-yellow-500 text-black' : 'text-gray-300'
                  }`}
                >
                  <span>{config.icon}</span>
                  {config.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {filteredTabs.length} {filteredTabs.length === 1 ? 'tab' : 'tabs'}
          </span>
        </div>
      </div>

      {/* Tab Strip */}
      <div 
        ref={scrollContainerRef}
        className="flex items-center overflow-x-auto scrollbar-hide"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="flex items-center p-1">
          {/* New Tab Button */}
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
              <DropdownMenuItem onClick={() => createNewTab('general')}>
                <span className="mr-2">💬</span> General Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createNewTab('rfp')}>
                <span className="mr-2">📋</span> RFP Intelligence
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createNewTab('sports')}>
                <span className="mr-2">⚽</span> Sports Intelligence
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createNewTab('knowledge-graph')}>
                <span className="mr-2">🕸️</span> Knowledge Graph
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createNewTab('custom')}>
                <span className="mr-2">⚙️</span> Custom
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tabs */}
          {filteredTabs.map((tab, index) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === state.activeTabId}
              isDragging={draggedTabId === tab.id}
              dragOverIndex={dragOverIndex === index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              index={index}
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

interface TabItemProps {
  tab: any;
  isActive: boolean;
  isDragging: boolean;
  dragOverIndex: number | null;
  onDragStart: (e: React.DragEvent, tabId: string) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  index: number;
}

function TabItem({ 
  tab, 
  isActive, 
  isDragging, 
  dragOverIndex, 
  onDragStart, 
  onDragOver, 
  onDrop, 
  onDragEnd,
  index 
}: TabItemProps) {
  const { actions, helpers } = useTabs();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tab.name);

  const handleRename = () => {
    if (editName.trim() && editName !== tab.name) {
      actions.updateTab(tab.id, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(tab.name);
      setIsEditing(false);
    }
  };

  const handleDoubleClick = () => {
    if (helpers.canUserEditTab(tab.id)) {
      setIsEditing(true);
      setEditName(tab.name);
    }
  };

  const typeConfig = TAB_TYPE_CONFIGS[tab.type];

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, tab.id)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      data-tab-id={tab.id}
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-200
        ${isActive 
          ? 'bg-yellow-500 text-black shadow-lg' 
          : 'text-gray-400 hover:text-white hover:bg-custom-border'
        }
        ${isDragging ? 'opacity-50' : ''}
        ${dragOverIndex === index ? 'border-t-2 border-yellow-500' : ''}
        ${tab.isPinned ? 'font-semibold' : ''}
      `}
      onClick={() => actions.setActiveTab(tab.id)}
    >
      {/* Drag handle */}
      {!isEditing && (
        <div className="flex-shrink-0 opacity-50 hover:opacity-100">
          <svg width="8" height="12" className="overflow-visible">
            <circle cx="2" cy="2" r="1" fill="currentColor" />
            <circle cx="2" cy="6" r="1" fill="currentColor" />
            <circle cx="2" cy="10" r="1" fill="currentColor" />
            <circle cx="6" cy="2" r="1" fill="currentColor" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="10" r="1" fill="currentColor" />
          </svg>
        </div>
      )}

      {/* Tab icon */}
      <span className="flex-shrink-0">{typeConfig.icon}</span>

      {/* Tab name */}
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
        >
          {tab.name}
        </span>
      )}

      {/* Pin indicator */}
      {tab.isPinned && (
        <Pin className="w-3 h-3 flex-shrink-0" />
      )}

      {/* Message count badge */}
      {tab.metadata.messageCount > 0 && (
        <span className="flex-shrink-0 px-1 py-0.5 text-xs rounded-full bg-current bg-opacity-20">
          {tab.metadata.messageCount}
        </span>
      )}

      {/* Tab actions */}
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
            <DropdownMenuItem onClick={() => actions.setActiveTab(tab.id)}>
              Focus Tab
            </DropdownMenuItem>
            
            {helpers.canUserEditTab(tab.id) && (
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                Rename
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => actions.pinTab(tab.id, !tab.isPinned)}>
              {tab.isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
              {tab.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => actions.duplicateTab(tab.id)}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>

            {helpers.canUserShareTab(tab.id) && (
              <DropdownMenuItem>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </DropdownMenuItem>
            )}

            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {helpers.canUserDeleteTab(tab.id) && (
              <DropdownMenuItem 
                onClick={() => actions.deleteTab(tab.id)}
                className="text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4 mr-2" />
                Close Tab
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Quick close button */}
      {!isEditing && helpers.canUserDeleteTab(tab.id) && (
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0 p-1 h-6 w-6 hover:bg-current hover:bg-opacity-10 rounded"
          onClick={(e) => {
            e.stopPropagation();
            actions.deleteTab(tab.id);
          }}
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}