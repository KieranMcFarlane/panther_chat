# Production Deployment React Component

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Server,
  Database,
  Users,
  BarChart3,
  FileText,
  Send,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface DeploymentConfig {
  environment: 'production' | 'staging';
  region: string;
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  auth: {
    betterAuthUrl: string;
    betterAuthApiKey: string;
    jwtSecret: string;
    sessionSecret: string;
  };
  monitoring: {
    enableMetrics: boolean;
    enableLogging: boolean;
    enableAlerting: boolean;
  };
  backup: {
    enableAutoBackup: boolean;
    backupSchedule: string;
    retentionDays: number;
    storageType: 's3' | 'local';
  };
}

interface DeploymentPlan {
  id: string;
  timestamp: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  phases: DeploymentPhase[];
  config: DeploymentConfig;
}

interface DeploymentPhase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  steps: DeploymentStep[];
  estimatedDuration: number;
  actualDuration?: number;
}

interface DeploymentStep {
  id: string;
  name: string;
  command: string;
  type: 'command' | 'script' | 'api' | 'manual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  critical: boolean;
}

interface DeploymentProgress {
  deploymentId: string;
  phase: string;
  step: string;
  progress: number;
  status: string;
  message: string;
  timestamp: Date;
}

interface DeploymentMetrics {
  deploymentId: string;
  duration: number;
  phasesCompleted: number;
  totalPhases: number;
  stepsCompleted: number;
  totalSteps: number;
  successRate: number;
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

interface SystemHealth {
  overall: string;
  checks: Array<{
    id: string;
    name: string;
    status: string;
    responseTime: number;
    timestamp: Date;
  }>;
  timestamp: Date;
}

export function ProductionDeployment() {
  const [deployments, setDeployments] = useState<DeploymentPlan[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentPlan | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState<DeploymentProgress | null>(null);
  const [deploymentMetrics, setDeploymentMetrics] = useState<DeploymentMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load data on component mount
  useEffect(() => {
    loadDeployments();
    loadSystemHealth();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        if (selectedDeployment) {
          loadDeploymentProgress(selectedDeployment.id);
          loadDeploymentMetrics(selectedDeployment.id);
        }
        loadSystemHealth();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [selectedDeployment, autoRefresh]);

  const loadDeployments = async () => {
    try {
      const response = await fetch('/api/deployments');
      const data = await response.json();
      if (data.success) {
        setDeployments(data.data);
      }
    } catch (error) {
      console.error('Failed to load deployments:', error);
    }
  };

  const loadDeploymentProgress = async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/progress`);
      const data = await response.json();
      if (data.success) {
        setDeploymentProgress(data.data);
      }
    } catch (error) {
      console.error('Failed to load deployment progress:', error);
    }
  };

  const loadDeploymentMetrics = async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/metrics`);
      const data = await response.json();
      if (data.success) {
        setDeploymentMetrics(data.data);
      }
    } catch (error) {
      console.error('Failed to load deployment metrics:', error);
    }
  };

  const loadSystemHealth = async () => {
    try {
      const response = await fetch('/api/system/health');
      const data = await response.json();
      if (data.success) {
        setSystemHealth(data.data);
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
    }
  };

  const startDeployment = async (deploymentConfig: DeploymentConfig) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: deploymentConfig }),
      });
      const data = await response.json();
      if (data.success) {
        await loadDeployments();
        setSelectedDeployment(data.data);
        setShowDeployDialog(false);
      } else {
        alert(`Failed to start deployment: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to start deployment:', error);
      alert('Failed to start deployment');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to cancel this deployment?')) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/cancel`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (data.success) {
        await loadDeployments();
        if (selectedDeployment?.id === deploymentId) {
          setSelectedDeployment(null);
        }
      } else {
        alert(`Failed to cancel deployment: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to cancel deployment:', error);
      alert('Failed to cancel deployment');
    } finally {
      setIsLoading(false);
    }
  };

  const retryDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to retry this deployment?')) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/retry`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (data.success) {
        await loadDeployments();
        setSelectedDeployment(data.data);
      } else {
        alert(`Failed to retry deployment: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to retry deployment:', error);
      alert('Failed to retry deployment');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDeploymentReport = async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/report`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `deployment-${deploymentId}-report.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download deployment report:', error);
      alert('Failed to download deployment report');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-4 h-4 mr-1" /> Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Activity className="w-4 h-4 mr-1" /> In Progress</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><XCircle className="w-4 h-4 mr-1" /> Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="w-4 h-4 mr-1" /> Pending</Badge>;
      case 'rolled_back':
        return <Badge className="bg-gray-500"><RotateCcw className="w-4 h-4 mr-1" /> Rolled Back</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const defaultConfig: DeploymentConfig = {
    environment: 'production',
    region: 'us-east-1',
    instanceType: 't3.large',
    minInstances: 2,
    maxInstances: 10,
    database: {
      host: '',
      port: 5432,
      username: '',
      password: '',
      database: 'claudebox_prod'
    },
    redis: {
      host: '',
      port: 6379,
      password: ''
    },
    auth: {
      betterAuthUrl: 'https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp',
      betterAuthApiKey: '',
      jwtSecret: '',
      sessionSecret: ''
    },
    monitoring: {
      enableMetrics: true,
      enableLogging: true,
      enableAlerting: true
    },
    backup: {
      enableAutoBackup: true,
      backupSchedule: '0 2 * * *',
      retentionDays: 30,
      storageType: 's3'
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Production Deployment</h1>
          <p className="text-muted-foreground">
            Manage and monitor production deployments of the ClaudeBox Multi-Slot system
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Configuration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Deployment Configuration</DialogTitle>
                <DialogDescription>
                  Configure deployment settings for the ClaudeBox Multi-Slot system
                </DialogDescription>
              </DialogHeader>
              <ConfigurationForm
                config={config || defaultConfig}
                setConfig={setConfig}
                onSave={() => setShowConfigDialog(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
            <DialogTrigger asChild>
              <Button>
                <Play className="w-4 h-4 mr-2" />
                Start Deployment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Deployment</DialogTitle>
                <DialogDescription>
                  Begin a new production deployment of the ClaudeBox Multi-Slot system
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Production Deployment</AlertTitle>
                  <AlertDescription>
                    This will deploy the system to production. Make sure you have backed up all data and have a rollback plan ready.
                  </AlertDescription>
                </Alert>
                {config && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Deployment Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Environment:</strong> {config.environment}
                      </div>
                      <div>
                        <strong>Region:</strong> {config.region}
                      </div>
                      <div>
                        <strong>Instance Type:</strong> {config.instanceType}
                      </div>
                      <div>
                        <strong>Instances:</strong> {config.minInstances}-{config.maxInstances}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => config && startDeployment(config)}
                  disabled={!config || isLoading}
                >
                  {isLoading ? 'Starting...' : 'Start Deployment'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* System Health */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  systemHealth.overall === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="font-medium">Overall Status:</span>
                <Badge variant={systemHealth.overall === 'healthy' ? 'default' : 'destructive'}>
                  {systemHealth.overall}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Health Checks:</span>
                <span>{systemHealth.checks.filter(c => c.status === 'passed').length}/{systemHealth.checks.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Last Updated:</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(systemHealth.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="deployments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>
                View and manage all deployments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((deployment) => (
                    <TableRow key={deployment.id}>
                      <TableCell className="font-mono text-sm">
                        {deployment.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                      <TableCell>
                        {new Date(deployment.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{deployment.config.environment}</TableCell>
                      <TableCell>
                        <Progress
                          value={
                            (deployment.phases.filter(p => p.status === 'completed').length /
                              deployment.phases.length) * 100
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDeployment(deployment)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {deployment.status === 'in_progress' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelDeployment(deployment.id)}
                              disabled={isLoading}
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {deployment.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryDeployment(deployment.id)}
                              disabled={isLoading}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {deployment.status === 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadDeploymentReport(deployment.id)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          {selectedDeployment && deploymentProgress && (
            <Card>
              <CardHeader>
                <CardTitle>Deployment Progress</CardTitle>
                <CardDescription>
                  {selectedDeployment.id} - {deploymentProgress.phase}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Overall Progress</span>
                      <span className="text-sm text-muted-foreground">
                        {deploymentProgress.progress.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={deploymentProgress.progress} />
                    <p className="text-sm text-muted-foreground">
                      {deploymentProgress.message}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Current Phase</h4>
                      <p className="text-sm">{deploymentProgress.phase}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Current Step</h4>
                      <p className="text-sm">{deploymentProgress.step}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Phase Details</h4>
                    <div className="space-y-3">
                      {selectedDeployment.phases.map((phase, index) => (
                        <div key={phase.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h5 className="font-medium">{phase.name}</h5>
                              <p className="text-sm text-muted-foreground">
                                {phase.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(phase.status)}
                              <span className="text-xs text-muted-foreground">
                                {formatDuration(phase.actualDuration || 0)}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {phase.steps.map((step) => (
                              <div key={step.id} className="flex items-center gap-2 text-sm">
                                <div className={`w-2 h-2 rounded-full ${
                                  step.status === 'completed' ? 'bg-green-500' :
                                  step.status === 'in_progress' ? 'bg-blue-500' :
                                  step.status === 'failed' ? 'bg-red-500' : 'bg-gray-300'
                                }`} />
                                <span className={step.status === 'failed' ? 'text-red-500' : ''}>
                                  {step.name}
                                </span>
                                {step.critical && (
                                  <Badge variant="outline" className="text-xs">
                                    Critical
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">
                  Select a deployment to view progress
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="metrics">
          {selectedDeployment && deploymentMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>Deployment Metrics</CardTitle>
                <CardDescription>
                  Performance and success metrics for deployment {selectedDeployment.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">Duration</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatDuration(deploymentMetrics.duration)}
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4" />
                      <span className="font-medium">Progress</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {deploymentMetrics.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4" />
                      <span className="font-medium">Phases</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {deploymentMetrics.phasesCompleted}/{deploymentMetrics.totalPhases}
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="w-4 h-4" />
                      <span className="font-medium">Steps</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {deploymentMetrics.stepsCompleted}/{deploymentMetrics.totalSteps}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {deploymentMetrics.errors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-red-500">Errors</h4>
                      <div className="space-y-1">
                        {deploymentMetrics.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-500 bg-red-50 p-2 rounded">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {deploymentMetrics.warnings.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-yellow-500">Warnings</h4>
                      <div className="space-y-1">
                        {deploymentMetrics.warnings.map((warning, index) => (
                          <div key={index} className="text-sm text-yellow-500 bg-yellow-50 p-2 rounded">
                            {warning}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">
                  Select a deployment to view metrics
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Logs</CardTitle>
              <CardDescription>
                Real-time deployment logs and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                <div className="space-y-1">
                  <div>[2025-01-28 10:30:15] INFO: Deployment system initialized</div>
                  <div>[2025-01-28 10:30:16] INFO: Validating deployment configuration</div>
                  <div>[2025-01-28 10:30:17] INFO: Configuration validation passed</div>
                  <div>[2025-01-28 10:30:18] INFO: Starting deployment phases</div>
                  <div>[2025-01-28 10:30:19] INFO: Phase 1: Pre-deployment Backup - Starting</div>
                  <div>[2025-01-28 10:30:20] INFO: Backing up database...</div>
                  <div>[2025-01-28 10:35:22] INFO: Database backup completed</div>
                  <div>[2025-01-28 10:35:23] INFO: Backing up configuration...</div>
                  <div>[2025-01-28 10:35:24] INFO: Configuration backup completed</div>
                  <div>[2025-01-28 10:35:25] INFO: Phase 1: Pre-deployment Backup - Completed</div>
                  <div>[2025-01-28 10:35:26] INFO: Phase 2: Environment Setup - Starting</div>
                  <div className="text-blue-400">[2025-01-28 10:35:27] INFO: Deploying EC2 instances...</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Configuration Form Component
function ConfigurationForm({ config, setConfig, onSave }: {
  config: DeploymentConfig;
  setConfig: (config: DeploymentConfig) => void;
  onSave: () => void;
}) {
  const updateConfig = (path: string, value: any) => {
    const newConfig = { ...config };
    const keys = path.split('.');
    let current = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i] as keyof typeof current];
    }
    
    current[keys[keys.length - 1] as keyof typeof current] = value;
    setConfig(newConfig);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="environment">Environment</Label>
          <Select
            value={config.environment}
            onValueChange={(value) => updateConfig('environment', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            value={config.region}
            onChange={(e) => updateConfig('region', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="instanceType">Instance Type</Label>
          <Input
            id="instanceType"
            value={config.instanceType}
            onChange={(e) => updateConfig('instanceType', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="minInstances">Min Instances</Label>
          <Input
            id="minInstances"
            type="number"
            value={config.minInstances}
            onChange={(e) => updateConfig('minInstances', parseInt(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="maxInstances">Max Instances</Label>
          <Input
            id="maxInstances"
            type="number"
            value={config.maxInstances}
            onChange={(e) => updateConfig('maxInstances', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Database Configuration</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dbHost">Host</Label>
            <Input
              id="dbHost"
              value={config.database.host}
              onChange={(e) => updateConfig('database.host', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dbPort">Port</Label>
            <Input
              id="dbPort"
              type="number"
              value={config.database.port}
              onChange={(e) => updateConfig('database.port', parseInt(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="dbUsername">Username</Label>
            <Input
              id="dbUsername"
              value={config.database.username}
              onChange={(e) => updateConfig('database.username', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dbPassword">Password</Label>
            <Input
              id="dbPassword"
              type="password"
              value={config.database.password}
              onChange={(e) => updateConfig('database.password', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="dbDatabase">Database</Label>
            <Input
              id="dbDatabase"
              value={config.database.database}
              onChange={(e) => updateConfig('database.database', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Redis Configuration</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="redisHost">Host</Label>
            <Input
              id="redisHost"
              value={config.redis.host}
              onChange={(e) => updateConfig('redis.host', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="redisPort">Port</Label>
            <Input
              id="redisPort"
              type="number"
              value={config.redis.port}
              onChange={(e) => updateConfig('redis.port', parseInt(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="redisPassword">Password (optional)</Label>
            <Input
              id="redisPassword"
              type="password"
              value={config.redis.password || ''}
              onChange={(e) => updateConfig('redis.password', e.target.value || undefined)}
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Authentication Configuration</h4>
        <div className="space-y-4">
          <div>
            <Label htmlFor="betterAuthUrl">Better Auth URL</Label>
            <Input
              id="betterAuthUrl"
              value={config.auth.betterAuthUrl}
              onChange={(e) => updateConfig('auth.betterAuthUrl', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="betterAuthApiKey">Better Auth API Key</Label>
            <Input
              id="betterAuthApiKey"
              type="password"
              value={config.auth.betterAuthApiKey}
              onChange={(e) => updateConfig('auth.betterAuthApiKey', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="jwtSecret">JWT Secret</Label>
            <Input
              id="jwtSecret"
              type="password"
              value={config.auth.jwtSecret}
              onChange={(e) => updateConfig('auth.jwtSecret', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sessionSecret">Session Secret</Label>
            <Input
              id="sessionSecret"
              type="password"
              value={config.auth.sessionSecret}
              onChange={(e) => updateConfig('auth.sessionSecret', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSave}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          Save Configuration
        </Button>
      </div>
    </div>
  );
}