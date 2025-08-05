'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { 
  Play, 
  Pause, 
  Download, 
  Bell, 
  RefreshCw, 
  Eye, 
  ExternalLink,
  Home,
  Mail,
  Calendar,
  Bookmark,
  MessageSquare,
  Settings,
  Search,
  ArrowUp,
  Expand
} from 'lucide-react';

interface RFP {
  id: string;
  title: string;
  url: string;
  organization: string;
  relevance_score: number;
  status: string;
  created_at: string;
  summary?: string;
}

interface SystemStatus {
  status: string;
  scheduler: {
    status: string;
    next_run: string;
    interval_hours: number;
  };
  database: string;
  teams: string;
}

const API_BASE = 'http://212.86.105.190:8002';

export default function RFPDashboard() {
  const [rfps, setRfps] = useState<RFP[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [currentTimeRange, setCurrentTimeRange] = useState('1Y');
  const [activeNav, setActiveNav] = useState('home');
  const [logs, setLogs] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      // Load health status
      const healthResponse = await fetch(`${API_BASE}/health`);
      const healthData = await healthResponse.json();
      setSystemStatus(healthData);

      // Load RFPs
      const rfpsResponse = await fetch(`${API_BASE}/rfps?limit=50`);
      const rfpsData = await rfpsResponse.json();
      setRfps(rfpsData);

      // Load scheduler status
      const schedulerResponse = await fetch(`${API_BASE}/scheduler/status`);
      const schedulerData = await schedulerResponse.json();
      setSchedulerStatus(schedulerData);

      setLastUpdate(new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
    } catch (error) {
      addLog(`Error loading dashboard data: ${error}`, 'error');
    }
  };

  // Add log entry
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-49), logEntry]); // Keep last 50 logs
  };

  // Control functions
  const toggleScheduler = async () => {
    try {
      const isRunning = schedulerStatus?.status === 'running';
      const response = await fetch(`${API_BASE}/scheduler/${isRunning ? 'stop' : 'start'}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        addLog(`Scheduler ${isRunning ? 'stopped' : 'started'} successfully`, 'success');
        loadDashboardData();
      } else {
        addLog('Failed to toggle scheduler', 'error');
      }
    } catch (error) {
      addLog(`Error toggling scheduler: ${error}`, 'error');
    }
  };

  const manualIngest = async () => {
    try {
      addLog('Starting manual ingestion...', 'info');
      
      const response = await fetch(`${API_BASE}/ingest/manual`, {
        method: 'POST'
      });
      
      if (response.ok) {
        addLog('Manual ingestion triggered successfully', 'success');
        setTimeout(loadDashboardData, 2000);
      } else {
        addLog('Failed to trigger manual ingestion', 'error');
      }
    } catch (error) {
      addLog(`Error triggering manual ingestion: ${error}`, 'error');
    }
  };

  const testTeams = async () => {
    try {
      addLog('Testing Teams notification...', 'info');
      
      const response = await fetch(`${API_BASE}/test/teams`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        addLog('Teams notification test successful', 'success');
      } else {
        addLog('Teams notification test failed', 'error');
      }
    } catch (error) {
      addLog(`Error testing Teams notification: ${error}`, 'error');
    }
  };

  // Utility functions
  const getRelevanceClass = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    if (score >= 0.4) return 'text-blue-400';
    return 'text-red-400';
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-green-400';
      case 'processing': return 'text-yellow-400';
      case 'pending': return 'text-blue-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getLast7Days = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Chart data processing
  const getProcessingData = () => {
    const last7Days = getLast7Days();
    return last7Days.map(date => {
      const dayRFPs = rfps.filter(rfp => 
        rfp.created_at && rfp.created_at.startsWith(date)
      );
      return {
        date: formatDate(date),
        value: dayRFPs.length
      };
    });
  };

  const getRelevanceData = () => {
    const high = rfps.filter(r => r.relevance_score >= 0.8).length;
    const medium = rfps.filter(r => r.relevance_score >= 0.6 && r.relevance_score < 0.8).length;
    const low = rfps.filter(r => r.relevance_score >= 0.4 && r.relevance_score < 0.6).length;
    const notRelevant = rfps.filter(r => r.relevance_score < 0.4).length;

    return [
      { name: 'High (0.8+)', value: high },
      { name: 'Medium (0.6-0.8)', value: medium },
      { name: 'Low (0.4-0.6)', value: low },
      { name: 'Not Relevant (<0.4)', value: notRelevant }
    ];
  };

  // Initialize dashboard
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white">
      {/* Top Bar */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">Hello, Admin</h1>
          <span className="text-sm text-gray-400">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">
            {systemStatus ? `System is ${systemStatus.status}` : 'Loading...'}
          </span>
          <div className="w-4 h-4 text-gray-400">🌙</div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Left Column - Main Dashboard */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Market Overview */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">
              {systemStatus?.status === 'healthy' ? 'The system is active' : 'The system is down'}
            </h2>
            <p className="text-gray-400">RFP Workflow Dashboard</p>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 hover:transform hover:-translate-y-1 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-blue-900 text-blue-400">
                  <div className="w-5 h-5">🤖</div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-400">System Status</p>
                  <p className={`text-xl font-bold ${systemStatus?.status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
                    {systemStatus?.status === 'healthy' ? 'Running' : 'Stopped'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 hover:transform hover:-translate-y-1 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-green-900 text-green-400">
                  <div className="w-5 h-5">📄</div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-400">Total RFPs</p>
                  <p className="text-xl font-bold">{rfps.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 hover:transform hover:-translate-y-1 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-yellow-900 text-yellow-400">
                  <div className="w-5 h-5">⏰</div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-400">Next Ingestion</p>
                  <p className="text-xl font-bold">
                    {schedulerStatus?.next_run ? formatDateTime(schedulerStatus.next_run) : '--:--'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 hover:transform hover:-translate-y-1 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-purple-900 text-purple-400">
                  <div className="w-5 h-5">🔔</div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-400">Notifications</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">RFP Processing Timeline</h3>
                <div className="flex space-x-2">
                  {['1M', '3M', 'YTD', '1Y'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setCurrentTimeRange(range)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        currentTimeRange === range
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getProcessingData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: '#374151' }}
                    />
                    <YAxis 
                      stroke="#9CA3AF" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: '#374151' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Relevance Score Distribution</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getRelevanceData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {getRelevanceData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">System Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={toggleScheduler}
                className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                  schedulerStatus?.status === 'running'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {schedulerStatus?.status === 'running' ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {schedulerStatus?.status === 'running' ? 'Stop Scheduler' : 'Start Scheduler'}
              </button>
              <button
                onClick={manualIngest}
                className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Manual Ingestion
              </button>
              <button
                onClick={testTeams}
                className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4 mr-2" />
                Test Teams
              </button>
            </div>
          </div>

          {/* Recent RFPs Table */}
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent RFPs</h3>
              <button
                onClick={loadDashboardData}
                className="text-blue-400 hover:text-blue-300 flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Relevance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {rfps.map((rfp) => (
                    <tr key={rfp.id} className="hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{rfp.title || 'Untitled'}</div>
                        <div className="text-sm text-gray-400">{rfp.url || 'No URL'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {rfp.organization || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getRelevanceClass(rfp.relevance_score)}`}>
                          {(rfp.relevance_score * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getStatusClass(rfp.status)}`}>
                          {rfp.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDateTime(rfp.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-400 hover:text-blue-300 mr-2">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => window.open(rfp.url, '_blank')}
                          className="text-green-400 hover:text-green-300"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - News and Recap */}
        <div className="w-80 p-6 border-l border-gray-700 overflow-y-auto">
          {/* Daily Recap */}
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 mb-6">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold">Daily recap</h3>
              <ArrowUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-sm text-gray-300 mb-3">
              RFP workflow system is running smoothly with automated ingestion every 2 hours. 
              Recent processing shows consistent performance with GPT-4 Turbo integration. 
              Teams notifications are configured and ready for high-relevance RFPs.
            </p>
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>Summarized at 6:00 AM</span>
              <Expand className="w-4 h-4" />
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-4">System Logs</h3>
            <div className="bg-gray-900 text-green-400 p-3 rounded h-64 overflow-y-auto font-mono text-xs">
              {logs.map((log, index) => (
                <div key={index} className="text-gray-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-semibold">RFP Workflow</span>
            <span className="text-xs text-gray-400">curated by AI</span>
          </div>
          <div className="flex space-x-6">
            {[
              { id: 'home', icon: Home },
              { id: 'email', icon: Mail },
              { id: 'calendar', icon: Calendar },
              { id: 'bookmark', icon: Bookmark },
              { id: 'messages', icon: MessageSquare },
              { id: 'settings', icon: Settings },
              { id: 'search', icon: Search }
            ].map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveNav(id)}
                className={`p-2 rounded-full transition-all ${
                  activeNav === id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 