'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  UserX, 
  Shield, 
  Key,
  Mail,
  Calendar,
  Activity,
  Search,
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  displayName: string;
  authProvider: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  role: 'user' | 'admin' | 'moderator';
  createdAt: Date;
  lastLogin: Date;
  emailVerified: boolean;
  slotCount: number;
  totalUsage: number;
  sessionCount: number;
  permissions: string[];
}

interface UserSession {
  id: string;
  userId: string;
  userEmail: string;
  slotId: string;
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'expired' | 'terminated';
  ipAddress: string;
  userAgent: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock users
    const mockUsers: User[] = Array.from({ length: 25 }, (_, i) => ({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      displayName: `User ${i + 1}`,
      authProvider: ['claude-pro', 'google-oauth', 'github-oauth', 'api-key'][Math.floor(Math.random() * 4)],
      status: ['active', 'inactive', 'suspended', 'pending'][Math.floor(Math.random() * 4)] as 'active' | 'inactive' | 'suspended' | 'pending',
      role: i === 0 ? 'admin' : (i < 3 ? 'moderator' : 'user'),
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      emailVerified: Math.random() > 0.1,
      slotCount: Math.floor(Math.random() * 5) + 1,
      totalUsage: Math.random() * 200 + 10,
      sessionCount: Math.floor(Math.random() * 50) + 1,
      permissions: i === 0 ? ['*'] : (i < 3 ? ['users:read', 'slots:read'] : ['slots:read', 'slots:write'])
    }));

    // Mock sessions
    const mockSessions: UserSession[] = Array.from({ length: 15 }, (_, i) => ({
      id: `session-${i + 1}`,
      userId: `user-${Math.floor(Math.random() * 25) + 1}`,
      userEmail: `user${Math.floor(Math.random() * 25) + 1}@example.com`,
      slotId: `slot-${Math.floor(Math.random() * 20) + 1}`,
      startTime: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      lastActivity: new Date(Date.now() - Math.random() * 4 * 60 * 60 * 1000),
      status: ['active', 'expired', 'terminated'][Math.floor(Math.random() * 3)] as 'active' | 'expired' | 'terminated',
      ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }));

    setUsers(mockUsers);
    setSessions(mockSessions);
    setLoading(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUserAction = async (userId: string, action: string) => {
    switch (action) {
      case 'suspend':
        alert(`User ${userId} suspended`);
        break;
      case 'activate':
        alert(`User ${userId} activated`);
        break;
      case 'delete':
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
          alert(`User ${userId} deleted`);
        }
        break;
      case 'reset_password':
        alert(`Password reset email sent for user ${userId}`);
        break;
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to terminate this session?')) {
      alert(`Session ${sessionId} terminated`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-header-xl text-header">User Management</h2>
          <p className="text-slate-400">Manage system users, sessions, and permissions</p>
        </div>
        <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-slate-500">Registered</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Users</p>
                <p className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</p>
                <p className="text-xs text-slate-500">Currently active</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Suspended</p>
                <p className="text-2xl font-bold">{users.filter(u => u.status === 'suspended').length}</p>
                <p className="text-xs text-slate-500">Suspended accounts</p>
              </div>
              <UserX className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Sessions</p>
                <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'active').length}</p>
                <p className="text-xs text-slate-500">Current sessions</p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-custom-box border-custom-border">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Search and Filters */}
          <Card className="bg-custom-box border-custom-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search users by email or name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-custom-box border-custom-border text-white pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-custom-box border-custom-border text-white w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header">User Accounts</CardTitle>
              <CardDescription className="text-slate-400">
                Manage registered users and their account settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.slice(0, 10).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-custom-border rounded hover:bg-custom-border/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        user.status === 'active' ? 'bg-green-500' :
                        user.status === 'inactive' ? 'bg-gray-500' :
                        user.status === 'suspended' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-white">{user.displayName}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {user.authProvider}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${
                            user.role === 'admin' ? 'text-red-400 border-red-400' :
                            user.role === 'moderator' ? 'text-yellow-400 border-yellow-400' :
                            'text-blue-400 border-blue-400'
                          }`}>
                            {user.role}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">
                          {user.slotCount} slots • {user.totalUsage.toFixed(1)}h
                        </p>
                        <p className="text-xs text-slate-500">
                          Last login: {user.lastLogin.toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          user.status === 'active' ? 'text-green-400 border-green-400' :
                          user.status === 'inactive' ? 'text-gray-400 border-gray-400' :
                          user.status === 'suspended' ? 'text-red-400 border-red-400' :
                          'text-yellow-400 border-yellow-400'
                        }>
                          {user.status}
                        </Badge>
                        
                        <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        
                        {user.status === 'active' ? (
                          <Button variant="outline" size="sm" onClick={() => handleUserAction(user.id, 'suspend')}>
                            <Ban className="w-3 h-3" />
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleUserAction(user.id, 'activate')}>
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                        
                        <Button variant="outline" size="sm" onClick={() => handleUserAction(user.id, 'delete')}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Active User Sessions
              </CardTitle>
              <CardDescription className="text-slate-400">
                Monitor and manage active user sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.filter(s => s.status === 'active').map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border border-custom-border rounded">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        session.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-white">{session.userEmail}</p>
                        <p className="text-xs text-slate-400">
                          Slot: {session.slotId} • IP: {session.ipAddress}
                        </p>
                        <p className="text-xs text-slate-500">
                          Started: {session.startTime.toLocaleString()} • Last activity: {session.lastActivity.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        session.status === 'active' ? 'text-green-400 border-green-400' : 'text-red-400 border-red-400'
                      }>
                        {session.status}
                      </Badge>
                      
                      {session.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => terminateSession(session.id)}>
                          <Ban className="w-3 h-3 mr-1" />
                          Terminate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Permission Management
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage user roles and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Permission management allows you to control user access to different system features and functionality.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-custom-box border-custom-border">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-white mb-2">Admin Users</h4>
                      <p className="text-sm text-slate-400 mb-3">Full system access</p>
                      <div className="space-y-2">
                        {users.filter(u => u.role === 'admin').map(user => (
                          <div key={user.id} className="flex items-center justify-between">
                            <span className="text-sm text-white">{user.email}</span>
                            <Badge variant="outline" className="text-red-400 border-red-400 text-xs">
                              Admin
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-custom-box border-custom-border">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-white mb-2">Moderators</h4>
                      <p className="text-sm text-slate-400 mb-3">Limited admin access</p>
                      <div className="space-y-2">
                        {users.filter(u => u.role === 'moderator').map(user => (
                          <div key={user.id} className="flex items-center justify-between">
                            <span className="text-sm text-white">{user.email}</span>
                            <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs">
                              Mod
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-custom-box border-custom-border">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-white mb-2">Regular Users</h4>
                      <p className="text-sm text-slate-400 mb-3">Standard user access</p>
                      <div className="space-y-2">
                        {users.filter(u => u.role === 'user').slice(0, 5).map(user => (
                          <div key={user.id} className="flex items-center justify-between">
                            <span className="text-sm text-white">{user.email}</span>
                            <Badge variant="outline" className="text-blue-400 border-blue-400 text-xs">
                              User
                            </Badge>
                          </div>
                        ))}
                        {users.filter(u => u.role === 'user').length > 5 && (
                          <p className="text-xs text-slate-500">
                            +{users.filter(u => u.role === 'user').length - 5} more users
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}