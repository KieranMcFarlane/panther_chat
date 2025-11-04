/**
 * Direct Claude Code wrapper for production A2A system
 * Bypasses the SDK to call Claude Code directly in headless mode
 */

import { spawn } from 'child_process';
import { liveLogService } from './LiveLogService';
import { a2aSessionManager } from './A2ASessionManager';

interface DirectClaudeOptions {
  prompt: string;
  systemPrompt?: string;
  outputFormat?: 'text' | 'json' | 'stream-json';
  allowedTools?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  maxTurns?: number;
  sessionId?: string;
}

interface ClaudeResult {
  type: 'result' | 'error';
  subtype: 'success' | 'error_during_execution';
  result?: string;
  error?: {
    message: string;
    code?: string;
  };
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

export class DirectClaudeService {
  private claudeCodePath: string;

  constructor() {
    this.claudeCodePath = '/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/@anthropic-ai/claude-code/cli.js';
  }

  async runQuery(options: DirectClaudeOptions): Promise<ClaudeResult> {
    return new Promise((resolve, reject) => {
      const args = ['--print'];
      
      // Add output format
      if (options.outputFormat) {
        args.push('--output-format', options.outputFormat);
      }
      
      // Add permission mode
      if (options.permissionMode) {
        args.push('--permission-mode', options.permissionMode);
      }
      
      // Add allowed tools
      if (options.allowedTools) {
        args.push('--allowed-tools', options.allowedTools);
      }
      
      // Add system prompt
      if (options.systemPrompt) {
        args.push('--append-system-prompt', options.systemPrompt);
      }
      
      // Add max turns - limit to prevent hanging
      const maxTurns = Math.min(options.maxTurns || 10, 15); // Cap at 15 turns
      args.push('--max-turns', maxTurns.toString());
      
      // Set up environment
      const env = {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        CLAUDE_CODE_ENTRYPOINT: 'cli',
        CLAUDECODE: '1'
      };

      // Spawn Claude Code process with timeout
      const child = spawn('node', [this.claudeCodePath, ...args], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 180000 // 3 minute timeout
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        isTimedOut = true;
        child.kill('SIGTERM');
        reject(new Error('Claude Code process timed out after 3 minutes'));
      }, 180000);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (isTimedOut) {
          return; // Already rejected by timeout
        }

        if (code === 0) {
          try {
            // Parse JSON output
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (error) {
            // If not JSON, treat as text result
            resolve({
              type: 'result',
              subtype: 'success',
              result: stdout.trim()
            });
          }
        } else {
          reject(new Error(`Claude Code process exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start Claude Code process: ${error.message}`));
      });

      // Send the prompt
      child.stdin?.write(options.prompt);
      child.stdin?.end();
    });
  }

  async runA2AWorkflow(
    entityLimit: number = 50,
    onProgress?: (progress: any) => void
  ): Promise<any[]> {
    const startTime = Date.now();
    const sessionId = await a2aSessionManager.createOrResumeSession();

    try {
      await liveLogService.addLog({
        type: 'info',
        message: `🚀 Starting direct Claude Code A2A workflow with ${entityLimit} entities`,
        source: 'direct-claude-service',
        timestamp: new Date(),
        metadata: { sessionId, entityLimit }
      });

      // Build simplified, effective prompt for A2A workflow
      const systemPrompt = `You are an RFP Intelligence Specialist for sports industry opportunities.

TASK: Analyze ${entityLimit} sports entities and identify RFP opportunities.

EXECUTION:
1. Use Neo4j to get ${entityLimit} sports entities
2. For each entity: research and identify RFP opportunities
3. Report findings for each entity
4. Provide final summary

Focus on actionable intelligence and business opportunities.`;

      const prompt = `Analyze ${entityLimit} sports entities from the Neo4j knowledge base for RFP opportunities. 

Process each entity systematically:
1. Get entities using Neo4j
2. Research each entity using available tools
3. Identify RFP opportunities and market intelligence
4. Report findings for each entity processed
5. Provide comprehensive summary

Start now and process all ${entityLimit} entities systematically.`;

      onProgress?.({
        type: 'session_start',
        agent: 'direct_claude_orchestrator',
        message: `🚀 Direct Claude Code A2A workflow starting...`,
        timestamp: new Date().toISOString(),
        sessionState: { sessionId, entityLimit }
      });

      // Run the query with optimized parameters
      const result = await this.runQuery({
        prompt,
        systemPrompt,
        outputFormat: 'json',
        allowedTools: 'mcp__neo4j__execute_query,mcp__brightdata_mcp__search_engine,mcp__perplexity_mcp__search_engine,TodoWrite,Read,Grep',
        permissionMode: 'acceptEdits',
        maxTurns: 12, // Reduced to prevent hanging
        sessionId
      });

      if (result.type === 'result' && result.subtype === 'success') {
        await a2aSessionManager.completeSession(sessionId, 'completed');
        
        const sessionSummary = a2aSessionManager.getSessionCostSummary(sessionId);

        await liveLogService.addLog({
          type: 'success',
          message: `✅ Direct Claude Code A2A workflow completed successfully`,
          source: 'direct-claude-service',
          timestamp: new Date(),
          metadata: {
            sessionId,
            sessionSummary,
            processingTime: Date.now() - startTime,
            result: result.result
          }
        });

        return [{
          sessionId,
          processingTime: Date.now() - startTime,
          entitiesProcessed: entityLimit,
          result: result.result,
          sessionSummary,
          source: 'direct_claude_code_a2a_service'
        }];

      } else {
        throw new Error(result.error?.message || 'Unknown error occurred');
      }

    } catch (error) {
      await a2aSessionManager.completeSession(sessionId, 'error');
      
      await liveLogService.addLog({
        type: 'error',
        message: `❌ Direct Claude Code A2A workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'direct-claude-service',
        timestamp: new Date(),
        metadata: {
          sessionId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      throw error;
    }
  }
}

export const directClaudeService = new DirectClaudeService();