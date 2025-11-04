'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EnrichmentProgress {
  isRunning: boolean;
  batch: {
    batchId: string;
    totalEntities: number;
    processedEntities: number;
    successfulEnrichments: number;
    failedEnrichments: number;
    currentEntity: string;
    estimatedTimeRemaining: number;
    startTime: string;
    results: any[];
  } | null;
  statistics: {
    successRate: number;
    averageTimePerEntity: number;
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
  };
  recentResults: Array<{
    entityName: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  timestamp: string;
}

export default function EntityEnrichmentDashboard() {
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchProgress = async () => {
    try {
      const response = await fetch('/api/entity-enrichment/progress');
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEnrichment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/entity-enrichment/start', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Progress will be updated by auto-refresh
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopEnrichment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/entity-enrichment/stop', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Progress will be updated by auto-refresh
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh progress when running
  useEffect(() => {
    fetchProgress();
    
    if (autoRefresh && progress?.isRunning) {
      const interval = setInterval(fetchProgress, 3000); // Update every 3 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, progress?.isRunning]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const completionPercentage = progress?.batch 
    ? Math.round((progress.batch.processedEntities / progress.batch.totalEntities) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entity Dossier Enrichment</h1>
          <p className="text-muted-foreground">
            Systematic enrichment of sports entities with BrightData and Perplexity intelligence
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="autoRefresh" className="text-sm">
              Auto-refresh
            </label>
          </div>
          
          {progress?.isRunning ? (
            <Button onClick={stopEnrichment} disabled={loading} variant="destructive">
              {loading ? 'Stopping...' : 'Stop Enrichment'}
            </Button>
          ) : (
            <Button onClick={startEnrichment} disabled={loading}>
              {loading ? 'Starting...' : 'Start Enrichment'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Enrichment Status
                {progress?.isRunning && (
                  <Badge variant="default" className="animate-pulse">
                    Running
                  </Badge>
                )}
                {progress && !progress.isRunning && progress.batch && (
                  <Badge variant="secondary">
                    Completed
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {progress?.batch 
                  ? `Batch ${progress.batch.batchId} - Processing ${progress.batch.totalEntities} entities`
                  : 'No enrichment batch in progress'
                }
              </CardDescription>
            </div>
            
            {progress?.batch && (
              <div className="text-right text-sm text-muted-foreground">
                <div>Started: {formatTimestamp(progress.batch.startTime)}</div>
                {progress.batch.estimatedTimeRemaining > 0 && (
                  <div>ETA: {formatDuration(progress.batch.estimatedTimeRemaining)}</div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        {progress?.batch && (
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.batch.processedEntities} / {progress.batch.totalEntities} entities</span>
                <span>{formatDuration(progress.statistics.averageTimePerEntity)} avg per entity</span>
              </div>
            </div>

            {/* Current Entity */}
            {progress.isRunning && progress.batch.currentEntity && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-800">
                  Currently Processing:
                </div>
                <div className="text-sm text-blue-600">
                  {progress.batch.currentEntity}
                </div>
              </div>
            )}

            {/* Statistics Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {progress.batch.successfulEnrichments}
                </div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {progress.batch.failedEnrichments}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {progress.statistics.successRate}%
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatDuration(progress.statistics.averageTimePerEntity)}
                </div>
                <div className="text-sm text-muted-foreground">Avg Time</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recent Results */}
      {progress?.recentResults && progress.recentResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Enrichments</CardTitle>
            <CardDescription>Last 5 processed entities</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {progress.recentResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        result.success ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-medium">{result.entityName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {result.duration}s
                      </span>
                      {result.error && (
                        <Badge variant="destructive" className="text-xs">
                          Error
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!progress?.batch && (
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Entity enrichment process overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl mb-2">🔍</div>
                <h3 className="font-medium mb-1">BrightData Scraping</h3>
                <p className="text-sm text-muted-foreground">
                  Scrape LinkedIn, Crunchbase, and web news for company information
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl mb-2">🧠</div>
                <h3 className="font-medium mb-1">Perplexity Intelligence</h3>
                <p className="text-sm text-muted-foreground">
                  Generate market analysis and business intelligence insights
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl mb-2">📊</div>
                <h3 className="font-medium mb-1">Dossier Update</h3>
                <p className="text-sm text-muted-foreground">
                  Update Neo4j with combined intelligence and insights
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Before You Start</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Ensure BrightData and Perplexity API keys are configured</li>
                <li>• The process will enrich entities that haven't been updated in 7+ days</li>
                <li>• Processing is conservative (3 entities per batch) to avoid rate limits</li>
                <li>• Each entity takes ~30-60 seconds to enrich with both services</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}