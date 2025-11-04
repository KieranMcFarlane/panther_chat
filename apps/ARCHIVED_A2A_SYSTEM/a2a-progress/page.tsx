import { RealtimeA2ADashboard } from '@/components/RealtimeA2ADashboard';

export default function A2AProgressPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">A2A Full Scan Progress</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of Agent-to-Agent Neo4j entity scanning and RFP opportunity detection
          </p>
        </div>
        
        <RealtimeA2ADashboard />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">How A2A Scanning Works</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                <div>
                  <strong>Entity Discovery:</strong> Scans Neo4j for high-priority sports entities (clubs, federations, venues)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                <div>
                  <strong>RFP Analysis:</strong> Uses BrightData MCP tools to search for procurement opportunities
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                <div>
                  <strong>AI Intelligence:</strong> Claude Agent SDK provides comprehensive analysis and scoring
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />
                <div>
                  <strong>Batch Processing:</strong> Economical 3-entity batches optimize memory and API usage
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Real-Time Features</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span><strong>Live Progress:</strong> Entity count updates every 2 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span><strong>Batch Tracking:</strong> Monitor batch completion status</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span><strong>RFP Discovery:</strong> Real-time opportunity counting</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span><strong>Time Tracking:</strong> Live elapsed time counter</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}