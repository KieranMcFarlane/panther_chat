'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Key, 
  Bell, 
  Shield,
  Monitor,
  Palette,
  Database,
  Save,
  RefreshCw
} from 'lucide-react';

interface UserSession {
  id: string;
  userId: string;
  email: string;
  isActive: boolean;
  expiresAt: Date;
  authProvider: string;
}

interface UserPreferencesProps {
  userSession: UserSession | null;
}

export default function UserPreferences({ userSession }: UserPreferencesProps) {
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    notifications: {
      email: true,
      browser: true,
      slotActivity: true,
      systemAlerts: true
    },
    interface: {
      sidebarCollapsed: false,
      compactMode: false,
      showResourceUsage: true,
      autoRefreshSlots: true
    },
    privacy: {
      analyticsEnabled: true,
      crashReports: true,
      activityTracking: false
    }
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const togglePreference = (category: string, key: string) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: !(prev[category as keyof typeof prev] as any)[key]
      }
    }));
  };

  return (
    <Card className="bg-custom-box border-custom-border">
      <CardHeader>
        <CardTitle className="font-header-lg text-header flex items-center gap-2">
          <Settings className="w-5 h-5 text-yellow-500" />
          User Preferences
        </CardTitle>
        <CardDescription className="text-slate-400">
          Customize your dashboard experience and configure personal settings.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="interface" className="space-y-6">
          <TabsList className="bg-custom-box border-custom-border">
            <TabsTrigger value="interface">Interface</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="interface" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Theme Settings */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Theme</span>
                      <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                        {preferences.theme}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      {['dark', 'light', 'auto'].map((theme) => (
                        <Button
                          key={theme}
                          size="sm"
                          variant={preferences.theme === theme ? 'default' : 'outline'}
                          onClick={() => setPreferences(prev => ({ ...prev, theme }))}
                          className={preferences.theme === theme ? 'bg-yellow-500 text-black' : ''}
                        >
                          {theme.charAt(0).toUpperCase() + theme.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Interface Settings */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    Interface Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(preferences.interface).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                      <Button
                        size="sm"
                        variant={value ? 'default' : 'outline'}
                        onClick={() => togglePreference('interface', key)}
                        className={value ? 'bg-yellow-500 text-black' : ''}
                      >
                        {value ? 'On' : 'Off'}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(preferences.notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <div>
                      <span className="text-sm text-slate-300">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        {key === 'email' && 'Receive email notifications about your slots'}
                        {key === 'browser' && 'Get browser notifications for important events'}
                        {key === 'slotActivity' && 'Notify when slots start or stop'}
                        {key === 'systemAlerts' && 'System maintenance and downtime alerts'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={value ? 'default' : 'outline'}
                      onClick={() => togglePreference('notifications', key)}
                      className={value ? 'bg-yellow-500 text-black' : ''}
                    >
                      {value ? 'On' : 'Off'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Privacy & Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(preferences.privacy).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <div>
                      <span className="text-sm text-slate-300">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        {key === 'analyticsEnabled' && 'Help improve ClaudeBox with anonymous usage data'}
                        {key === 'crashReports' && 'Automatically send crash reports to help fix issues'}
                        {key === 'activityTracking' && 'Track user activity for better experience'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={value ? 'default' : 'outline'}
                      onClick={() => togglePreference('privacy', key)}
                      className={value ? 'bg-yellow-500 text-black' : ''}
                    >
                      {value ? 'On' : 'Off'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <span className="text-sm text-slate-300">Email Address</span>
                    <span className="text-sm text-white">{userSession?.email}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <span className="text-sm text-slate-300">Authentication Method</span>
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      {userSession?.authProvider}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <span className="text-sm text-slate-300">Account Status</span>
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      Active
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <span className="text-sm text-slate-300">Session Expires</span>
                    <span className="text-sm text-white">
                      {userSession?.expiresAt.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-custom-border">
                  <Button variant="outline" className="w-full">
                    Change Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Data Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button variant="outline" className="w-full">
                    Export My Data
                  </Button>
                  <Button variant="outline" className="w-full text-red-400 hover:text-red-300">
                    Delete My Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end pt-6 border-t border-custom-border">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}