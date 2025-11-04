'use client';

import React, { useState, useEffect } from 'react';
import { useThreads } from '@/contexts/ThreadContext';
import { Entity, Insight, Resource, Connection } from '@/types/thread-system';
import { 
  Search, 
  Database, 
  Brain, 
  Link, 
  FileText, 
  Calendar,
  TrendingUp,
  Users,
  Filter,
  Download,
  Upload
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

interface TeamsStoreViewProps {
  className?: string;
}

export default function TeamsStoreView({ className = '' }: TeamsStoreViewProps) {
  const { state, actions } = useThreads();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'entities' | 'insights' | 'resources' | 'connections'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'confidence'>('date');

  const { teamsStore } = state;

  // Filter and search logic
  const getFilteredData = () => {
    let data: any[] = [];

    switch (activeFilter) {
      case 'entities':
        data = teamsStore.entities.map(e => ({ ...e, type: 'entity' }));
        break;
      case 'insights':
        data = teamsStore.insights.map(i => ({ ...i, type: 'insight' }));
        break;
      case 'resources':
        data = teamsStore.resources.map(r => ({ ...r, type: 'resource' }));
        break;
      case 'connections':
        data = teamsStore.connections.map(c => ({ ...c, type: 'connection' }));
        break;
      case 'all':
      default:
        data = [
          ...teamsStore.entities.map(e => ({ ...e, type: 'entity' })),
          ...teamsStore.insights.map(i => ({ ...i, type: 'insight' })),
          ...teamsStore.resources.map(r => ({ ...r, type: 'resource' })),
          ...teamsStore.connections.map(c => ({ ...c, type: 'connection' }))
        ];
        break;
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item => {
        switch (item.type) {
          case 'entity':
            return item.name.toLowerCase().includes(query) ||
                   item.type.toLowerCase().includes(query) ||
                   Object.values(item.properties).some(v => String(v).toLowerCase().includes(query));
          case 'insight':
            return item.title.toLowerCase().includes(query) ||
                   item.content.toLowerCase().includes(query) ||
                   item.category.toLowerCase().includes(query);
          case 'resource':
            return item.title.toLowerCase().includes(query) ||
                   item.summary.toLowerCase().includes(query);
          case 'connection':
            return item.type.toLowerCase().includes(query);
          default:
            return false;
        }
      });
    }

    // Apply sorting
    data.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || a.title || '').localeCompare(b.name || b.title || '');
        case 'confidence':
          return (b.confidence || 0) - (a.confidence || 0);
        case 'date':
        default:
          return new Date(b.createdAt || b.lastUpdated || 0).getTime() - 
                 new Date(a.createdAt || a.lastUpdated || 0).getTime();
      }
    });

    return data;
  };

  const filteredData = getFilteredData();

  const getItemIcon = (item: any) => {
    switch (item.type) {
      case 'entity':
        return <Database className="w-4 h-4" />;
      case 'insight':
        return <Brain className="w-4 h-4" />;
      case 'resource':
        return <FileText className="w-4 h-4" />;
      case 'connection':
        return <Link className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getItemColor = (item: any) => {
    switch (item.type) {
      case 'entity':
        return 'text-blue-400';
      case 'insight':
        return 'text-green-400';
      case 'resource':
        return 'text-yellow-400';
      case 'connection':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const exportTeamsStore = () => {
    const data = JSON.stringify(teamsStore, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teams-store-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full bg-custom-bg ${className}`}>
      {/* Header */}
      <div className="border-b border-custom-border p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Teams Knowledge Store
          <Badge variant="secondary" className="bg-green-500/20 text-green-400">
            Better Auth MCP
          </Badge>
        </h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-custom-box border border-custom-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Entities</span>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">{teamsStore.entities.length}</div>
          </div>
          
          <div className="bg-custom-box border border-custom-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Insights</span>
              <Brain className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">{teamsStore.insights.length}</div>
          </div>
          
          <div className="bg-custom-box border border-custom-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Resources</span>
              <FileText className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">{teamsStore.resources.length}</div>
          </div>
          
          <div className="bg-custom-box border border-custom-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Connections</span>
              <Link className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">{teamsStore.connections.length}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search Teams Store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-custom-bg border-custom-border text-white placeholder-gray-400"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-custom-border text-gray-400 hover:text-white">
                <Filter className="w-4 h-4 mr-2" />
                {activeFilter === 'all' ? 'All Items' : 
                 activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-custom-box border-custom-border">
              <DropdownMenuItem onClick={() => setActiveFilter('all')}>
                <Database className="w-4 h-4 mr-2" />
                All Items
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveFilter('entities')}>
                <Database className="w-4 h-4 mr-2" />
                Entities
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveFilter('insights')}>
                <Brain className="w-4 h-4 mr-2" />
                Insights
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveFilter('resources')}>
                <FileText className="w-4 h-4 mr-2" />
                Resources
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveFilter('connections')}>
                <Link className="w-4 h-4 mr-2" />
                Connections
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-custom-border text-gray-400 hover:text-white">
                <TrendingUp className="w-4 h-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-custom-box border-custom-border">
              <DropdownMenuItem onClick={() => setSortBy('date')}>
                <Calendar className="w-4 h-4 mr-2" />
                Date
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('name')}>
                <span className="w-4 h-4 mr-2">Aa</span>
                Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('confidence')}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Confidence
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportTeamsStore}
            className="border-custom-border text-gray-400 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No items found in Teams Store</p>
            <p className="text-sm mt-2">
              {searchQuery ? 'Try a different search term' : 'Start conversations to build shared knowledge'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredData.map((item, index) => (
              <div
                key={`${item.type}-${item.id || index}`}
                className="bg-custom-box border border-custom-border rounded-lg p-4 hover:border-yellow-500 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 ${getItemColor(item)}`}>
                    {getItemIcon(item)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Entity */}
                    {item.type === 'entity' && (
                      <>
                        <h3 className="text-white font-medium">{item.name}</h3>
                        <p className="text-gray-400 text-sm mt-1">
                          Type: {item.type} • Confidence: {Math.round(item.confidence * 100)}%
                        </p>
                        {item.properties && Object.keys(item.properties).length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            {Object.entries(item.properties).slice(0, 3).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.discoveredBy && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">
                              Discovered by {item.discoveredBy.length} thread(s)
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Insight */}
                    {item.type === 'insight' && (
                      <>
                        <h3 className="text-white font-medium">{item.title}</h3>
                        <p className="text-gray-300 text-sm mt-1">{item.content}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            Confidence: {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.tags.map((tag: string, tagIndex: number) => (
                              <span key={tagIndex} className="px-2 py-1 bg-custom-border text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Resource */}
                    {item.type === 'resource' && (
                      <>
                        <h3 className="text-white font-medium">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-yellow-400 hover:text-yellow-300"
                          >
                            {item.title}
                          </a>
                        </h3>
                        <p className="text-gray-300 text-sm mt-1">{item.summary}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {item.type}
                          </Badge>
                          {item.discoveredVia && (
                            <span className="text-xs text-gray-500">
                              Via: {item.discoveredVia}
                            </span>
                          )}
                        </div>
                      </>
                    )}

                    {/* Connection */}
                    {item.type === 'connection' && (
                      <>
                        <h3 className="text-white font-medium">
                          Connection: {item.fromEntity} ↔ {item.toEntity}
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                          Type: {item.type} • Strength: {Math.round(item.strength * 100)}%
                        </p>
                        {item.verified && (
                          <Badge variant="outline" className="text-xs mt-2 text-green-400">
                            ✓ Verified
                          </Badge>
                        )}
                      </>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-custom-border">
                      <span className="text-xs text-gray-500">
                        {item.type === 'entity' && `Updated: ${new Date(item.lastUpdated).toLocaleDateString()}`}
                        {item.type !== 'entity' && `Created: ${new Date(item.createdAt).toLocaleDateString()}`}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {item.discoveredBy && (
                          <span className="text-xs text-gray-500">
                            {item.discoveredBy.length} thread(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-custom-border p-4">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {filteredData.length} of {teamsStore.entities.length + teamsStore.insights.length + teamsStore.resources.length + teamsStore.connections.length} items
          </span>
          <span>
            Last updated: {new Date(teamsStore.updatedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}