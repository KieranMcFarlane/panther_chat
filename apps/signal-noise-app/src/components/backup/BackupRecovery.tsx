'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Play,
  Pause,
  Trash2,
  Calendar,
  HardDrive,
  Users,
  Key,
  FileText,
  Activity,
  Zap,
  Server,
  Archive,
  RotateCcw,
  TestTube
} from 'lucide-react';
import { backupManager } from '@/services/backup-manager';
import { 
  BackupJob, 
  RestoreJob, 
  BackupStorage, 
  DisasterRecoveryPlan,
  BackupJobConfig,
  RestoreConfig
} from '@/types/backup';

export default function BackupRecovery() {
  const [backupJobs, setBackupJobs] = useState<BackupJob[]>([]);
  const [restoreJobs, setRestoreJobs] = useState<RestoreJob[]>([]);
  const [storageLocations, setStorageLocations] = useState<BackupStorage[]>([]);
  const [disasterRecoveryPlans, setDisasterRecoveryPlans] = useState<DisasterRecoveryPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadData();
    
    if (autoRefresh) {
      const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      setBackupJobs(backupManager.getBackupJobs());
      setRestoreJobs(backupManager.getRestoreJobs());
      setStorageLocations(backupManager.getStorageLocations());
      setDisasterRecoveryPlans(backupManager.getDisasterRecoveryPlans());
    } catch (error) {
      console.error('Failed to load backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async (slotId: string) => {
    try {
      const config: BackupJobConfig = {
        includeWorkDirectory: true,
        includeAuthConfig: true,
        includeUserData: true,
        encryptionEnabled: false,
        compressionEnabled: true,
        retentionDays: 30,
        scheduled: false
      };

      await backupManager.createBackupJob(slotId, config);
      loadData();
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  const handleCreateRestore = async (backupId: string) => {
    try {
      const config: RestoreConfig = {
        restoreWorkDirectory: true,
        restoreAuthConfig: true,
        restoreUserData: true,
        overwriteExisting: true,
        verifyIntegrity: true,
        dryRun: false
      };

      await backupManager.createRestoreJob(backupId, config);
      loadData();
    } catch (error) {
      console.error('Failed to create restore:', error);
    }
  };

  const handleTestDisasterRecovery = async (planId: string) => {
    try {
      await backupManager.testDisasterRecovery(planId);
      loadData();
    } catch (error) {
      console.error('Failed to test disaster recovery:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
      case 'success':
        return 'text-green-400 bg-green-900 border-green-600';
      case 'running':
        return 'text-blue-400 bg-blue-900 border-blue-600';
      case 'pending':
        return 'text-yellow-400 bg-yellow-900 border-yellow-600';
      case 'failed':
      case 'error':
        return 'text-red-400 bg-red-900 border-red-600';
      case 'cancelled':
        return 'text-gray-400 bg-gray-900 border-gray-600';
      default:
        return 'text-gray-400 bg-gray-900 border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold text-white">Backup & Recovery</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Storage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {storageLocations.map((storage) => (
          <Card key={storage.id} className="bg-custom-box border-custom-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">{storage.name}</p>
                  <p className="text-lg font-bold">{formatBytes(storage.capacity.used)}</p>
                  <p className="text-xs text-slate-500">
                    of {formatBytes(storage.capacity.total)}
                  </p>
                </div>
                <HardDrive className="w-8 h-8 text-blue-500" />
              </div>
              <div className="mt-3">
                <Progress 
                  value={(storage.capacity.used / storage.capacity.total) * 100} 
                  className="h-2" 
                />
                <p className="text-xs text-slate-500 mt-1">
                  {((storage.capacity.used / storage.capacity.total) * 100).toFixed(1)}% used
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="backups" className="space-y-6">
        <TabsList className="bg-custom-box border-custom-border">
          <TabsTrigger value="backups">Backup Jobs</TabsTrigger>
          <TabsTrigger value="restores">Restore Jobs</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="disaster-recovery">Disaster Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="backups" className="space-y-6">
          {/* Backup Controls */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Create Backup
              </CardTitle>
              <CardDescription className="text-slate-400">
                Create new backup jobs for active slots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select>
                  <SelectTrigger className="w-64 bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select slot to backup" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slot-1">ClaudeBox Slot 1</SelectItem>
                    <SelectItem value="slot-2">ClaudeBox Slot 2</SelectItem>
                    <SelectItem value="slot-3">ClaudeBox Slot 3</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => handleCreateBackup('slot-1')}>
                  <Upload className="w-4 h-4 mr-2" />
                  Create Backup
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Backup Jobs List */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Database className="w-4 h-4" />
                Backup Jobs
              </CardTitle>
              <CardDescription className="text-slate-400">
                Monitor and manage backup operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin text-yellow-500" />
                </div>
              ) : backupJobs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Database className="w-12 h-12 mx-auto mb-4" />
                  <p>No backup jobs found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {backupJobs.map((job) => (
                    <div key={job.id} className="p-4 border border-slate-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(job.status)}
                          <div>
                            <p className="font-medium text-white">Backup {job.slotId}</p>
                            <p className="text-sm text-slate-400">
                              {job.startTime ? `Started at ${job.startTime.toLocaleString()}` : 'Not started'}
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      
                      {job.progress > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-400">Progress</span>
                            <span className="text-sm text-white">{job.progress}%</span>
                          </div>
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}
                      
                      {job.error && (
                        <div className="p-3 bg-red-900 border border-red-700 rounded">
                          <p className="text-sm text-red-400">{job.error instanceof Error ? job.error.message : String(job.error)}</p>
                        </div>
                      )}
                      
                      {job.endTime && job.startTime && (
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span>Duration</span>
                          <span>{formatDuration(job.endTime.getTime() - job.startTime.getTime())}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restores" className="space-y-6">
          {/* Restore Controls */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Download className="w-4 h-4" />
                Restore from Backup
              </CardTitle>
              <CardDescription className="text-slate-400">
                Restore data from existing backups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select>
                  <SelectTrigger className="w-64 bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select backup to restore" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backup-1">Backup from 2024-01-15</SelectItem>
                    <SelectItem value="backup-2">Backup from 2024-01-14</SelectItem>
                    <SelectItem value="backup-3">Backup from 2024-01-13</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => handleCreateRestore('backup-1')}>
                  <Download className="w-4 h-4 mr-2" />
                  Start Restore
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Restore Jobs List */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Restore Jobs
              </CardTitle>
              <CardDescription className="text-slate-400">
                Monitor and manage restore operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin text-yellow-500" />
                </div>
              ) : restoreJobs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <RotateCcw className="w-12 h-12 mx-auto mb-4" />
                  <p>No restore jobs found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {restoreJobs.map((job) => (
                    <div key={job.id} className="p-4 border border-slate-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(job.status)}
                          <div>
                            <p className="font-medium text-white">Restore {job.backupId}</p>
                            <p className="text-sm text-slate-400">
                              {job.startTime ? `Started at ${job.startTime.toLocaleString()}` : 'Not started'}
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      
                      {job.progress > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-400">Progress</span>
                            <span className="text-sm text-white">{job.progress}%</span>
                          </div>
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}
                      
                      {job.error && (
                        <div className="p-3 bg-red-900 border border-red-700 rounded">
                          <p className="text-sm text-red-400">{job.error instanceof Error ? job.error.message : String(job.error)}</p>
                        </div>
                      )}
                      
                      {job.endTime && job.startTime && (
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span>Duration</span>
                          <span>{formatDuration(job.endTime.getTime() - job.startTime.getTime())}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Server className="w-4 h-4" />
                Storage Locations
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage backup storage locations and capacity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {storageLocations.map((storage) => (
                  <div key={storage.id} className="p-4 border border-slate-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-white">{storage.name}</p>
                        <p className="text-sm text-slate-400">
                          {storage.type} • {storage.location}
                        </p>
                      </div>
                      <Badge className={getStatusColor(storage.status)}>
                        {storage.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-slate-400">Total Capacity</p>
                        <p className="text-lg font-bold">{formatBytes(storage.capacity.total)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Used Space</p>
                        <p className="text-lg font-bold">{formatBytes(storage.capacity.used)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Cleanup
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button className="w-full mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Storage Location
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disaster-recovery" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Disaster Recovery Plans
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage and test disaster recovery procedures
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {disasterRecoveryPlans.map((plan) => (
                  <div key={plan.id} className="p-4 border border-slate-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-white">{plan.name}</p>
                        <p className="text-sm text-slate-400">
                          RPO: {plan.rpo}min • RTO: {plan.rto}min
                        </p>
                        <p className="text-xs text-slate-500">{plan.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {plan.lastTest && (
                          <Badge variant="outline" className={
                            plan.lastTest.status === 'success' ? 'text-green-400 border-green-400' :
                            plan.lastTest.status === 'failed' ? 'text-red-400 border-red-400' :
                            'text-yellow-400 border-yellow-400'
                          }>
                            Last test: {plan.lastTest.status}
                          </Badge>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestDisasterRecovery(plan.id)}
                        >
                          <TestTube className="w-4 h-4 mr-2" />
                          Test
                        </Button>
                      </div>
                    </div>
                    
                    {plan.lastTest && (
                      <div className="mt-3 p-3 bg-slate-800 rounded">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-slate-400">Duration:</span>
                            <span className="text-white ml-1">{formatDuration(plan.lastTest.duration)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Data Verified:</span>
                            <span className={`ml-1 ${plan.lastTest.dataVerified ? 'text-green-400' : 'text-red-400'}`}>
                              {plan.lastTest.dataVerified ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Recovery Time:</span>
                            <span className="text-white ml-1">{formatDuration(plan.lastTest.recoveryTime)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Test Date:</span>
                            <span className="text-white ml-1">{plan.lastTest.timestamp.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                <Button className="w-full mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Disaster Recovery Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}