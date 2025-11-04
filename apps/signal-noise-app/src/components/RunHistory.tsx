'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RunMetrics {
  file: string;
  started: string;
  completed?: string;
  duration: string;
  durationMs?: number;
  foundRFPs: number;
  entitiesProcessed: number;
  searchesPerformed: number;
  neo4jQueries: number;
  toolsUsed: string[];
  score: number;
  status: 'completed' | 'partial' | 'error';
  summary?: string;
}

interface RunHistoryData {
  runs: RunMetrics[];
  summary: {
    totalRuns: number;
    completedRuns: number;
    totalRFPs: number;
    totalEntities: number;
    totalSearches: number;
    avgScore: number;
    lastRun: string | null;
  };
}

export default function RunHistory() {
  const [data, setData] = useState<RunHistoryData>({ runs: [], summary: { totalRuns: 0, completedRuns: 0, totalRFPs: 0, totalEntities: 0, totalSearches: 0, avgScore: 0, lastRun: null } });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof RunMetrics>('started');

  useEffect(() => {
    fetchRunHistory();
    const interval = setInterval(fetchRunHistory, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRunHistory = async () => {
    try {
      const response = await fetch('/api/get-run-history');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch run history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getToolColor = (tool: string): string => {
    if (tool.includes('neo4j')) return 'bg-green-600/30 text-green-300';
    if (tool.includes('brightdata')) return 'bg-blue-600/30 text-blue-300';
    if (tool.includes('perplexity')) return 'bg-purple-600/30 text-purple-300';
    return 'bg-gray-600/30 text-gray-300';
  };

  const getToolShortName = (tool: string): string => {
    return tool.replace('mcp__', '').split('__')[0];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'partial': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed': return '✅';
      case 'partial': return '⏳';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const formatDateTime = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const sortedRuns = [...data.runs].sort((a, b) => {
    if (sortBy === 'score' || sortBy === 'durationMs') {
      return (b[sortBy as keyof RunMetrics] as number) - (a[sortBy as keyof RunMetrics] as number);
    }
    return new Date(b[sortBy as keyof RunMetrics] as string).getTime() - new Date(a[sortBy as keyof RunMetrics] as string).getTime();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-400">Loading run history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            📊 Run History Summary
            <Button 
              onClick={fetchRunHistory} 
              variant="outline" 
              size="sm"
              className="ml-auto"
            >
              🔄 Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-blue-400">{data.summary.totalRuns}</div>
              <div className="text-sm text-gray-400">Total Runs</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-green-400">{data.summary.totalRFPs}</div>
              <div className="text-sm text-gray-400">RFPs Found</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-purple-400">{data.summary.completedRuns}</div>
              <div className="text-sm text-gray-400">Completed</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-2xl font-bold text-yellow-400">{data.summary.avgScore}</div>
              <div className="text-sm text-gray-400">Avg Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runs Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">📈 Execution History</CardTitle>
          <CardDescription className="text-gray-300">
            Detailed metrics for all RFP intelligence scans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.runs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <p>No runs yet. Execute your first scan to see history here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700">
                  <tr className="text-left text-gray-300">
                    <th className="p-2 cursor-pointer hover:text-white" onClick={() => setSortBy('started')}>
                      Date {sortBy === 'started' && '↓'}
                    </th>
                    <th className="p-2">Status</th>
                    <th className="p-2 cursor-pointer hover:text-white" onClick={() => setSortBy('foundRFPs')}>
                      RFPs {sortBy === 'foundRFPs' && '↓'}
                    </th>
                    <th className="p-2 cursor-pointer hover:text-white" onClick={() => setSortBy('entitiesProcessed')}>
                      Entities {sortBy === 'entitiesProcessed' && '↓'}
                    </th>
                    <th className="p-2">Tools Used</th>
                    <th className="p-2 cursor-pointer hover:text-white" onClick={() => setSortBy('duration')}>
                      Duration {sortBy === 'duration' && '↓'}
                    </th>
                    <th className="p-2 cursor-pointer hover:text-white" onClick={() => setSortBy('score')}>
                      Score {sortBy === 'score' && '↓'}
                    </th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRuns.map((run, index) => (
                    <tr 
                      key={run.file} 
                      className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="p-2">
                        <div className="text-white">{formatDateTime(run.started)}</div>
                        {run.summary && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                            {run.summary}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <span className={`flex items-center gap-1 ${getStatusColor(run.status)}`}>
                          {getStatusIcon(run.status)}
                          {run.status}
                        </span>
                      </td>
                      <td className="p-2 text-center font-semibold text-green-400">
                        {run.foundRFPs}
                      </td>
                      <td className="p-2 text-center text-blue-400">
                        {run.entitiesProcessed}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {run.toolsUsed.slice(0, 3).map((tool, i) => (
                            <span
                              key={i}
                              className={`px-2 py-1 rounded text-xs font-medium ${getToolColor(tool)}`}
                            >
                              {getToolShortName(tool)}
                            </span>
                          ))}
                          {run.toolsUsed.length > 3 && (
                            <span className="px-2 py-1 rounded text-xs bg-gray-600/30 text-gray-300">
                              +{run.toolsUsed.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-gray-300">
                        {run.duration}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className={`font-semibold ${
                            run.score >= 80 ? 'text-green-400' : 
                            run.score >= 60 ? 'text-yellow-400' : 
                            'text-red-400'
                          }`}>
                            {run.score}
                          </div>
                          <div className="w-12 h-1 bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                run.score >= 80 ? 'bg-green-400' : 
                                run.score >= 60 ? 'bg-yellow-400' : 
                                'bg-red-400'
                              }`}
                              style={{ width: `${run.score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <a
                            href={`/api/logs/${run.file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 hover:underline text-xs"
                          >
                            📄 View Log
                          </a>
                          {run.durationMs && run.durationMs > 0 && (
                            <span className="text-xs text-gray-500">
                              {Math.round(run.durationMs / 1000)}s
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}