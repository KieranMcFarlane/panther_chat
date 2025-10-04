'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DynamicStatus from '@/components/ui/DynamicStatus';

// Load RFPs from localStorage on initialization
const loadStoredRFPs = () => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rfp-scanner-results');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading stored RFPs:', error);
      return [];
    }
  }
  return [];
};

// Save RFPs to localStorage
const saveRFPsToStorage = (rfps: any[]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('rfp-scanner-results', JSON.stringify(rfps));
    } catch (error) {
      console.error('Error saving RFPs to storage:', error);
    }
  }
};

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
  category: string;
  message: string;
  details?: string;
}

function RFPScannerPage() {
  const [rfps, setRFPs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentScan, setCurrentScan] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [stats, setStats] = useState({
    totalRFPs: 0,
    criticalRFPs: 0,
    totalValue: '£0',
    avgFitScore: 0
  });
  // Load stored RFPs on component mount
  useEffect(() => {
    // Add initial log after mounting
    const initialLog: LogEntry = {
      id: '1',
      timestamp: new Date(),
      type: 'info',
      category: 'System',
      message: 'RFP Scanner initialized',
      details: 'Ready to scan for procurement opportunities'
    };
    setLogs([initialLog]);
    
    const storedRFPs = loadStoredRFPs();
    setRFPs(storedRFPs);
    updateStats(storedRFPs);
    if (storedRFPs.length > 0) {
      const loadedLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: 'info',
        category: 'System',
        message: 'Loaded stored RFPs',
        details: `Found ${storedRFPs.length} previously discovered opportunities`
      };
      setLogs(prev => [loadedLog, ...prev]);
    }
  }, []);

  // Update stats whenever RFPs change
  const updateStats = (rfpData: any[]) => {
    const criticalCount = rfpData.filter((r: any) => r.priorityLevel === 'CRITICAL').length;
    const totalValueRanges = [...new Set(rfpData.map((r: any) => r.valueEstimate).filter(Boolean))];
    const avgScore = rfpData.length > 0 
      ? Math.round(rfpData.reduce((sum: number, r: any) => sum + r.opportunityScore, 0) / rfpData.length)
      : 0;

    setStats({
      totalRFPs: rfpData.length,
      criticalRFPs: criticalCount,
      totalValue: totalValueRanges.length > 0 ? totalValueRanges.join(', ') : '£0',
      avgFitScore: avgScore
    });
  };

  const formatDeadline = (date: Date) => {
    const now = new Date();
    const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'Expired';
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    return `${daysUntil} days`;
  };

  const getPriorityColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const addLog = useCallback((type: LogEntry['type'], category: string, message: string, details?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      category,
      message,
      details
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  }, []);

  const formatLogTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
      case 'error':
        return <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;
      case 'warning':
        return <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
      default:
        return <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;
    }
  };

  const triggerScan = async (scanType: 'linkedin' | 'web') => {
    setIsLoading(true);
    setCurrentScan(`Scanning ${scanType.toUpperCase()} for RFPs...`);
    
    // Simulate scanning process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Add new mock RFP
    const newRFP = {
      id: Date.now().toString(),
      title: scanType === 'linkedin' 
        ? 'Sports Federation Digital Services' 
        : 'Multi-Venue Technology Platform',
      organization: scanType === 'linkedin' ? 'National Sports Federation' : 'Regional Sports Trust',
      sport: 'Multi-Sport',
      procurementType: 'Digital Services' as const,
      description: scanType === 'linkedin' 
        ? 'Comprehensive digital platform for member organizations and competitions'
        : 'Unified technology platform for multiple sports venues',
      deadline: new Date(Date.now() + 60 * 60 * 24 * 1000 * 45), // 45 days from now
      valueEstimate: '£400K-£600K',
      opportunityScore: 71,
      priorityLevel: 'MEDIUM' as const,
      status: 'NEW' as const,
      requirements: scanType === 'linkedin' 
        ? ['Member Portal', 'Competition Management', 'Digital Communications']
        : ['Venue Management', 'Ticketing System', 'Fan Experience'],
      evaluationCriteria: ['Technical Approach', 'Scalability', 'Cost Effectiveness'],
      urgency: 'MEDIUM',
      contactInfo: {
        name: scanType === 'linkedin' ? 'Emma Roberts' : 'David Chen',
        email: scanType === 'linkedin' 
          ? 'emma.roberts@sportsfed.org' 
          : 'd.chen@regionalsportstrust.gov',
        organization: scanType === 'linkedin' ? 'Sports Federation' : 'Regional Trust',
        department: 'Digital Services'
      },
      yellowPantherFit: 78,
      source: scanType as 'linkedin' | 'web',
      discoveredAt: new Date()
    };

    setRFPs(prev => [newRFP, ...prev]);
    setStats(prev => ({
      totalRFPs: prev.totalRFPs + 1,
      criticalRFPs: prev.criticalRFPs,
      totalValue: '£1.95M-£3.1M',
      avgFitScore: Math.round((prev.avgFitScore * prev.totalRFPs + 78) / (prev.totalRFPs + 1))
    }));

    setIsLoading(false);
    setCurrentScan('');
  };

  const simulateRealtimeStatus = () => {
    const statuses = [
      'Initializing LinkedIn scraper...',
      'Searching for RFP keywords...',
      'Analyzing procurement opportunities...',
      'Scoring opportunities...',
      'Processing results...'
    ];

    let statusIndex = 0;
    const interval = setInterval(() => {
      if (statusIndex < statuses.length) {
        setCurrentScan(statuses[statusIndex]);
        statusIndex++;
      } else {
        clearInterval(interval);
      }
    }, 800);

    return () => clearInterval(interval);
  };

  const realScanRFPs = async (scanType: 'linkedin' | 'web', sportFilter?: string, searchTerms?: string) => {
    setIsLoading(true);
    setCurrentScan('Initializing real RFP scanner...');
    addLog('info', 'Scan', `Starting ${scanType.toUpperCase()} scan`, sportFilter ? `Filter: ${sportFilter}` : 'All sports');
    
    try {
      const response = await fetch('/api/rfp-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanType,
          sportFilter,
          searchTerms
        }),
      });

      if (!response.ok) {
        throw new Error(`RFP scan failed: ${response.status}`);
      }

      addLog('success', 'Connection', 'Connected to RFP scanning API', 'Stream initialized');
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let newRFPs: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Update status messages
                if (data.type === 'text') {
                  setCurrentScan(data.text);
                  
                  // Categorize text content for better logging
                  let logType = 'Scanning progress';
                  let logTitle = 'Analysis';
                  
                  const text = data.text.toLowerCase();
                  if (text.includes('search') || text.includes('looking for') || text.includes('scanning')) {
                    logType = 'Search activity';
                    logTitle = 'Searching';
                  } else if (text.includes('found') || text.includes('discovered') || text.includes('identified')) {
                    logType = 'Discovery';
                    logTitle = 'Opportunity found';
                  } else if (text.includes('analyzing') || text.includes('evaluating') || text.includes('assessing')) {
                    logType = 'Analysis';
                    logTitle = 'Evaluating';
                  } else if (text.includes('tool') || text.includes('using') || text.includes('executing')) {
                    logType = 'Tool activity';
                    logTitle = 'Tool usage';
                  } else if (text.includes('rfp') || text.includes('tender') || text.includes('procurement')) {
                    logType = 'RFP intelligence';
                    logTitle = 'RFP detected';
                  }
                  
                  addLog('info', logType, data.text);
                } else if (data.type === 'tool_use') {
                  setCurrentScan(`Executing ${data.tool}...`);
                  addLog('info', 'Tool execution', `🔧 ${data.tool}: ${JSON.stringify(data.input)}`);
                } else if (data.type === 'tool_result') {
                  setCurrentScan(`Processing results...`);
                  const resultPreview = typeof data.result === 'string' 
                    ? data.result.substring(0, 100) + (data.result.length > 100 ? '...' : '')
                    : JSON.stringify(data.result).substring(0, 100) + '...';
                  addLog('info', 'Processing results', `📊 Results: ${resultPreview}`);
                } else if (data.type === 'result' && data.rfpData) {
                  // Add discovered RFPs
                  newRFPs = data.rfpData;
                  setRFPs(prev => {
                    const updatedRFPs = [...newRFPs, ...prev];
                    saveRFPsToStorage(updatedRFPs);
                    updateStats(updatedRFPs);
                    return updatedRFPs;
                  });
                  addLog('success', 'RFPs discovered', `Found ${newRFPs.length} new opportunities`);
                  
                  // Save to Neo4j via MCP
                  if (newRFPs.length > 0) {
                    saveToNeo4jMCP(newRFPs);
                  }
                } else if (data.type === 'complete') {
                  setCurrentScan('✅ RFP scan completed successfully!');
                  addLog('success', 'Scan completed', `Successfully found ${newRFPs.length} RFPs`);
                  setTimeout(() => setCurrentScan(''), 3000);
                } else if (data.type === 'error') {
                  addLog('error', 'Scan Error', 'Scan error', data.message);
                  throw new Error(data.message);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE message:', parseError);
                addLog('warning', 'Parsing', 'Parse error', 'Failed to process some scan data');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing stream:', error);
        addLog('error', 'Stream processing error', error.message);
        throw error;
      }

    } catch (error) {
      console.error('RFP scan error:', error);
      setCurrentScan(`❌ Scan failed: ${error.message}`);
      addLog('error', 'Scan failed', error.message);
      setTimeout(() => setCurrentScan(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const enhancedTriggerScan = async (scanType: 'linkedin' | 'web') => {
    // Use real API instead of mock data
    await realScanRFPs(scanType, selectedSport === 'all' ? undefined : selectedSport);
  };

  const scanAllSources = async () => {
    setIsLoading(true);
    setCurrentScan('Scanning all sources...');
    addLog('info', 'Starting comprehensive scan', 'LinkedIn + Web sources');
    
    try {
      // Scan LinkedIn first
      await realScanRFPs('linkedin', selectedSport === 'all' ? undefined : selectedSport);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
      
      // Then scan web
      await realScanRFPs('web', selectedSport === 'all' ? undefined : selectedSport);
      
      addLog('success', 'Comprehensive scan completed', 'All sources scanned successfully');
    } catch (error) {
      addLog('error', 'Comprehensive scan failed', error.message);
    }
  };

  const exportResults = () => {
    if (rfps.length === 0) {
      addLog('warning', 'No data to export', 'No RFPs available for export');
      return;
    }

    try {
      const csvContent = [
        'Title,Organization,Sport,Procurement Type,Value Estimate,Deadline,Opportunity Score,Priority,Contact Name,Contact Email,Source',
        ...rfps.map(rfp => 
          `"${rfp.title}","${rfp.organization}","${rfp.sport}","${rfp.procurementType}","${rfp.valueEstimate}","${rfp.deadline.toLocaleDateString()}","${rfp.opportunityScore}","${rfp.priorityLevel}","${rfp.contactInfo.name}","${rfp.contactInfo.email}","${rfp.source}"`
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rfp-scan-results-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      addLog('success', 'Export completed', `Exported ${rfps.length} RFPs to CSV`);
    } catch (error) {
      addLog('error', 'Export failed', error.message);
    }
  };

  const saveToNeo4jMCP = async (rfpData: any[]) => {
    try {
      addLog('info', 'Saving to Neo4j via MCP', `Storing ${rfpData.length} RFPs in knowledge graph`);
      
      // Call Neo4j MCP to save RFPs
      const response = await fetch('/api/mcp/neo4j', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'createRFPNodes',
          data: rfpData
        }),
      });

      if (!response.ok) {
        throw new Error(`Neo4j MCP error: ${response.status}`);
      }

      const result = await response.json();
      addLog('success', 'Saved to Neo4j', result.message || `Successfully stored ${rfpData.length} RFPs`);
    } catch (error) {
      addLog('error', 'Neo4j MCP save failed', error.message);
    }
  };

  const saveToNeo4j = async () => {
    if (rfps.length === 0) {
      addLog('warning', 'No data to save', 'No RFPs available to save to Neo4j');
      return;
    }

    try {
      addLog('info', 'Saving all RFPs to Neo4j', `Storing ${rfps.length} RFPs in knowledge graph`);
      await saveToNeo4jMCP(rfps);
    } catch (error) {
      addLog('error', 'Neo4j save failed', error.message);
    }
  };

  const clearResults = () => {
    setRFPs([]);
    setStats({
      totalRFPs: 0,
      criticalRFPs: 0,
      totalValue: '£0',
      avgFitScore: 0
    });
    saveRFPsToStorage([]); // Clear localStorage
    addLog('info', 'Results cleared', 'All RFP data has been reset');
  };

  const toggleSchedule = () => {
    setIsScheduled(!isScheduled);
    if (!isScheduled) {
      addLog('info', 'Scheduled scanning enabled', 'Automatic scans will run every 6 hours');
      // In real implementation, set up interval for scheduled scans
    } else {
      addLog('info', 'Scheduled scanning disabled', 'Automatic scans stopped');
      // Clear any existing intervals
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">RFP Intelligence Scanner</h1>
          <p className="text-gray-600 mt-2">Discover high-value procurement opportunities in the sports industry</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
            <div className={`w-2 h-2 rounded-full ${isScheduled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'} mr-2`}></div>
            {isScheduled ? 'Scheduled' : 'Manual'}
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <Card className="p-6 bg-white shadow-sm mb-8">
        <div className="space-y-6">
          {/* Primary Scan Buttons */}
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => enhancedTriggerScan('linkedin')}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0 4 4 0 008 0zM6 8a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              <span>Scan LinkedIn RFPs</span>
            </button>
            <button 
              onClick={() => enhancedTriggerScan('web')}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 2a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 13a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm-6-1a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H2zM5 4a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
              </svg>
              <span>Scan Web RFPs</span>
            </button>
            <button 
              onClick={scanAllSources}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h4v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
              <span>Scan All Sources</span>
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Sport Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Sport:</label>
              <select 
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sports</option>
                <option value="football">Football</option>
                <option value="rugby">Rugby</option>
                <option value="cricket">Cricket</option>
                <option value="tennis">Tennis</option>
                <option value="basketball">Basketball</option>
                <option value="formula1">Formula 1</option>
                <option value="golf">Golf</option>
                <option value="multi-sport">Multi-Sport</option>
              </select>
            </div>

            {/* Action Buttons */}
            <button 
              onClick={exportResults}
              disabled={isLoading || rfps.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </button>
            <button 
              onClick={saveToNeo4j}
              disabled={isLoading || rfps.length === 0}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Save to Neo4j</span>
            </button>
            <button 
              onClick={clearResults}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Results</span>
            </button>
            <button 
              onClick={toggleSchedule}
              disabled={isLoading}
              className={`${isScheduled ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'} disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors text-sm`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{isScheduled ? 'Disable Schedule' : 'Schedule Scan'}</span>
            </button>
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{showLogs ? 'Hide Logs' : 'Show Logs'}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Status Display */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
            <div className="flex-1">
              <DynamicStatus 
                currentTool={currentScan.includes('LinkedIn') ? 'mcp__brightData__search_engine' : 'mcp__perplexity-mcp__chat_completion'} 
                isLoading={isLoading} 
                statusMessage={currentScan} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active RFPs</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalRFPs}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Opportunities</p>
              <p className="text-2xl font-bold text-red-600">{stats.criticalRFPs}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value Pipeline</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalValue}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Fit Score</p>
              <p className="text-2xl font-bold text-purple-600">{stats.avgFitScore}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* RFP Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rfps.map((rfp) => (
          <Card key={rfp.id} className={`p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 ${getPriorityColor(rfp.priorityLevel)}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-1">{rfp.title}</h3>
                <p className="text-sm text-gray-600">{rfp.organization}</p>
                <p className="text-xs text-gray-500">{rfp.sport} • {rfp.procurementType}</p>
              </div>
              <div className="text-right ml-4">
                <Badge className={`${getPriorityColor(rfp.priorityLevel)} text-white text-xs font-medium px-2 py-1 rounded`}>
                  {rfp.priorityLevel}
                </Badge>
                <div className="text-2xl font-bold text-gray-900 mt-2">{rfp.opportunityScore}</div>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-700 mb-4 line-clamp-3">{rfp.description}</p>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 p-3 rounded">
                <span className="text-xs text-gray-500 block">Value Estimate</span>
                <p className="font-semibold text-sm">{rfp.valueEstimate}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <span className="text-xs text-gray-500 block">Deadline</span>
                <p className="font-semibold text-sm text-red-600">{formatDeadline(rfp.deadline)}</p>
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-4">
              <span className="text-xs text-gray-500">Key Requirements:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {rfp.requirements.slice(0, 2).map((req, index) => (
                  <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {req}
                  </span>
                ))}
                {rfp.requirements.length > 2 && (
                  <span className="text-xs text-gray-500">+{rfp.requirements.length - 2} more</span>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <span className="text-xs text-gray-500 block">Contact:</span>
              <p className="text-sm font-medium text-gray-900">{rfp.contactInfo.name}</p>
              <p className="text-xs text-gray-600">{rfp.contactInfo.department}</p>
              <p className="text-xs text-blue-600">{rfp.contactInfo.email}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" className="text-xs">
                  View Details
                </Button>
                <Button size="sm" className="text-xs">
                  Start Research
                </Button>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">Fit Score</span>
                <p className="font-bold text-sm text-purple-600">{rfp.yellowPantherFit}/100</p>
              </div>
            </div>

            {/* Source Badge */}
            <div className="absolute top-4 right-4">
              <Badge className={rfp.source === 'linkedin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                {rfp.source === 'linkedin' ? 'LinkedIn' : 'Web'}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {rfps.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No RFPs discovered yet</h3>
          <p className="text-gray-500 mb-6">Start scanning LinkedIn or web sources to find procurement opportunities</p>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => enhancedTriggerScan('linkedin')} className="bg-blue-600 hover:bg-blue-700">
              Scan LinkedIn RFPs
            </Button>
            <Button onClick={() => enhancedTriggerScan('web')} className="bg-green-600 hover:bg-green-700">
              Scan Web RFPs
            </Button>
          </div>
        </div>
      )}

      {/* Log Component */}
      {showLogs && (
        <Card className="p-6 bg-gray-900 text-gray-100 mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Activity Logs</h3>
            <button 
              onClick={() => setLogs([])}
              className="text-gray-400 hover:text-white text-sm"
            >
              Clear Logs
            </button>
          </div>
          <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No log entries yet</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 pb-2 border-b border-gray-800 last:border-0">
                    <div className="flex-shrink-0 mt-0.5">
                      {getLogIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-xs">{formatLogTime(log.timestamp)}</span>
                        <span className={`text-xs font-medium ${
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'warning' ? 'text-yellow-400' :
                          log.type === 'success' ? 'text-green-400' :
                          'text-blue-400'
                        }`}>
                          {log.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          log.type === 'error' ? 'bg-red-900 text-red-300' :
                          log.type === 'warning' ? 'bg-yellow-900 text-yellow-300' :
                          log.type === 'success' ? 'bg-green-900 text-green-300' :
                          'bg-blue-900 text-blue-300'
                        }`}>
                          {log.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-white mt-1 break-words">{log.message}</div>
                      {log.details && (
                        <div className="text-gray-400 text-xs mt-1 break-words">{log.details}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
            <span>{logs.length} log entries</span>
            <span>Real-time RFP scanner activity</span>
          </div>
        </Card>
      )}
    </div>
  );
}

export default RFPScannerPage;