'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Key, 
  Users, 
  RefreshCw, 
  CheckCircle,
  AlertCircle,
  Settings,
  Plus,
  Trash2
} from 'lucide-react';

interface UserSession {
  id: string;
  userId: string;
  email: string;
  isActive: boolean;
  expiresAt: Date;
  authProvider: string;
}

interface BetterAuthProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml' | 'api-key';
  status: 'active' | 'inactive' | 'error';
  configured: boolean;
  lastUsed?: Date;
}

interface BetterAuthManagerProps {
  userSession: UserSession | null;
}

export default function BetterAuthManager({ userSession }: BetterAuthManagerProps) {
  const [providers, setProviders] = useState<BetterAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('providers');

  // Mock Better Auth providers
  useEffect(() => {
    const loadProviders = async () => {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockProviders: BetterAuthProvider[] = [
        {
          id: 'google-oauth',
          name: 'Google OAuth',
          type: 'oauth2',
          status: 'active',
          configured: true,
          lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          id: 'github-oauth',
          name: 'GitHub OAuth',
          type: 'oauth2',
          status: 'active',
          configured: true,
          lastUsed: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        {
          id: 'azure-saml',
          name: 'Azure AD SAML',
          type: 'saml',
          status: 'inactive',
          configured: false
        },
        {
          id: 'okta-oidc',
          name: 'Okta OIDC',
          type: 'oidc',
          status: 'active',
          configured: true,
          lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      ];

      setProviders(mockProviders);
      setLoading(false);
    };

    loadProviders();
  }, []);

  const configureProvider = async (providerId: string) => {
    console.log(`Configuring provider: ${providerId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setProviders(prev => prev.map(p => 
      p.id === providerId 
        ? { ...p, configured: true, status: 'active' }
        : p
    ));
  };

  const removeProvider = async (providerId: string) => {
    console.log(`Removing provider: ${providerId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setProviders(prev => prev.map(p => 
      p.id === providerId 
        ? { ...p, configured: false, status: 'inactive' }
        : p
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getProviderTypeColor = (type: string) => {
    switch (type) {
      case 'oauth2': return 'text-blue-400 border-blue-400';
      case 'oidc': return 'text-purple-400 border-purple-400';
      case 'saml': return 'text-green-400 border-green-400';
      case 'api-key': return 'text-yellow-400 border-yellow-400';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  if (loading) {
    return (
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="font-header-lg text-header flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Better Auth Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-yellow-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-custom-box border-custom-border">
      <CardHeader>
        <CardTitle className="font-header-lg text-header flex items-center gap-2">
          <Shield className="w-5 h-5 text-yellow-500" />
          Better Auth Manager
        </CardTitle>
        <CardDescription className="text-slate-400">
          Manage authentication providers and configure Better Auth integration for your ClaudeBox slots.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-custom-box border-custom-border">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            {/* Current Session Info */}
            <Alert className="border-green-500 bg-green-500 bg-opacity-10">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-green-300">
                Currently authenticated via {userSession?.authProvider} • 
                Session expires: {userSession?.expiresAt.toLocaleString()}
              </AlertDescription>
            </Alert>

            {/* Auth Providers List */}
            <div className="space-y-3">
              {providers.map((provider) => (
                <Card key={provider.id} className="bg-custom-box border-custom-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(provider.status)}`} />
                        <div>
                          <h4 className="font-medium text-white">{provider.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={getProviderTypeColor(provider.type)}>
                              {provider.type.toUpperCase()}
                            </Badge>
                            {provider.configured && (
                              <Badge variant="outline" className="text-green-400 border-green-400">
                                Configured
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {provider.lastUsed && (
                          <span className="text-xs text-slate-400">
                            Used {provider.lastUsed.toLocaleDateString()}
                          </span>
                        )}
                        
                        {provider.configured ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeProvider(provider.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-black"
                            onClick={() => configureProvider(provider.id)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Configure
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add New Provider */}
            <Button variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add New Provider
            </Button>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Session management allows you to view and control active user sessions across all your ClaudeBox slots.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {/* Current Session */}
              <Card className="bg-custom-box border-custom-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <div>
                        <h4 className="font-medium text-white">Current Session</h4>
                        <p className="text-sm text-slate-400">
                          {userSession?.email} • {userSession?.authProvider}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Mock other sessions */}
              <Card className="bg-custom-box border-custom-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <div>
                        <h4 className="font-medium text-white">Mobile Session</h4>
                        <p className="text-sm text-slate-400">
                          Safari on iPhone • 2 hours ago
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-gray-400 border-gray-400">
                      Expired
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                Configure Better Auth settings including security policies, session timeouts, and provider preferences.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {/* Security Settings */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header">Security Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Session Timeout</h4>
                      <p className="text-sm text-slate-400">Duration before sessions expire</p>
                    </div>
                    <Badge variant="outline">24 hours</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Require MFA</h4>
                      <p className="text-sm text-slate-400">Multi-factor authentication requirement</p>
                    </div>
                    <Badge variant="outline" className="text-gray-400 border-gray-400">
                      Disabled
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Provider Settings */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header">Provider Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Default Provider</h4>
                      <p className="text-sm text-slate-400">Primary authentication method</p>
                    </div>
                    <Badge variant="outline">Google OAuth</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Allow Multiple Providers</h4>
                      <p className="text-sm text-slate-400">Users can connect multiple auth methods</p>
                    </div>
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      Enabled
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}