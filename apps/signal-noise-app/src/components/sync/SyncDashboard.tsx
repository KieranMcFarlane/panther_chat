'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SyncStatus {
  lastSync: any;
  recentStatuses: any[];
  isHealthy: boolean | null;
}

export default function SyncDashboard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => {
    fetchSyncStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync/neo4j-to-supabase');
      const data = await response.json();
      setSyncStatus(data.status);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const triggerSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      const response = await fetch('/api/sync/neo4j-to-supabase', {
        method: 'POST',
      });
      const data = await response.json();
      setSyncResult(data);
      
      if (data.success) {
        // Refresh status after successful sync
        setTimeout(fetchSyncStatus, 2000);
      }
    } catch (error) {
      setSyncResult({ success: false, error: 'Failed to trigger sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const getLastSyncTime = () => {
    if (!syncStatus?.lastSync) return 'Never';
    return new Date(syncStatus.lastSync.started_at).toLocaleString();
  };

  const getHealthBadge = () => {
    if (syncStatus?.isHealthy === null) {
      return <Badge variant="outline">Unknown</Badge>;
    }
    return syncStatus?.isHealthy ? (
      <Badge className="bg-green-500">Healthy</Badge>
    ) : (
      <Badge variant="destructive">Unhealthy</Badge>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Neo4j ↔ Supabase Sync</h1>
        <Button 
          onClick={triggerSync} 
          disabled={isSyncing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSyncing ? 'Syncing...' : 'Trigger Full Sync'}
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Health:</span>
                {getHealthBadge()}
              </div>
              <div className="flex justify-between">
                <span>Last Sync:</span>
                <span className="text-sm text-gray-600">
                  {getLastSyncTime()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {syncStatus?.recentStatuses?.slice(0, 3).map((status, index) => (
                <div key={index} className="text-sm">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    status.status === 'completed' ? 'bg-green-500' :
                    status.status === 'running' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  {status.status}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Database Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>Neo4j: ~4,422 entities</div>
              <div>Supabase: ~4,414 entities</div>
              <div className="text-yellow-600">~8 entities pending sync</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <Card className={syncResult.success ? 'border-green-500' : 'border-red-500'}>
          <CardHeader>
            <CardTitle className="text-lg">
              Sync Result {syncResult.success ? '✅' : '❌'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {syncResult.success ? (
              <div className="space-y-2">
                <p><strong>Entities Processed:</strong> {syncResult.data?.entitiesProcessed}</p>
                <p><strong>Entities Added:</strong> {syncResult.data?.entitiesAdded}</p>
                <p><strong>Entities Updated:</strong> {syncResult.data?.entitiesUpdated}</p>
                <p><strong>Duration:</strong> {syncResult.data?.durationFormatted}</p>
              </div>
            ) : (
              <p className="text-red-600">Error: {syncResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">What this sync does:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>Keeps Supabase cached_entities table synchronized with Neo4j database</li>
              <li>Detects new, updated, and removed entities</li>
              <li>Maintains checksums to detect changes</li>
              <li>Provides comprehensive logging and monitoring</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Automatic Syncing:</h3>
            <p className="text-sm text-gray-600">
              The system is configured for automatic syncing every 24 hours. 
              Manual syncs can be triggered using the button above.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}