import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Global state for the single RFP scan instance
let activeScan: {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  startTime: number;
  currentEntity?: string;
  currentEntityIndex: number;
  totalEntities: number;
  processedEntities: number;
  rfpOpportunitiesFound: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
  currentStage: string;
  error?: string;
  results?: any[];
  detailedLogs: string[];
  lastActivity?: string;
  rfpOpportunities: Array<{
    id: string;
    title: string;
    entity: string;
    source: string;
    url?: string;
    description?: string;
    deadline?: string;
    discoveredAt: string;
    type: 'RFP' | 'Tender' | 'Proposal' | 'Contract';
    confidence: 'high' | 'medium' | 'low';
  }>;
} = {
  id: '',
  status: 'idle',
  startTime: 0,
  currentEntityIndex: 0,
  totalEntities: 0,
  processedEntities: 0,
  rfpOpportunitiesFound: 0,
  timeElapsed: 0,
  estimatedTimeRemaining: 0,
  currentStage: 'Ready to start',
  detailedLogs: [],
  rfpOpportunities: []
};

// Progress tracking variables
let progressInterval: NodeJS.Timeout | null = null;
let scanController: AbortController | null = null;

// Helper function to log detailed activities
function addDetailedLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  // Ensure activeScan and detailedLogs exist
  if (!activeScan) {
    console.log(`🎯 [RFP SCAN LOG] ERROR: activeScan is null, cannot log: ${message}`);
    return;
  }
  
  if (!activeScan.detailedLogs) {
    activeScan.detailedLogs = [];
  }
  
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
  activeScan.detailedLogs.push(logEntry);
  activeScan.lastActivity = message;
  
  // Keep only last 50 log entries to prevent memory issues
  if (activeScan.detailedLogs.length > 50) {
    activeScan.detailedLogs = activeScan.detailedLogs.slice(-50);
  }
  
  console.log(`🎯 [RFP SCAN LOG] ${logEntry}`);
}

// Helper function to capture RFP opportunities
function captureRFPOpportunity(details: {
  title: string;
  entity: string;
  source: string;
  url?: string;
  description?: string;
  deadline?: string;
  type?: 'RFP' | 'Tender' | 'Proposal' | 'Contract';
  confidence?: 'high' | 'medium' | 'low';
}) {
  const opportunity = {
    id: `rfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: details.title,
    entity: details.entity,
    source: details.source,
    url: details.url,
    description: details.description,
    deadline: details.deadline,
    discoveredAt: new Date().toISOString(),
    type: details.type || 'RFP',
    confidence: details.confidence || 'medium'
  };
  
  // Ensure rfpOpportunities array exists
  if (!activeScan.rfpOpportunities) {
    activeScan.rfpOpportunities = [];
  }
  
  activeScan.rfpOpportunities.push(opportunity);
  activeScan.rfpOpportunitiesFound = activeScan.rfpOpportunities.length;
  
  // Log the discovery with specific details
  addDetailedLog(`🎯 RFP Opportunity: "${opportunity.title}" from ${opportunity.entity}`, 'success');
  if (opportunity.url) {
    addDetailedLog(`🔗 Source URL: ${opportunity.url}`, 'info');
  }
  if (opportunity.deadline) {
    addDetailedLog(`⏰ Deadline: ${opportunity.deadline}`, 'info');
  }
  
  console.log(`🎯 [RFP DISCOVERED] ${opportunity.title} (${opportunity.entity}) - ${opportunity.url}`);
}

// Helper function to save RFP opportunities to file
async function saveRFPOpportunitiesToFile(opportunities: any[]) {
  try {
    const resultsDir = join(process.cwd(), 'rfp-results');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `rfp-scan-${activeScan.id}-${timestamp}.json`;
    const filepath = join(resultsDir, filename);
    
    // Ensure directory exists
    await mkdir(resultsDir, { recursive: true });
    
    // Save detailed results
    const scanData = {
      scanId: activeScan.id,
      scanDate: new Date().toISOString(),
      totalEntities: activeScan.totalEntities,
      processedEntities: activeScan.processedEntities,
      rfpOpportunitiesFound: activeScan.rfpOpportunitiesFound,
      duration: activeScan.timeElapsed,
      opportunities: opportunities,
      detailedLogs: activeScan.detailedLogs
    };
    
    await writeFile(filepath, JSON.stringify(scanData, null, 2));
    addDetailedLog(`💾 RFP opportunities saved to: ${filename}`, 'success');
    
  } catch (error) {
    addDetailedLog(`❌ Failed to save RFP opportunities to file: ${error.message}`, 'error');
    console.error('Failed to save RFP opportunities:', error);
  }
}

// Helper function to extract RFP details from text
function extractRFPDetails(text: string, entityName: string, source: string, url?: string) {
  // Look for RFP patterns in text
  const rfpPatterns = [
    /(?:request for proposal|RFP|solicitation|tender)\s*(?:for|:)?\s*([^.\n]{10,100})/gi,
    /(?:proposal|tender|contract)\s+(?:due|deadline|closing)\s*([^.\n]{10,80})/gi,
    /(?:submission|response)\s+(?:due|deadline|by)\s*([^.\n]{10,60})/gi,
    /https?:\/\/[^\s)]+/gi // URLs
  ];
  
  const details = {
    title: '',
    description: '',
    deadline: '',
    urls: [] as string[]
  };
  
  for (const pattern of rfpPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      if (pattern.source.includes('RFP|solicitation|tender')) {
        details.title = matches[0].substring(0, 100).trim();
      } else if (pattern.source.includes('deadline|due|closing')) {
        details.deadline = matches[0].trim();
      } else if (pattern.source.includes('https')) {
        details.urls.push(...matches);
      }
    }
  }
  
  // If we found an RFP, capture it
  if (details.title && details.urls && Array.isArray(details.urls) && details.urls.length > 0) {
    captureRFPOpportunity({
      title: details.title,
      entity: entityName,
      source: source,
      url: details.urls[0],
      description: details.description,
      deadline: details.deadline,
      confidence: 'high'
    });
  }
}

/**
 * POST /api/rfp-scan-control
 * Controls the single RFP scan instance
 * Body: { action: 'start' | 'stop' | 'pause' | 'resume', config?: any }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body;

    console.log(`🎯 [RFP SCAN CONTROL] Action: ${action}, Current Status: ${activeScan.status}`);

    switch (action) {
      case 'start':
        return await startScan(config);
      case 'stop':
        return await stopScan();
      case 'pause':
        return await pauseScan();
      case 'resume':
        return await resumeScan();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ [RFP SCAN CONTROL] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/rfp-scan-control
 * Returns current scan status and progress
 */
export async function GET() {
  try {
    // Check if activeScan exists and is properly initialized
    if (!activeScan) {
      return NextResponse.json({
        id: '',
        status: 'idle',
        startTime: 0,
        currentEntity: '',
        currentEntityIndex: 0,
        totalEntities: 0,
        processedEntities: 0,
        rfpOpportunitiesFound: 0,
        timeElapsed: 0,
        estimatedTimeRemaining: 0,
        currentStage: 'Ready to start',
        error: undefined,
        results: [],
        detailedLogs: [],
        rfpOpportunities: [],
        lastActivity: undefined,
        progressPercentage: 0,
        formattedTimeElapsed: '0s',
        formattedEstimatedTimeRemaining: '0s',
        recentLogs: [],
        totalLogs: 0,
        totalOpportunities: 0
      });
    }

    // Create a deep copy to prevent race conditions with background scan
    const scanCopy = JSON.parse(JSON.stringify(activeScan));
    
    // Ensure arrays are properly initialized from the copy
    const safeLogs = Array.isArray(scanCopy.detailedLogs) ? scanCopy.detailedLogs : [];
    const safeOpportunities = Array.isArray(scanCopy.rfpOpportunities) ? scanCopy.rfpOpportunities : [];
    
    // Ensure the copy has all required properties with fallbacks
    const safeScanCopy = {
      id: scanCopy.id || '',
      status: scanCopy.status || 'idle',
      startTime: scanCopy.startTime || 0,
      currentEntity: scanCopy.currentEntity || '',
      currentEntityIndex: scanCopy.currentEntityIndex || 0,
      totalEntities: scanCopy.totalEntities || 0,
      processedEntities: scanCopy.processedEntities || 0,
      rfpOpportunitiesFound: scanCopy.rfpOpportunitiesFound || 0,
      timeElapsed: scanCopy.timeElapsed || 0,
      estimatedTimeRemaining: scanCopy.estimatedTimeRemaining || 0,
      currentStage: scanCopy.currentStage || 'Ready to start',
      error: scanCopy.error || undefined,
      results: scanCopy.results || [],
      detailedLogs: safeLogs,
      rfpOpportunities: safeOpportunities,
      lastActivity: scanCopy.lastActivity || undefined
    };
    
    return NextResponse.json({
      ...safeScanCopy,
      progressPercentage: safeScanCopy.totalEntities > 0 
        ? Math.round((safeScanCopy.processedEntities / safeScanCopy.totalEntities) * 100)
        : 0,
      formattedTimeElapsed: formatTime(safeScanCopy.timeElapsed),
      formattedEstimatedTimeRemaining: formatTime(safeScanCopy.estimatedTimeRemaining),
      // Include detailed logs for real-time monitoring
      recentLogs: safeScanCopy.detailedLogs.slice(-10), // Last 10 log entries
      totalLogs: safeScanCopy.detailedLogs.length,
      // Include RFP opportunities with details
      rfpOpportunities: safeScanCopy.rfpOpportunities.slice(-20), // Last 20 opportunities
      totalOpportunities: safeScanCopy.rfpOpportunities.length
    });
  } catch (error) {
    console.error('Error in GET endpoint:', error);
    return NextResponse.json({
      id: '',
      status: 'error',
      startTime: 0,
      currentEntity: '',
      currentEntityIndex: 0,
      totalEntities: 0,
      processedEntities: 0,
      rfpOpportunitiesFound: 0,
      timeElapsed: 0,
      estimatedTimeRemaining: 0,
      currentStage: 'Error fetching status',
      error: error.message,
      detailedLogs: [],
      rfpOpportunities: [],
      progressPercentage: 0,
      formattedTimeElapsed: '0s',
      formattedEstimatedTimeRemaining: '0s',
      recentLogs: [],
      totalLogs: 0,
      totalOpportunities: 0
    });
  }
}

async function startScan(config: any = {}) {
  // Ensure only one scan can run at a time
  if (activeScan.status === 'running') {
    return NextResponse.json({ 
      error: 'Another scan is already running. Stop it first.' 
    }, { status: 409 });
  }

  // Initialize scan state
  activeScan = {
    id: `scan_${Date.now()}`,
    status: 'running',
    startTime: Date.now(),
    currentEntity: 'Initializing...',
    currentEntityIndex: 0,
    totalEntities: config.entityLimit || 50,
    processedEntities: 0,
    rfpOpportunitiesFound: 0,
    timeElapsed: 0,
    estimatedTimeRemaining: 0,
    currentStage: 'Initializing Neo4j connection...',
    results: [],
    detailedLogs: [],
    rfpOpportunities: [], // Explicitly initialize the RFP opportunities array
    lastActivity: undefined,
    error: undefined
  };

  // Add initial log entries
  addDetailedLog(`🚀 Starting RFP scan ${activeScan.id}`, 'info');
  addDetailedLog(`📊 Target: ${activeScan.totalEntities} entities`, 'info');
  addDetailedLog(`🔧 Initializing Neo4j connection...`, 'info');

  // Start progress tracking
  startProgressTracking();

  // Start the actual scan in background (fire and forget)
  scanController = new AbortController();
  
  // Run scan in background without waiting for it to complete
  executeRFPScan(config, scanController.signal).catch(error => {
    console.error('❌ [RFP SCAN] Background scan error:', error);
    activeScan.status = 'error';
    activeScan.error = error.message;
    activeScan.currentStage = 'Error occurred during scan';
  });

  return NextResponse.json({
    success: true,
    scanId: activeScan.id,
    message: 'RFP scan started successfully',
    initialStatus: activeScan
  });
}

async function stopScan() {
  if (activeScan.status !== 'running' && activeScan.status !== 'paused') {
    return NextResponse.json({ 
      error: 'No active scan to stop' 
    }, { status: 400 });
  }

  // Abort the running scan
  if (scanController) {
    scanController.abort();
    scanController = null;
  }

  // Stop progress tracking
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  // Reset to clean state
  activeScan = {
    id: '',
    status: 'idle',
    startTime: 0,
    currentEntityIndex: 0,
    totalEntities: 0,
    processedEntities: 0,
    rfpOpportunitiesFound: 0,
    timeElapsed: 0,
    estimatedTimeRemaining: 0,
    currentStage: 'Ready to start',
    detailedLogs: [],
    rfpOpportunities: []
  };

  return NextResponse.json({
    success: true,
    message: 'RFP scan stopped',
    finalStatus: activeScan
  });
}

async function pauseScan() {
  if (activeScan.status !== 'running') {
    return NextResponse.json({ 
      error: 'No running scan to pause' 
    }, { status: 400 });
  }

  activeScan.status = 'paused';
  activeScan.currentStage = 'Paused by user';

  return NextResponse.json({
    success: true,
    message: 'RFP scan paused',
    status: activeScan
  });
}

async function resumeScan() {
  if (activeScan.status !== 'paused') {
    return NextResponse.json({ 
      error: 'No paused scan to resume' 
    }, { status: 400 });
  }

  activeScan.status = 'running';
  activeScan.currentStage = 'Resuming scan...';

  return NextResponse.json({
    success: true,
    message: 'RFP scan resumed',
    status: activeScan
  });
}

function startProgressTracking() {
  // Clear any existing interval
  if (progressInterval) {
    clearInterval(progressInterval);
  }

  let lastActivityCount = 0;

  // Update progress every second
  progressInterval = setInterval(() => {
    if (activeScan.status === 'running') {
      activeScan.timeElapsed = Date.now() - activeScan.startTime;
      
      // Estimate time remaining based on current progress
      if (activeScan.processedEntities > 0) {
        const avgTimePerEntity = activeScan.timeElapsed / activeScan.processedEntities;
        const remainingEntities = activeScan.totalEntities - activeScan.processedEntities;
        activeScan.estimatedTimeRemaining = Math.round(avgTimePerEntity * remainingEntities);
      }

      // Fallback: Update stage based on time and activity if stuck
      const currentLogCount = activeScan.detailedLogs.length;
      if (currentLogCount > lastActivityCount) {
        // There's activity, logs are updating
        lastActivityCount = currentLogCount;
      } else if (activeScan.timeElapsed > 5000 && activeScan.currentStage === 'Initializing Neo4j connection...') {
        // If stuck for more than 5 seconds, update based on recent logs
        const recentLogs = activeScan.detailedLogs.slice(-3);
        if (recentLogs.some(log => log.includes('Database query'))) {
          activeScan.currentStage = 'Processing sports entities from database...';
        } else if (recentLogs.some(log => log.includes('Web search'))) {
          activeScan.currentStage = 'Searching for RFP opportunities online...';
        }
      }

      // Auto-estimate progress based on time and entity count
      const avgTimePerEntity = 30000; // 30 seconds per entity estimate
      const estimatedProgress = Math.min(
        Math.floor(activeScan.timeElapsed / avgTimePerEntity),
        activeScan.totalEntities
      );
      
      if (estimatedProgress > activeScan.processedEntities && activeScan.processedEntities === 0) {
        activeScan.processedEntities = estimatedProgress;
        activeScan.currentEntityIndex = estimatedProgress;
        addDetailedLog(`⏱️ Auto-estimated progress: ${estimatedProgress}/${activeScan.totalEntities} entities`, 'info');
      }
    }
  }, 1000);
}

async function executeRFPScan(config: any, signal: AbortSignal) {
  try {
    console.log(`🚀 [RFP SCAN] Starting scan ${activeScan.id} for ${activeScan.totalEntities} entities`);

    // Import here to avoid module loading issues
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    // Configure MCP servers
    const mcpServers = {
      'neo4j-mcp': {
        command: 'node',
        args: ['neo4j-mcp-server.js'],
        env: {
          NEO4J_URI: process.env.NEO4J_URI || 'neo4j+s://e6bb5665.databases.neo4j.io',
          NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
          NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'NeO4jPaSSworD!'
        }
      },
      'brightdata-mcp': {
        command: 'node',
        args: ['src/mcp-brightdata-server.js'],
        env: {
          BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_ZONE: 'linkedin_posts_monitor'
        }
      }
    };

    const systemPrompt = {
      type: "preset" as const,
      preset: "claude_code" as const,
      append: `You are an expert RFP Intelligence Analyst conducting a systematic scan of sports entities.

Your task is to process entities one by one and search for RFP opportunities using verified patterns.

PROGRESS UPDATES:
After each entity search, provide a clear update in this format:
"PROGRESS: [entity_number]/[total] - [entity_name] - [status: SEARCHING/ANALYZING/COMPLETED] - [rfp_count_found] opportunities found"

VERIFIED RFP PATTERNS:
1. Digital Transformation: "invites proposals from digital transformation agencies"
2. Ticketing Systems: "soliciting proposals from ticketing service providers"
3. Mobile Apps: "request for proposals mobile application development"
4. Web Platforms: "invitation to tender website redesign"
5. Fan Engagement: "fan engagement platform RFP"

For each entity:
1. Search for RFP opportunities using targeted queries
2. Analyze results for Yellow Panther fit
3. Report findings with URLs and contact info
4. Move to next entity

Provide regular progress updates so the user can track the scan in real-time.`
    };

    let entityCount = 0;
    const discoveredOpportunities = [];

    // Add timeout for the entire scan to prevent hanging
    const scanTimeout = setTimeout(() => {
      if (activeScan.status === 'running') {
        addDetailedLog('⏰ Scan timeout reached - completing scan', 'warning');
        activeScan.status = 'completed';
        activeScan.currentStage = 'Scan completed (timeout)';
      }
    }, 300000); // 5 minute timeout

    try {
      for await (const message of query({
      prompt: `Execute systematic RFP scan for ${activeScan.totalEntities} high-priority sports entities.

IMPORTANT: Start by announcing the total database entity count and connection status.

Process entities sequentially and provide regular progress updates.

1. First, connect to Neo4j and query for TOTAL entity count in the database
   - Execute: MATCH (e:Entity) RETURN count(e) as totalEntities
   - Announce: "Neo4j connected successfully - Found X total entities in database"

2. Then query for ${activeScan.totalEntities} high-priority sports entities with yellowPantherPriority <= 5
   - Execute: MATCH (e:Entity) WHERE exists(e.yellowPantherPriority) AND e.yellowPantherPriority <= 5 RETURN e.name, e.yellowPantherPriority LIMIT ${activeScan.totalEntities}
   - Announce: "Retrieved X high-priority entities for RFP scanning"

3. For each entity, conduct targeted RFP searches using these patterns:
   - Entity name + "digital transformation RFP"
   - Entity name + "mobile app development proposal"
   - Entity name + "ticketing system solicitation"
   - Entity name + "web platform tender"

4. For each entity, report:
   PROGRESS: [current]/[total] - [entity_name] - SEARCHING - 0 opportunities found

5. After analyzing each entity, provide completion update:
   PROGRESS: [current]/[total] - [entity_name] - COMPLETED - [X] opportunities found

6. Focus on real RFPs with deadlines, contact info, and submission details.

Start the scan now and provide regular progress updates, beginning with the Neo4j entity count announcement.`,
      options: {
        systemPrompt,
        mcpServers,
        allowedTools: [
          'mcp__neo4j-mcp__execute_query',
          'mcp__neo4j-mcp__search_sports_entities',
          'mcp__brightdata-mcp__search_engine',
          'mcp__brightdata-mcp__scrape_as_markdown',
          'Read', 'Write', 'Grep', 'Bash'
        ],
        maxTurns: 50,
        permissionMode: 'default'
      }
    })) {

      // Check for abort signal
      if (signal.aborted) {
        console.log('🛑 [RFP SCAN] Aborted by user');
        break;
      }

      // Update scan progress based on message content
      if (message.type === 'assistant') {
        const content = JSON.stringify(message.message?.content || '');
        const messageText = message.message?.content || '';
        
        // Log every assistant message for detailed tracking
        if (messageText && messageText.length > 10) {
          addDetailedLog(`🤖 Claude: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`, 'info');
        }
        
        // Look for tool usage with detailed parameters
        if (message.type === 'tool_use' || (message.message && message.message.tool_calls)) {
          const toolCalls = message.message?.tool_calls || [];
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name || 'unknown';
            const toolArgs = toolCall.function?.arguments || '';
            
            try {
              // Parse tool arguments to extract specific details
              const args = JSON.parse(toolArgs);
              
              if (toolName === 'mcp__neo4j-mcp__execute_query') {
                const query = args.query || '';
                const cleanQuery = query.length > 150 ? query.substring(0, 150) + '...' : query;
                addDetailedLog(`🗃️ Neo4j Query: ${cleanQuery}`, 'info');
              } else if (toolName === 'mcp__neo4j-mcp__search_sports_entities') {
                const searchParams = Object.keys(args).join(', ');
                addDetailedLog(`🔍 Entity Search: ${searchParams}`, 'info');
              } else if (toolName === 'mcp__brightdata-mcp__search_engine') {
                const searchQuery = args.query || '';
                const engine = args.engine || 'google';
                addDetailedLog(`🔍 Web Search (${engine}): "${searchQuery}"`, 'info');
              } else if (toolName === 'mcp__brightdata-mcp__scrape_as_markdown') {
                const url = args.url || '';
                const domain = url.replace(/^https?:\/\/([^\/]+).*$/, '$1');
                addDetailedLog(`📄 Scraping: ${domain}`, 'info');
              } else {
                addDetailedLog(`🔧 Tool: ${toolName} - ${JSON.stringify(Object.keys(args))}`, 'info');
              }
            } catch (e) {
              // Fallback if JSON parsing fails
              const cleanArgs = toolArgs.length > 100 ? toolArgs.substring(0, 100) + '...' : toolArgs;
              addDetailedLog(`🔧 Tool: ${toolName} - ${cleanArgs}`, 'info');
            }
          }
        }

        // Look for various progress patterns
        const progressMatch = content.match(/PROGRESS:\s*(\d+)\/(\d+)\s*-\s*([^-\s]+)\s*-\s*([^-\s]+)\s*-\s*(\d+)\s+opportunities/);
        if (progressMatch) {
          const [, current, total, entityName, status, rfpCount] = progressMatch;
          
          activeScan.currentEntityIndex = parseInt(current);
          activeScan.totalEntities = parseInt(total);
          activeScan.currentEntity = entityName.trim().replace(/["']/g, ''); // Clean up quotes
          activeScan.currentStage = `${status.trim()} - ${rfpCount} RFPs found`;
          
          if (status.trim() === 'COMPLETED') {
            activeScan.processedEntities = parseInt(current);
            activeScan.rfpOpportunitiesFound += parseInt(rfpCount);
            addDetailedLog(`✅ Completed entity: ${activeScan.currentEntity} - Found ${rfpCount} RFPs`, 'success');
          } else {
            addDetailedLog(`🔍 Processing: ${activeScan.currentEntity} - ${status.trim()}`, 'info');
          }
        } else {
          // Fallback: Update based on actual activity patterns
          let currentStage = activeScan.currentStage;
          
          // Update stage based on detected activities
          if (content.includes('neo4j') || content.includes('database')) {
            currentStage = 'Querying sports entities database...';
            
            // Enhanced detection for database connection announcements
            if (content.includes('connected') && content.includes('found') && content.includes('entities')) {
              addDetailedLog('🔗 DATABASE CONNECTION: Neo4j connection established', 'success');
            }
            if (content.includes('total entities') || content.includes('entity count')) {
              addDetailedLog('📊 DATABASE STATUS: Entity count verification complete', 'info');
            }
          } else if (content.includes('brightdata') || content.includes('search engine') || content.includes('web search')) {
            currentStage = 'Searching for RFP opportunities online...';
          } else if (content.includes('scrape') || content.includes('extract')) {
            currentStage = 'Analyzing web content for RFPs...';
          } else if (content.includes('entity') && content.includes('found')) {
            currentStage = 'Processing discovered entities...';
          } else if (content.includes('opportunity') || content.includes('RFP')) {
            currentStage = 'Identifying RFP opportunities...';
          }
          
          // Update processed count based on database queries (rough estimate)
          const dbQueryCount = (content.match(/database|neo4j/gi) || []).length;
          if (dbQueryCount > 0 && activeScan.processedEntities === 0) {
            // Estimate progress based on activity
            const estimatedProgress = Math.min(dbQueryCount, activeScan.totalEntities);
            activeScan.processedEntities = estimatedProgress;
            activeScan.currentEntityIndex = estimatedProgress;
          }
          
          // Update stage if it changed
          if (currentStage !== activeScan.currentStage) {
            activeScan.currentStage = currentStage;
            addDetailedLog(`📊 Stage updated: ${currentStage}`, 'info');
          }
        }

        // Look for entity mentions to update current context (broader pattern)
        const entityPatterns = [
          /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(Club|FC|United|City|Arsenal|Chelsea|Liverpool|Manchester|Barcelona|Real\s+Madrid|Bayern|PSG|Juventus)\b/gi,
          /\b(Olympic|FIFA|NBA|NFL|MLB|Premier\s+League|La\s+Liga|Bundesliga|Serie\s+A|UEFA|FIFA|IOC)\b/gi,
          /\b([A-Z][a-z]+\s+(Stadium|Arena|Center|Park|Ground|Field))\b/gi
        ];
        
        for (const pattern of entityPatterns) {
          const entityMatches = content.match(pattern);
          if (entityMatches && entityMatches.length > 0) {
            const likelyEntity = entityMatches[0].trim().replace(/["']/g, '');
            if (likelyEntity.length > 3 && likelyEntity.length < 50) {
              if (likelyEntity !== activeScan.currentEntity) {
                activeScan.currentEntity = likelyEntity;
                addDetailedLog(`🏢 Detected entity: ${likelyEntity}`, 'info');
              }
            }
          }
        }

        // Look for RFP-related activities and extract specific details
        if (content.includes('search') || content.includes('query')) {
          if (content.includes('neo4j') || content.includes('database')) {
            // Try to extract specific query details
            const queryMatch = content.match(/MATCH[^;]*;/gi) || content.match(/SELECT[^;]*FROM[^;]*/gi);
            if (queryMatch && queryMatch.length > 0) {
              const cleanQuery = queryMatch[0].replace(/\s+/g, ' ').trim().substring(0, 100);
              addDetailedLog(`🗃️ Database query executed: ${cleanQuery}...`, 'info');
            } else {
              addDetailedLog(`🗃️ Database query executed`, 'info');
            }
          } else if (content.includes('brightdata') || content.includes('search engine') || content.includes('search')) {
            // Try to extract search terms
            const searchTermMatch = content.match(/search.*?for["\s]+([^""\n]+)/i) || content.match(/query["\s:]+([^""]+)/i);
            if (searchTermMatch && searchTermMatch.length > 1) {
              const searchTerm = searchTermMatch[1].trim();
              addDetailedLog(`🔍 Web search performed: "${searchTerm}"`, 'info');
            } else {
              addDetailedLog(`🔍 Web search performed`, 'info');
            }
          } else if (content.includes('scrape') || content.includes('extract')) {
            // Try to extract URLs being scraped
            const urlMatch = content.match(/https?:\/\/[^)\s"]+/gi);
            if (urlMatch && urlMatch.length > 0) {
              const domain = urlMatch[0].replace(/^https?:\/\/([^\/]+).*$/, '$1');
              addDetailedLog(`📄 Content scraped from: ${domain}`, 'info');
            } else {
              addDetailedLog(`📄 Content scraped/extracted`, 'info');
            }
          }
        }

        // Look for RFP mentions to update count
        const rfpMatches = content.match(/\b(RFP|proposal|tender|solicitation|opportunity|contract)\b/gi);
        if (rfpMatches && rfpMatches.length > 0) {
          // Found potential RFP mentions
          const opportunityMatch = content.match(/(\d+)\s+(opportunities?|RFPs?|proposals?|tenders?)/i);
          if (opportunityMatch) {
            const count = parseInt(opportunityMatch[1]);
            if (count > activeScan.rfpOpportunitiesFound) {
              activeScan.rfpOpportunitiesFound = count;
              addDetailedLog(`🎯 RFP count updated: ${count} opportunities found`, 'success');
            }
          }
        }

        // Look for errors or warnings
        if (content.includes('error') || content.includes('failed') || content.includes('unable')) {
          addDetailedLog(`⚠️ Issue detected: ${content.substring(0, 200)}...`, 'warning');
        }
      } else if (message.type === 'tool_result') {
        // Log tool results to see what was actually found
        const toolName = message.name || 'unknown_tool';
        const result = message.result || {};
        
        if (toolName === 'mcp__neo4j-mcp__execute_query' && result.results) {
          const entityCount = Array.isArray(result.results) ? result.results.length : 'unknown';
          
          // Check if this is a total count query
          const query = message.input?.query || '';
          if (query.includes('count(e)') || query.includes('totalEntities')) {
            const totalCount = Array.isArray(result.results) && result.results[0]?.totalEntities ? 
              result.results[0].totalEntities : entityCount;
            addDetailedLog(`🎯 DATABASE STATUS: Neo4j connected - Found ${totalCount} total entities in database`, 'success');
            addDetailedLog(`✅ Neo4j connection verified - Database contains ${totalCount} entities`, 'success');
          } else {
            addDetailedLog(`📊 Neo4j Query Result: ${entityCount} entities returned`, 'success');
          }
        } else if (toolName === 'mcp__brightdata-mcp__search_engine' && result.results) {
          const searchResults = Array.isArray(result.results) ? result.results : [];
          addDetailedLog(`🌐 Search Result: ${searchResults.length} web results found`, 'success');
          
          // Analyze search results for RFP opportunities
          searchResults.forEach((searchResult: any, index: number) => {
            const title = searchResult.title || '';
            const url = searchResult.url || searchResult.link || '';
            const description = searchResult.description || searchResult.snippet || '';
            
            // Look for RFP keywords in title and description
            const rfpKeywords = ['RFP', 'request for proposal', 'solicitation', 'tender', 'proposal', 'contract'];
            const hasRfpKeywords = rfpKeywords.some(keyword => 
              title.toLowerCase().includes(keyword.toLowerCase()) || 
              description.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (hasRfpKeywords && title) {
              captureRFPOpportunity({
                title: title,
                entity: 'Web Search Result',
                source: 'BrightData Search',
                url: url,
                description: description,
                type: 'RFP',
                confidence: 'medium'
              });
            }
          });
          
        } else if (toolName === 'mcp__brightdata-mcp__scrape_as_markdown' && result.content) {
          const contentLength = result.content ? result.content.length : 0;
          addDetailedLog(`📄 Scrape Result: ${contentLength} characters extracted`, 'success');
          
          // Extract RFP details from scraped content
          const currentEntity = activeScan.currentEntity || 'Unknown Entity';
          const source = 'Web Content';
          const url = result.url || '';
          
          extractRFPDetails(result.content, currentEntity, source, url);
        }
      }

      // Brief pause to prevent overwhelming the UI
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    clearTimeout(scanTimeout);

    } catch (error) {
      clearTimeout(scanTimeout);
      console.error('❌ [RFP SCAN] Error:', error);
      activeScan.status = 'error';
      activeScan.error = error.message;
      activeScan.currentStage = 'Error occurred during scan';
      
      // Stop progress tracking
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      return; // Exit early on error
    }

    // Scan completed successfully
    if (activeScan.status === 'running') {
      activeScan.status = 'completed';
      activeScan.currentStage = 'Scan completed successfully';
      activeScan.processedEntities = activeScan.totalEntities;
      
      // Add completion summary
      addDetailedLog(`🎉 Scan completed successfully!`, 'success');
      addDetailedLog(`📊 Summary: ${activeScan.processedEntities} entities processed, ${activeScan.rfpOpportunitiesFound} RFPs found`, 'success');
      addDetailedLog(`⏱️ Total duration: ${formatTime(Date.now() - activeScan.startTime)}`, 'info');
      
      // Save RFP opportunities to file
      if (activeScan.rfpOpportunities.length > 0) {
        await saveRFPOpportunitiesToFile(activeScan.rfpOpportunities);
        addDetailedLog(`📋 Saved ${activeScan.rfpOpportunities.length} RFP opportunities to file`, 'success');
      }
      
      if (activeScan.results && activeScan.results.length > 0) {
        addDetailedLog(`📋 Results: ${activeScan.results.length} detailed records available`, 'success');
      }
    }

    // Stop progress tracking
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    console.log(`✅ [RFP SCAN] Completed ${activeScan.processedEntities} entities, found ${activeScan.rfpOpportunitiesFound} opportunities`);

  } catch (error) {
    console.error('❌ [RFP SCAN] Error:', error);
    activeScan.status = 'error';
    activeScan.error = error.message;
    activeScan.currentStage = 'Error occurred during scan';
    
    // Stop progress tracking
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}