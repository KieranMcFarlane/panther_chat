'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Key, 
  Settings, 
  Shield, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Save,
  TestTube
} from 'lucide-react';

interface Slot {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error' | 'creating';
  authProvider: string;
  createdAt: Date;
  lastActivity: Date;
  cpuUsage: number;
  memoryUsage: number;
}

interface AuthConfigurationProps {
  slots: Slot[];
}

interface AuthConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
  metadata: Record<string, any>;
}

export default function AuthConfiguration({ slots }: AuthConfigurationProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>(slots[0]?.id || '');
  const [authConfigs, setAuthConfigs] = useState<{[key: string]: AuthConfig}>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableProviders = [
    { id: 'claude-pro', name: 'Claude Pro', type: 'api-key' },
    { id: 'claude-api', name: 'Claude API Key', type: 'api-key' },
    { id: 'claude-team', name: 'Claude Team', type: 'oauth2' },
    { id: 'google-oauth', name: 'Google OAuth', type: 'oauth2' },
    { id: 'github-oauth', name: 'GitHub OAuth', type: 'oauth2' },
    { id: 'azure-saml', name: 'Azure AD SAML', type: 'saml' },
    { id: 'okta-oidc', name: 'Okta OIDC', type: 'oidc' },
    { id: 'demo', name: 'Demo Mode', type: 'demo' }
  ];

  const handleConfigChange = (slotId: string, field: string, value: any) => {
    setAuthConfigs(prev => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        provider: prev[slotId]?.provider || 'claude-pro',
        [field]: value
      }
    }));
  };

  const testAuthConfig = async (slotId: string) => {
    setTesting(slotId);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setTesting(null);
    
    // Show success message (in real app, this would come from API)
    alert(`Authentication test successful for slot ${slotId}`);
  };

  const saveAuthConfig = async (slotId: string) => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    
    // Show success message
    alert(`Authentication configuration saved for slot ${slotId}`);
  };

  const selectedSlotData = slots.find(s => s.id === selectedSlot);
  const currentConfig = authConfigs[selectedSlot] || {};

  return (
    <Card className="bg-custom-box border-custom-border">
      <CardHeader>
        <CardTitle className="font-header-lg text-header flex items-center gap-2">
          <Shield className="w-5 h-5 text-yellow-500" />
          Authentication Configuration
        </CardTitle>
        <CardDescription className="text-slate-400">
          Configure authentication methods for your ClaudeBox slots.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Slot Selection */}
        <div className="mb-6">
          <Label htmlFor="slot-select" className="text-sm font-medium text-slate-300">
            Select Slot to Configure
          </Label>
          <Select value={selectedSlot} onValueChange={setSelectedSlot}>
            <SelectTrigger className="bg-custom-box border-custom-border text-white">
              <SelectValue placeholder="Choose a slot" />
            </SelectTrigger>
            <SelectContent>
              {slots.map((slot) => (
                <SelectItem key={slot.id} value={slot.id}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      slot.status === 'active' ? 'bg-green-500' :
                      slot.status === 'inactive' ? 'bg-gray-500' :
                      'bg-red-500'
                    }`} />
                    {slot.name}
                    <Badge variant="outline" className="text-xs">
                      {slot.authProvider}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSlotData && (
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList className="bg-custom-box border-custom-border">
              <TabsTrigger value="basic">Basic Config</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-300">Authentication Provider</Label>
                <Select 
                  value={currentConfig.provider || 'claude-pro'} 
                  onValueChange={(value) => handleConfigChange(selectedSlot, 'provider', value)}
                >
                  <SelectTrigger className="bg-custom-box border-custom-border text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {provider.type}
                          </Badge>
                          {provider.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* API Key Configuration (for API key providers) */}
              {(currentConfig.provider === 'claude-pro' || currentConfig.provider === 'claude-api') && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300">API Key</Label>
                  <Input
                    type="password"
                    placeholder="Enter your API key"
                    className="bg-custom-box border-custom-border text-white"
                    value={currentConfig.clientSecret || ''}
                    onChange={(e) => handleConfigChange(selectedSlot, 'clientSecret', e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Your API key will be encrypted and stored securely.
                  </p>
                </div>
              )}

              {/* OAuth Configuration */}
              {(currentConfig.provider === 'google-oauth' || currentConfig.provider === 'github-oauth' || currentConfig.provider === 'claude-team') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Client ID</Label>
                    <Input
                      placeholder="Enter client ID"
                      className="bg-custom-box border-custom-border text-white"
                      value={currentConfig.clientId || ''}
                      onChange={(e) => handleConfigChange(selectedSlot, 'clientId', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Client Secret</Label>
                    <Input
                      type="password"
                      placeholder="Enter client secret"
                      className="bg-custom-box border-custom-border text-white"
                      value={currentConfig.clientSecret || ''}
                      onChange={(e) => handleConfigChange(selectedSlot, 'clientSecret', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-300">Redirect URI</Label>
                    <Input
                      placeholder="https://your-domain.com/auth/callback"
                      className="bg-custom-box border-custom-border text-white"
                      value={currentConfig.redirectUri || ''}
                      onChange={(e) => handleConfigChange(selectedSlot, 'redirectUri', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* SAML Configuration */}
              {currentConfig.provider === 'azure-saml' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    SAML configuration requires additional setup. Please contact your administrator for SAML metadata and configuration details.
                  </AlertDescription>
                </Alert>
              )}

              {/* Save Button */}
              <Button 
                onClick={() => saveAuthConfig(selectedSlot)}
                disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Configuration
              </Button>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300">Scopes</Label>
                  <Textarea
                    placeholder="openid profile email"
                    className="bg-custom-box border-custom-border text-white"
                    value={currentConfig.scopes?.join(' ') || ''}
                    onChange={(e) => handleConfigChange(selectedSlot, 'scopes', e.target.value.split(' '))}
                  />
                  <p className="text-xs text-slate-500">
                    Enter OAuth scopes separated by spaces.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300">Additional Configuration</Label>
                  <Textarea
                    placeholder="JSON configuration for additional settings"
                    className="bg-custom-box border-custom-border text-white font-mono text-xs"
                    rows={6}
                    value={currentConfig.metadata ? JSON.stringify(currentConfig.metadata, null, 2) : ''}
                    onChange={(e) => {
                      try {
                        const metadata = JSON.parse(e.target.value);
                        handleConfigChange(selectedSlot, 'metadata', metadata);
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    Enter additional configuration as JSON.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="testing" className="space-y-4">
              <Alert>
                <TestTube className="h-4 w-4" />
                <AlertDescription>
                  Test your authentication configuration to ensure it works correctly.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-custom-box border-custom-border">
                    <CardHeader>
                      <CardTitle className="font-header-md text-header">Configuration Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Provider</span>
                          <Badge variant="outline">
                            {currentConfig.provider || 'Not configured'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Client ID</span>
                          <Badge variant={currentConfig.clientId ? "outline" : "outline"} className={
                            currentConfig.clientId ? "text-green-400 border-green-400" : "text-gray-400 border-gray-400"
                          }>
                            {currentConfig.clientId ? "Set" : "Not set"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Client Secret</span>
                          <Badge variant={currentConfig.clientSecret ? "outline" : "outline"} className={
                            currentConfig.clientSecret ? "text-green-400 border-green-400" : "text-gray-400 border-gray-400"
                          }>
                            {currentConfig.clientSecret ? "Set" : "Not set"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-custom-box border-custom-border">
                    <CardHeader>
                      <CardTitle className="font-header-md text-header">Test Authentication</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400 mb-4">
                        Test the current authentication configuration.
                      </p>
                      <Button 
                        onClick={() => testAuthConfig(selectedSlot)}
                        disabled={testing === selectedSlot}
                        className="w-full"
                      >
                        {testing === selectedSlot ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        {testing === selectedSlot ? 'Testing...' : 'Test Configuration'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}