'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Shield, 
  Database, 
  Server,
  Users,
  Zap,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Key,
  Globe,
  Cpu,
  HardDrive,
  Activity,
  Bell,
  Mail
} from 'lucide-react';

interface SystemConfig {
  system: {
    maxSlotsPerUser: number;
    maxConcurrentSlots: number;
    sessionTimeout: number;
    slotInactivityTimeout: number;
    enableRateLimiting: boolean;
    rateLimitRequests: number;
    rateLimitWindow: number;
  };
  auth: {
    enableMultiProvider: boolean;
    requireEmailVerification: boolean;
    allowUserRegistration: boolean;
    sessionDuration: number;
    refreshTokenDuration: number;
    allowedProviders: string[];
  };
  resources: {
    maxMemoryPerSlot: number;
    maxCpuPerSlot: number;
    maxDiskPerSlot: number;
    networkBandwidthLimit: number;
    enableResourceMonitoring: boolean;
    cleanupInterval: number;
  };
  notifications: {
    emailEnabled: boolean;
    systemAlertsEnabled: boolean;
    userActivityEnabled: boolean;
    securityAlertsEnabled: boolean;
    smtpServer?: string;
    smtpPort?: number;
    smtpUser?: string;
  };
}

export default function SystemConfiguration() {
  const [config, setConfig] = useState<SystemConfig>({
    system: {
      maxSlotsPerUser: 3,
      maxConcurrentSlots: 50,
      sessionTimeout: 3600000,
      slotInactivityTimeout: 1800000,
      enableRateLimiting: true,
      rateLimitRequests: 100,
      rateLimitWindow: 60000
    },
    auth: {
      enableMultiProvider: true,
      requireEmailVerification: false,
      allowUserRegistration: true,
      sessionDuration: 86400000,
      refreshTokenDuration: 604800000,
      allowedProviders: ['claude-pro', 'google-oauth', 'github-oauth', 'api-key']
    },
    resources: {
      maxMemoryPerSlot: 2048,
      maxCpuPerSlot: 50,
      maxDiskPerSlot: 10240,
      networkBandwidthLimit: 1048576,
      enableResourceMonitoring: true,
      cleanupInterval: 300000
    },
    notifications: {
      emailEnabled: true,
      systemAlertsEnabled: true,
      userActivityEnabled: false,
      securityAlertsEnabled: true,
      smtpServer: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: 'notifications@claudebox.com'
    }
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleConfigChange = (section: keyof SystemConfig, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const saveConfiguration = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSaving(false);
    alert('Configuration saved successfully!');
  };

  const testConfiguration = async () => {
    setTesting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    setTesting(false);
    alert('Configuration test completed successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-header-xl text-header">System Configuration</h2>
          <p className="text-slate-400">Configure system-wide settings and parameters</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={testConfiguration}
            disabled={testing}
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 mr-2" />
            )}
            {testing ? 'Testing...' : 'Test Config'}
          </Button>
          <Button 
            onClick={saveConfiguration}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="bg-custom-box border-custom-border">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Server className="w-4 h-4" />
                System Settings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Core system configuration parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Max Slots Per User</Label>
                    <Input
                      type="number"
                      value={config.system.maxSlotsPerUser}
                      onChange={(e) => handleConfigChange('system', 'maxSlotsPerUser', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Maximum number of slots each user can create</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Max Concurrent Slots</Label>
                    <Input
                      type="number"
                      value={config.system.maxConcurrentSlots}
                      onChange={(e) => handleConfigChange('system', 'maxConcurrentSlots', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Maximum concurrent slots system-wide</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Session Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={config.system.sessionTimeout}
                      onChange={(e) => handleConfigChange('system', 'sessionTimeout', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">User session duration in milliseconds</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Slot Inactivity Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={config.system.slotInactivityTimeout}
                      onChange={(e) => handleConfigChange('system', 'slotInactivityTimeout', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Inactive slot timeout in milliseconds</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Rate Limit Requests</Label>
                    <Input
                      type="number"
                      value={config.system.rateLimitRequests}
                      onChange={(e) => handleConfigChange('system', 'rateLimitRequests', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Requests per rate limit window</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Rate Limit Window (ms)</Label>
                    <Input
                      type="number"
                      value={config.system.rateLimitWindow}
                      onChange={(e) => handleConfigChange('system', 'rateLimitWindow', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Rate limit time window in milliseconds</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                <div>
                  <span className="text-sm text-slate-300">Enable Rate Limiting</span>
                  <p className="text-xs text-slate-500">Enable API rate limiting</p>
                </div>
                <Button
                  size="sm"
                  variant={config.system.enableRateLimiting ? 'default' : 'outline'}
                  onClick={() => handleConfigChange('system', 'enableRateLimiting', !config.system.enableRateLimiting)}
                  className={config.system.enableRateLimiting ? 'bg-yellow-500 text-black' : ''}
                >
                  {config.system.enableRateLimiting ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Authentication Settings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Better Auth integration and authentication configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Session Duration (ms)</Label>
                    <Input
                      type="number"
                      value={config.auth.sessionDuration}
                      onChange={(e) => handleConfigChange('auth', 'sessionDuration', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Better Auth session duration</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Refresh Token Duration (ms)</Label>
                    <Input
                      type="number"
                      value={config.auth.refreshTokenDuration}
                      onChange={(e) => handleConfigChange('auth', 'refreshTokenDuration', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Better Auth refresh token duration</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Allowed Providers</Label>
                    <Textarea
                      value={config.auth.allowedProviders.join(', ')}
                      onChange={(e) => handleConfigChange('auth', 'allowedProviders', e.target.value.split(',').map(s => s.trim()))}
                      className="bg-custom-box border-custom-border text-white"
                      rows={4}
                    />
                    <p className="text-xs text-slate-500">Comma-separated list of allowed auth providers</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                  <div>
                    <span className="text-sm text-slate-300">Enable Multi-Provider</span>
                    <p className="text-xs text-slate-500">Allow multiple auth providers via Better Auth</p>
                  </div>
                  <Button
                    size="sm"
                    variant={config.auth.enableMultiProvider ? 'default' : 'outline'}
                    onClick={() => handleConfigChange('auth', 'enableMultiProvider', !config.auth.enableMultiProvider)}
                    className={config.auth.enableMultiProvider ? 'bg-yellow-500 text-black' : ''}
                  >
                    {config.auth.enableMultiProvider ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                  <div>
                    <span className="text-sm text-slate-300">Require Email Verification</span>
                    <p className="text-xs text-slate-500">Require email verification for new users</p>
                  </div>
                  <Button
                    size="sm"
                    variant={config.auth.requireEmailVerification ? 'default' : 'outline'}
                    onClick={() => handleConfigChange('auth', 'requireEmailVerification', !config.auth.requireEmailVerification)}
                    className={config.auth.requireEmailVerification ? 'bg-yellow-500 text-black' : ''}
                  >
                    {config.auth.requireEmailVerification ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                  <div>
                    <span className="text-sm text-slate-300">Allow User Registration</span>
                    <p className="text-xs text-slate-500">Allow new user registration</p>
                  </div>
                  <Button
                    size="sm"
                    variant={config.auth.allowUserRegistration ? 'default' : 'outline'}
                    onClick={() => handleConfigChange('auth', 'allowUserRegistration', !config.auth.allowUserRegistration)}
                    className={config.auth.allowUserRegistration ? 'bg-yellow-500 text-black' : ''}
                  >
                    {config.auth.allowUserRegistration ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Resource Management
              </CardTitle>
              <CardDescription className="text-slate-400">
                Resource limits and monitoring configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Max Memory Per Slot (MB)</Label>
                    <Input
                      type="number"
                      value={config.resources.maxMemoryPerSlot}
                      onChange={(e) => handleConfigChange('resources', 'maxMemoryPerSlot', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Maximum memory per slot in MB</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Max CPU Per Slot (%)</Label>
                    <Input
                      type="number"
                      value={config.resources.maxCpuPerSlot}
                      onChange={(e) => handleConfigChange('resources', 'maxCpuPerSlot', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Maximum CPU usage per slot in percentage</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Max Disk Per Slot (MB)</Label>
                    <Input
                      type="number"
                      value={config.resources.maxDiskPerSlot}
                      onChange={(e) => handleConfigChange('resources', 'maxDiskPerSlot', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Maximum disk space per slot in MB</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Network Bandwidth Limit (KB/s)</Label>
                    <Input
                      type="number"
                      value={config.resources.networkBandwidthLimit}
                      onChange={(e) => handleConfigChange('resources', 'networkBandwidthLimit', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Network bandwidth limit per slot</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Cleanup Interval (ms)</Label>
                    <Input
                      type="number"
                      value={config.resources.cleanupInterval}
                      onChange={(e) => handleConfigChange('resources', 'cleanupInterval', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                    <p className="text-xs text-slate-500">Resource cleanup interval in milliseconds</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                <div>
                  <span className="text-sm text-slate-300">Enable Resource Monitoring</span>
                  <p className="text-xs text-slate-500">Enable real-time resource monitoring</p>
                </div>
                <Button
                  size="sm"
                  variant={config.resources.enableResourceMonitoring ? 'default' : 'outline'}
                  onClick={() => handleConfigChange('resources', 'enableResourceMonitoring', !config.resources.enableResourceMonitoring)}
                  className={config.resources.enableResourceMonitoring ? 'bg-yellow-500 text-black' : ''}
                >
                  {config.resources.enableResourceMonitoring ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Settings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Email and system notification configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">SMTP Server</Label>
                    <Input
                      value={config.notifications.smtpServer}
                      onChange={(e) => handleConfigChange('notifications', 'smtpServer', e.target.value)}
                      className="bg-custom-box border-custom-border text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">SMTP Port</Label>
                    <Input
                      type="number"
                      value={config.notifications.smtpPort}
                      onChange={(e) => handleConfigChange('notifications', 'smtpPort', parseInt(e.target.value))}
                      className="bg-custom-box border-custom-border text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">SMTP Username</Label>
                    <Input
                      value={config.notifications.smtpUser}
                      onChange={(e) => handleConfigChange('notifications', 'smtpUser', e.target.value)}
                      className="bg-custom-box border-custom-border text-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <div>
                      <span className="text-sm text-slate-300">Email Notifications</span>
                      <p className="text-xs text-slate-500">Enable email notifications</p>
                    </div>
                    <Button
                      size="sm"
                      variant={config.notifications.emailEnabled ? 'default' : 'outline'}
                      onClick={() => handleConfigChange('notifications', 'emailEnabled', !config.notifications.emailEnabled)}
                      className={config.notifications.emailEnabled ? 'bg-yellow-500 text-black' : ''}
                    >
                      {config.notifications.emailEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <div>
                      <span className="text-sm text-slate-300">System Alerts</span>
                      <p className="text-xs text-slate-500">Enable system alert notifications</p>
                    </div>
                    <Button
                      size="sm"
                      variant={config.notifications.systemAlertsEnabled ? 'default' : 'outline'}
                      onClick={() => handleConfigChange('notifications', 'systemAlertsEnabled', !config.notifications.systemAlertsEnabled)}
                      className={config.notifications.systemAlertsEnabled ? 'bg-yellow-500 text-black' : ''}
                    >
                      {config.notifications.systemAlertsEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <div>
                      <span className="text-sm text-slate-300">User Activity</span>
                      <p className="text-xs text-slate-500">Enable user activity notifications</p>
                    </div>
                    <Button
                      size="sm"
                      variant={config.notifications.userActivityEnabled ? 'default' : 'outline'}
                      onClick={() => handleConfigChange('notifications', 'userActivityEnabled', !config.notifications.userActivityEnabled)}
                      className={config.notifications.userActivityEnabled ? 'bg-yellow-500 text-black' : ''}
                    >
                      {config.notifications.userActivityEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <div>
                      <span className="text-sm text-slate-300">Security Alerts</span>
                      <p className="text-xs text-slate-500">Enable security alert notifications</p>
                    </div>
                    <Button
                      size="sm"
                      variant={config.notifications.securityAlertsEnabled ? 'default' : 'outline'}
                      onClick={() => handleConfigChange('notifications', 'securityAlertsEnabled', !config.notifications.securityAlertsEnabled)}
                      className={config.notifications.securityAlertsEnabled ? 'bg-yellow-500 text-black' : ''}
                    >
                      {config.notifications.securityAlertsEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Advanced Settings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Advanced system configuration options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Advanced settings can affect system performance and stability. Modify with caution.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300">System Configuration (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(config, null, 2)}
                    readOnly
                    className="bg-custom-box border-custom-border text-white font-mono text-xs"
                    rows={20}
                  />
                  <p className="text-xs text-slate-500">Current system configuration in JSON format</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}