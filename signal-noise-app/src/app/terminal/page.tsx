'use client';

import { useState, useRef, useEffect } from 'react';
import { Terminal, Play, RotateCcw, Download, Upload, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/database';

interface Command {
  id: string;
  command: string;
  output: string;
  timestamp: Date;
  status: 'success' | 'error' | 'running';
}

interface EnrichmentJob {
  id: string;
  entityType: string;
  entityId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
}

export default function TerminalPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [enrichmentJobs, setEnrichmentJobs] = useState<EnrichmentJob[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('club');
  const [entityId, setEntityId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mock initial commands
    const mockCommands: Command[] = [
      {
        id: '1',
        command: 'help',
        output: 'Available commands: search, enrich, analyze, export, clear',
        timestamp: new Date(),
        status: 'success'
      },
      {
        id: '2',
        command: 'search "Manchester United"',
        output: 'Found 3 entities: Club, Players, Tenders',
        timestamp: new Date(),
        status: 'success'
      }
    ];

    setCommands(mockCommands);

    // Mock enrichment jobs
    const mockJobs: EnrichmentJob[] = [
      {
        id: '1',
        entityType: 'club',
        entityId: 'MUFC001',
        status: 'completed',
        progress: 100,
        createdAt: new Date(Date.now() - 3600000)
      },
      {
        id: '2',
        entityType: 'sportsperson',
        entityId: 'MR001',
        status: 'running',
        progress: 65,
        createdAt: new Date()
      }
    ];

    setEnrichmentJobs(mockJobs);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commands]);

  const executeCommand = async () => {
    if (!currentCommand.trim()) return;

    const newCommand: Command = {
      id: Date.now().toString(),
      command: currentCommand,
      output: '',
      timestamp: new Date(),
      status: 'running'
    };

    setCommands(prev => [...prev, newCommand]);
    setIsRunning(true);

    try {
      let output = '';
      let status: 'success' | 'error' | 'running' = 'success';

      if (currentCommand.toLowerCase().includes('search')) {
        const query = currentCommand.toLowerCase().replace('search', '').trim().replace(/"/g, '');
        if (query) {
          const results = await db.searchEntities(query, 10);
          output = `Search completed. Found ${results.length} relevant entities.`;
        } else {
          output = 'Search completed. Found 5 relevant entities.';
        }
      } else if (currentCommand.toLowerCase().includes('enrich')) {
        output = 'Enrichment process started. Job ID: ENR001';
      } else if (currentCommand.toLowerCase().includes('analyze')) {
        output = 'Analysis completed. Generated insights report.';
      } else if (currentCommand.toLowerCase().includes('help')) {
        output = 'Available commands: search, enrich, analyze, export, clear, vector-search, health, entities';
      } else if (currentCommand.toLowerCase().includes('health')) {
        const health = await db.healthCheck();
        output = `Database health: ${health.status} (${health.connection})`;
      } else if (currentCommand.toLowerCase().includes('entities')) {
        const entities = await db.getEntities();
        output = `Total entities in database: ${entities.length}`;
      } else {
        output = `Command '${currentCommand}' not recognized. Type 'help' for available commands.`;
        status = 'error';
      }

      setCommands(prev => 
        prev.map(cmd => 
          cmd.id === newCommand.id 
            ? { ...cmd, output, status }
            : cmd
        )
      );
    } catch (error) {
      console.error('Command execution error:', error);
      setCommands(prev => 
        prev.map(cmd => 
          cmd.id === newCommand.id 
            ? { ...cmd, output: `Error: ${error}`, status: 'error' }
            : cmd
        )
      );
    } finally {
      setIsRunning(false);
      setCurrentCommand('');
    }
  };

  const triggerEnrichment = () => {
    if (!entityId.trim()) return;

    const newJob: EnrichmentJob = {
      id: Date.now().toString(),
      entityType: selectedEntityType,
      entityId: entityId,
      status: 'pending',
      progress: 0,
      createdAt: new Date()
    };

    setEnrichmentJobs(prev => [...prev, newJob]);

    // Simulate enrichment process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        setEnrichmentJobs(prev => 
          prev.map(job => 
            job.id === newJob.id 
              ? { ...job, status: 'completed', progress: 100 }
              : job
          )
        );
      } else {
        setEnrichmentJobs(prev => 
          prev.map(job => 
            job.id === newJob.id 
              ? { ...job, status: 'running', progress }
              : job
          )
        );
      }
    }, 500);
  };

  const clearTerminal = () => {
    setCommands([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'running': return 'text-yellow-400';
      default: return 'text-fm-medium-grey';
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Terminal</h1>
          <p className="text-fm-light-grey">Advanced querying and enrichment controls</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={clearTerminal}
            className="border-custom-border text-white hover:bg-custom-border"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Terminal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Terminal */}
        <div className="bg-custom-box border border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Command Terminal</h2>
          </div>

          {/* Terminal Output */}
          <div 
            ref={terminalRef}
            className="h-80 bg-custom-bg border border-custom-border rounded p-3 font-mono text-sm overflow-y-auto"
          >
            {commands.map((cmd) => (
              <div key={cmd.id} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-fm-green">$</span>
                  <span className="text-white">{cmd.command}</span>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getStatusColor(cmd.status)}`}
                  >
                    {cmd.status}
                  </Badge>
                </div>
                {cmd.output && (
                  <div className="text-fm-light-grey ml-4">{cmd.output}</div>
                )}
                <div className="text-xs text-fm-medium-grey ml-4">
                  {cmd.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            {isRunning && (
              <div className="flex items-center gap-2 text-yellow-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400"></div>
                Processing...
              </div>
            )}
          </div>

          {/* Command Input */}
          <div className="flex gap-2 mt-3">
            <Input
              placeholder="Enter command (type 'help' for options)..."
              value={currentCommand}
              onChange={(e) => setCurrentCommand(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
              className="bg-custom-bg border-custom-border text-white placeholder:text-fm-medium-grey"
            />
            <Button 
              onClick={executeCommand}
              disabled={isRunning || !currentCommand.trim()}
              className="bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Commands */}
          <div className="mt-3 flex flex-wrap gap-2">
            {['help', 'search "query"', 'enrich entity_id', 'analyze', 'export'].map((cmd) => (
              <Button
                key={cmd}
                variant="outline"
                size="sm"
                onClick={() => setCurrentCommand(cmd)}
                className="text-xs border-custom-border text-fm-light-grey hover:bg-custom-border hover:text-white"
              >
                {cmd}
              </Button>
            ))}
          </div>
        </div>

        {/* Enrichment Jobs */}
        <div className="bg-custom-box border border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Enrichment Jobs</h2>
          </div>

          {/* New Enrichment Job */}
          <div className="bg-custom-bg border border-custom-border rounded p-3 mb-4">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                <SelectTrigger className="bg-custom-box border-custom-border text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-custom-box border-custom-border text-white">
                  <SelectItem value="club">Club</SelectItem>
                  <SelectItem value="sportsperson">Sportsperson</SelectItem>
                  <SelectItem value="poi">POI</SelectItem>
                  <SelectItem value="tender">Tender</SelectItem>
                </SelectContent>
              </Select>
              
              <Input
                placeholder="Entity ID"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="bg-custom-box border-custom-border text-white placeholder:text-fm-medium-grey text-xs"
              />
              
              <Button 
                onClick={triggerEnrichment}
                disabled={!entityId.trim()}
                size="sm"
                className="bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50"
              >
                <Zap className="w-3 h-3 mr-1" />
                Enrich
              </Button>
            </div>
          </div>

          {/* Active Jobs */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {enrichmentJobs.map((job) => (
              <div key={job.id} className="bg-custom-bg border border-custom-border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getJobStatusColor(job.status)}`}
                    >
                      {job.status}
                    </Badge>
                    <span className="text-white text-sm">{job.entityType}</span>
                    <span className="text-fm-medium-grey text-sm">{job.entityId}</span>
                  </div>
                  <span className="text-xs text-fm-medium-grey">
                    {job.createdAt.toLocaleTimeString()}
                  </span>
                </div>
                
                {job.status === 'running' && (
                  <div className="w-full bg-custom-border rounded-full h-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                )}
                
                <div className="text-xs text-fm-light-grey mt-1">
                  Progress: {Math.round(job.progress)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vector Search Section */}
      <div className="bg-custom-box border border-custom-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Vector Search</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-custom-bg border border-custom-border rounded p-3">
            <h3 className="text-sm font-medium text-white mb-2">Semantic Search</h3>
            <p className="text-xs text-fm-medium-grey mb-2">
              Search across all entities using natural language
            </p>
            <Button size="sm" variant="outline" className="w-full">
              <Search className="w-3 h-3 mr-1" />
              Open Search
            </Button>
          </div>
          
          <div className="bg-custom-bg border border-custom-border rounded p-3">
            <h3 className="text-sm font-medium text-white mb-2">Similarity Analysis</h3>
            <p className="text-xs text-fm-medium-grey mb-2">
              Find similar entities based on vector embeddings
            </p>
            <Button size="sm" variant="outline" className="w-full">
              <Zap className="w-3 h-3 mr-1" />
              Analyze
            </Button>
          </div>
          
          <div className="bg-custom-bg border border-custom-border rounded p-3">
            <h3 className="text-sm font-medium text-white mb-2">Cluster Detection</h3>
            <p className="text-xs text-fm-medium-grey mb-2">
              Identify entity clusters and patterns
            </p>
            <Button size="sm" variant="outline" className="w-full">
              <Terminal className="w-3 h-3 mr-1" />
              Detect
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
