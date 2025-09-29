'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Settings, 
  Trash2, 
  RefreshCw,
  Monitor,
  Zap,
  Database,
  Plus,
  Terminal
} from 'lucide-react';
import IframeViewer from './IframeViewer';

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

interface UserSession {
  id: string;
  userId: string;
  email: string;
  isActive: boolean;
  expiresAt: Date;
  authProvider: string;
}

interface SlotOverviewProps {
  slots: Slot[];
  userSession: UserSession | null;
}

export default function SlotOverview({ slots, userSession }: SlotOverviewProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showIframe, setShowIframe] = useState(false);
  const [activeIframeSlot, setActiveIframeSlot] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      case 'creating': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'error': return 'Error';
      case 'creating': return 'Creating...';
      default: return 'Unknown';
    }
  };

  const getAuthProviderColor = (provider: string) => {
    switch (provider) {
      case 'claude-pro': return 'text-purple-400 border-purple-400';
      case 'api-key': return 'text-blue-400 border-blue-400';
      case 'demo': return 'text-yellow-400 border-yellow-400';
      case 'better-auth': return 'text-green-400 border-green-400';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  const handleSlotAction = async (slotId: string, action: string) => {
    console.log(`Slot action: ${action} for slot ${slotId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const openSlotInIframe = (slot: Slot) => {
    setSelectedSlot(slot);
    setActiveIframeSlot(slot.id);
    setShowIframe(true);
  };

  const closeIframe = () => {
    setShowIframe(false);
    setActiveIframeSlot(null);
    setSelectedSlot(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-header-xl text-header mb-2">Slot Management</h2>
          <p className="text-slate-400">Manage your ClaudeBox slots and access terminal interfaces.</p>
        </div>
        <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
          <Plus className="w-4 h-4 mr-2" />
          Create New Slot
        </Button>
      </div>

      {/* Iframe Modal */}
      {showIframe && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-custom-box border-custom-border rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-custom-border">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-yellow-500" />
                <h3 className="font-header-lg text-header">{selectedSlot.name}</h3>
                <Badge className={getAuthProviderColor(selectedSlot.authProvider)}>
                  {selectedSlot.authProvider}
                </Badge>
              </div>
              <Button variant="outline" onClick={closeIframe}>
                Close
              </Button>
            </div>
            <div className="flex-1 p-0">
              <IframeViewer slot={selectedSlot} userSession={userSession} />
            </div>
          </div>
        </div>
      )}

      {/* Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slots.map((slot) => (
          <Card key={slot.id} className="bg-custom-box border-custom-border hover:border-yellow-500 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(slot.status)}`} />
                  <CardTitle className="font-header-lg text-header">{slot.name}</CardTitle>
                </div>
                <Badge variant="outline" className={getAuthProviderColor(slot.authProvider)}>
                  {slot.authProvider}
                </Badge>
              </div>
              <CardDescription className="text-slate-400">
                {getStatusText(slot.status)} • Created {new Date(slot.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Resource Usage */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-slate-300">CPU: {slot.cpuUsage}%</span>
                  <Progress value={slot.cpuUsage} className="flex-1 h-2" />
                </div>
                
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-slate-300">Memory: {slot.memoryUsage}MB</span>
                  <Progress value={(slot.memoryUsage / 1024) * 100} className="flex-1 h-2" />
                </div>
              </div>

              {/* Last Activity */}
              <div className="text-sm text-slate-400">
                <span className="font-medium">Last activity:</span>{' '}
                {new Date(slot.lastActivity).toLocaleString()}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={() => openSlotInIframe(slot)}
                  disabled={slot.status !== 'active'}
                >
                  <Monitor className="w-4 h-4 mr-1" />
                  Open
                </Button>
                
                {slot.status === 'active' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSlotAction(slot.id, 'stop')}
                  >
                    <Pause className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSlotAction(slot.id, 'start')}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSlotAction(slot.id, 'settings')}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleSlotAction(slot.id, 'delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {slots.length === 0 && (
        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-12 text-center">
            <Terminal className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="font-header-lg text-header mb-2">No Slots Found</h3>
            <p className="text-slate-400 mb-6">
              Create your first ClaudeBox slot to get started with terminal access.
            </p>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Slot
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}