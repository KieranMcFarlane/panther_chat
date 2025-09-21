'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Server, Database, MessageSquare, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HealthStatus {
  status: string;
  service: string;
  timestamp?: string;
  responseTime?: number;
}

interface SystemStatus {
  backend: HealthStatus | null;
  neo4j: boolean;
  redis: boolean;
  celery: boolean;
  lastChecked: string;
}

export default function HealthPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: null,
    neo4j: false,
    redis: false,
    celery: false,
    lastChecked: 'Never'
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    const startTime = Date.now();
    
    try {
      // Check backend health
      const backendResponse = await fetch('http://localhost:8000/health');
      const backendData = await backendResponse.json();
      const responseTime = Date.now() - startTime;
      
      const backendStatus: HealthStatus = {
        ...backendData,
        responseTime,
        timestamp: new Date().toISOString()
      };

      // Check Neo4j connection (via backend)
      let neo4jStatus = false;
      try {
        const neo4jResponse = await fetch('http://localhost:8000/api/tenders/enhanced');
        neo4jStatus = neo4jResponse.ok;
      } catch (error) {
        neo4jStatus = false;
      }

      // Check Redis (via Celery)
      let redisStatus = false;
      try {
        const redisResponse = await fetch('http://localhost:8000/dossier/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: 'test',
            entity_name: 'health_check',
            priority: 'low'
          })
        });
        redisStatus = redisResponse.ok;
      } catch (error) {
        redisStatus = false;
      }

      // Check Celery worker
      let celeryStatus = false;
      try {
        const celeryResponse = await fetch('http://localhost:8000/dossier/health_check');
        celeryStatus = celeryResponse.ok;
      } catch (error) {
        celeryStatus = false;
      }

      setSystemStatus({
        backend: backendStatus,
        neo4j: neo4jStatus,
        redis: redisStatus,
        celery: celeryStatus,
        lastChecked: new Date().toLocaleString()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setSystemStatus(prev => ({
        ...prev,
        backend: {
          status: 'error',
          service: 'signal-noise-app',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        },
        lastChecked: new Date().toLocaleString()
      }));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getStatusIcon = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? <CheckCircle className="h-5 w-5 text-fm-green" /> : <XCircle className="h-5 w-5 text-fm-red" />;
    }
    
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-fm-green" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-fm-red" />;
      default:
        return <AlertCircle className="h-5 w-5 text-fm-orange" />;
    }
  };

  const getStatusColor = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? 'bg-fm-green/20 text-fm-green' : 'bg-fm-red/20 text-fm-red';
    }
    
    switch (status) {
      case 'healthy':
        return 'bg-fm-green/20 text-fm-green';
      case 'error':
        return 'bg-fm-red/20 text-fm-red';
      default:
        return 'bg-fm-orange/20 text-fm-orange';
    }
  };

  return (
    <div className="min-h-screen bg-custom-bg p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-header-large text-fm-white mb-4">System Health Dashboard</h1>
          <p className="font-body-primary text-fm-light-grey">
            Monitor the health and status of all system components
          </p>
        </div>

        {/* Health Check Controls */}
        <div className="mb-8">
          <Card className="bg-custom-box border-custom-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-subheader text-fm-white mb-2">System Status</h2>
                  <p className="font-body-secondary text-fm-medium-grey">
                    Last checked: {systemStatus.lastChecked}
                  </p>
                </div>
                <Button
                  onClick={checkHealth}
                  disabled={isChecking}
                  className="bg-fm-yellow text-custom-bg hover:bg-yellow-400"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                  {isChecking ? 'Checking...' : 'Check Health'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Backend Status */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Server className="h-6 w-6 text-fm-yellow" />
                <CardTitle className="font-subheader text-fm-white">Backend API</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {systemStatus.backend ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-body-secondary text-fm-light-grey">Status:</span>
                    <Badge className={getStatusColor(systemStatus.backend.status)}>
                      {getStatusIcon(systemStatus.backend.status)}
                      <span className="ml-2">{systemStatus.backend.status}</span>
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-secondary text-fm-light-grey">Service:</span>
                    <span className="font-body-primary text-fm-white">{systemStatus.backend.service}</span>
                  </div>
                  {systemStatus.backend.responseTime && (
                    <div className="flex items-center justify-between">
                      <span className="font-body-secondary text-fm-light-grey">Response Time:</span>
                      <span className="font-body-primary text-fm-white">{systemStatus.backend.responseTime}ms</span>
                    </div>
                  )}
                  {systemStatus.backend.timestamp && (
                    <div className="flex items-center justify-between">
                      <span className="font-body-secondary text-fm-light-grey">Last Update:</span>
                      <span className="font-body-primary text-fm-white text-sm">
                        {new Date(systemStatus.backend.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertCircle className="h-8 w-8 text-fm-orange mx-auto mb-2" />
                  <p className="font-body-secondary text-fm-medium-grey">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Neo4j Status */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-fm-green" />
                <CardTitle className="font-subheader text-fm-white">Neo4j Database</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Status:</span>
                  <Badge className={getStatusColor(systemStatus.neo4j)}>
                    {getStatusIcon(systemStatus.neo4j)}
                    <span className="ml-2">{systemStatus.neo4j ? 'Connected' : 'Disconnected'}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Connection:</span>
                  <span className="font-body-primary text-fm-white">
                    {systemStatus.neo4j ? 'Active' : 'Failed'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Redis Status */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-fm-orange" />
                <CardTitle className="font-subheader text-fm-white">Redis & Celery</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Redis:</span>
                  <Badge className={getStatusColor(systemStatus.redis)}>
                    {getStatusIcon(systemStatus.redis)}
                    <span className="ml-2">{systemStatus.redis ? 'Active' : 'Inactive'}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Celery:</span>
                  <Badge className={getStatusColor(systemStatus.celery)}>
                    {getStatusIcon(systemStatus.celery)}
                    <span className="ml-2">{systemStatus.celery ? 'Running' : 'Stopped'}</span>
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API Endpoints */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-subheader text-fm-white">Available API Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-custom-bg rounded-md">
                  <span className="font-body-primary text-fm-light-grey">GET /health</span>
                  <Badge className="bg-fm-green/20 text-fm-green">Health Check</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-custom-bg rounded-md">
                  <span className="font-body-primary text-fm-light-grey">GET /api/tenders/enhanced</span>
                  <Badge className="bg-fm-yellow/20 text-fm-yellow">Tenders Data</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-custom-bg rounded-md">
                  <span className="font-body-primary text-fm-light-grey">POST /dossier/request</span>
                  <Badge className="bg-fm-blue/20 text-fm-blue">Dossier Request</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-custom-bg rounded-md">
                  <span className="font-body-primary text-fm-light-grey">GET /dossier/{'{task_id}'}</span>
                  <Badge className="bg-fm-blue/20 text-fm-blue">Task Status</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Details */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-subheader text-fm-white">System Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Service Name:</span>
                  <span className="font-body-primary text-fm-white">Signal Noise App</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Backend Port:</span>
                  <span className="font-body-primary text-fm-white">8000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Frontend Port:</span>
                  <span className="font-body-primary text-fm-white">3001</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Environment:</span>
                  <Badge className="bg-fm-orange/20 text-fm-orange">Development</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-secondary text-fm-light-grey">Framework:</span>
                  <span className="font-body-primary text-fm-white">FastAPI + Next.js</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
