'use client';

import { useThreads } from '@/contexts/ThreadContext';
import { Message, ToolCall } from '@/types/thread-system';
import brightDataMCPService from './BrightDataMCPService';
import teamsStoreService from './TeamsStoreService';

interface ParallelExecution {
  threadId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  startTime?: Date;
  endTime?: Date;
  currentStep: string;
  progress: number;
  error?: string;
  abortController?: AbortController;
}

interface ExecutionStep {
  name: string;
  description: string;
  estimatedDuration: number;
  execute: (threadId: string, context: any) => Promise<any>;
}

export class ParallelClaudeAgentService {
  private executions: Map<string, ParallelExecution> = new Map();
  private executionQueue: Array<{
    threadId: string;
    steps: ExecutionStep[];
    context: any;
    priority: number;
  }> = [];
  private maxConcurrentExecutions: number = 5;
  private runningExecutions: number = 0;

  constructor() {
    this.initializeService();
  }

  private initializeService() {
    console.log('Parallel Claude Agent Service initialized');
    this.processExecutionQueue();
  }

  // Start parallel execution for a thread
  async startExecution(
    threadId: string, 
    userMessage: string, 
    threadConfig: any,
    onProgress?: (step: string, progress: number) => void,
    onComplete?: (result: any) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    // Check if thread is already executing
    if (this.executions.has(threadId) && this.executions.get(threadId)!.status === 'running') {
      throw new Error(`Thread ${threadId} is already executing`);
    }

    // Create abort controller for this execution
    const abortController = new AbortController();

    // Initialize execution state
    const execution: ParallelExecution = {
      threadId,
      status: 'running',
      startTime: new Date(),
      currentStep: 'Initializing...',
      progress: 0,
      abortController
    };

    this.executions.set(threadId, execution);

    try {
      // Create execution steps based on thread configuration
      const steps = this.createExecutionSteps(threadConfig, userMessage);
      
      // Add to execution queue
      this.executionQueue.push({
        threadId,
        steps,
        context: {
          userMessage,
          threadConfig,
          onProgress,
          onComplete,
          onError,
          abortController
        },
        priority: threadConfig.priority || 1
      });

      // Sort queue by priority
      this.executionQueue.sort((a, b) => b.priority - a.priority);

    } catch (error) {
      execution.status = 'error';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      onError?.(execution.error);
    }
  }

  // Create execution steps based on thread configuration
  private createExecutionSteps(threadConfig: any, userMessage: string): ExecutionStep[] {
    const steps: ExecutionStep[] = [];

    // Common steps for all thread types
    steps.push({
      name: 'context_analysis',
      description: 'Analyzing user request and thread context',
      estimatedDuration: 2000,
      execute: async (threadId: string, context: any) => {
        await this.updateExecutionProgress(threadId, 'Analyzing context...', 10);
        
        // Extract entities from user message
        const entities = this.extractEntities(userMessage);
        
        // Add entities to Teams Store
        for (const entity of entities) {
          teamsStoreService.addEntity({
            name: entity.name,
            type: entity.type,
            properties: { source: 'user_input', context: userMessage },
            confidence: entity.confidence,
            sources: []
          }, threadId);
        }
        
        return { entities, analysis: 'Context analyzed successfully' };
      }
    });

    // Add steps based on thread tools and configuration
    if (threadConfig.tools?.includes('brightdata')) {
      steps.push({
        name: 'web_research',
        description: 'Performing web research using BrightData MCP',
        estimatedDuration: 5000,
        execute: async (threadId: string, context: any) => {
          await this.updateExecutionProgress(threadId, 'Researching web...', 30);
          
          // Extract search queries from user message
          const searchQueries = this.extractSearchQueries(context.userMessage);
          
          const results = [];
          for (const query of searchQueries) {
            const searchResults = await brightDataMCPService.performWebSearch(threadId, query);
            results.push(...searchResults);
          }
          
          return { searchResults: results, queries: searchQueries };
        }
      });
    }

    if (threadConfig.tools?.includes('neo4j-mcp')) {
      steps.push({
        name: 'knowledge_graph_query',
        description: 'Querying knowledge graph for relevant information',
        estimatedDuration: 3000,
        execute: async (threadId: string, context: any) => {
          await this.updateExecutionProgress(threadId, 'Querying knowledge graph...', 60);
          
          // Generate relevant Neo4j queries based on context
          const queries = this.generateNeo4jQueries(context.userMessage, context.entities);
          
          const graphResults = [];
          for (const query of queries) {
            // In real implementation, call Neo4j MCP
            const result = await this.callNeo4jMCP(query);
            graphResults.push(result);
          }
          
          return { graphResults, queries };
        }
      });
    }

    if (threadConfig.tools?.includes('perplexity-mcp')) {
      steps.push({
        name: 'deep_research',
        description: 'Performing deep research with Perplexity',
        estimatedDuration: 4000,
        execute: async (threadId: string, context: any) => {
          await this.updateExecutionProgress(threadId, 'Deep research...', 80);
          
          // Call Perplexity MCP for additional research
          const researchResult = await this.callPerplexityMCP(context.userMessage);
          
          return { researchResult };
        }
      });
    }

    // Final synthesis step
    steps.push({
      name: 'synthesis',
      description: 'Synthesizing results and generating response',
      estimatedDuration: 3000,
      execute: async (threadId: string, context: any) => {
        await this.updateExecutionProgress(threadId, 'Synthesizing response...', 90);
        
        // Combine all previous results
        const synthesis = await this.synthesizeResults(context);
        
        // Add insights to Teams Store
        if (synthesis.insights) {
          for (const insight of synthesis.insights) {
            teamsStoreService.addInsight({
              title: insight.title,
              content: insight.content,
              category: 'ai_generated',
              confidence: insight.confidence,
              tags: insight.tags || []
            }, threadId);
          }
        }
        
        return synthesis;
      }
    });

    return steps;
  }

  // Process execution queue with concurrency control
  private async processExecutionQueue(): Promise<void> {
    while (this.executionQueue.length > 0 && this.runningExecutions < this.maxConcurrentExecutions) {
      const executionItem = this.executionQueue.shift()!;
      this.runningExecutions++;
      
      // Execute in background
      this.executeSteps(executionItem.threadId, executionItem.steps, executionItem.context)
        .finally(() => {
          this.runningExecutions--;
          // Process next item in queue
          setTimeout(() => this.processExecutionQueue(), 100);
        });
    }
  }

  // Execute steps for a thread
  private async executeSteps(
    threadId: string, 
    steps: ExecutionStep[], 
    context: any
  ): Promise<void> {
    const execution = this.executions.get(threadId)!;
    const results: any = {};
    
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Check if execution was aborted
        if (execution.abortController?.signal.aborted) {
          throw new Error('Execution aborted');
        }
        
        // Update current step
        execution.currentStep = step.description;
        this.updateExecutionProgress(threadId, step.description, (i / steps.length) * 100);
        
        // Execute step
        const stepResult = await step.execute(threadId, { ...context, results });
        results[step.name] = stepResult;
        
        // Call progress callback
        if (context.onProgress) {
          context.onProgress(step.description, (i / steps.length) * 100);
        }
      }
      
      // Mark execution as completed
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.currentStep = 'Completed';
      execution.progress = 100;
      
      // Call completion callback
      if (context.onComplete) {
        context.onComplete(results);
      }
      
    } catch (error) {
      execution.status = 'error';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Call error callback
      if (context.onError) {
        context.onError(execution.error);
      }
    }
  }

  // Update execution progress
  private async updateExecutionProgress(threadId: string, step: string, progress: number): Promise<void> {
    const execution = this.executions.get(threadId);
    if (execution) {
      execution.currentStep = step;
      execution.progress = progress;
    }
  }

  // Helper methods for extraction and analysis
  private extractEntities(message: string): Array<{ name: string; type: string; confidence: number }> {
    // Simple entity extraction - in real implementation, use NLP
    const entities = [];
    const words = message.split(/\s+/);
    
    words.forEach(word => {
      // Look for capitalized words (potential entities)
      if (word.length > 2 && /^[A-Z][a-z]+/.test(word)) {
        entities.push({
          name: word,
          type: 'unknown', // Would be enhanced with entity classification
          confidence: 0.7
        });
      }
    });
    
    return entities;
  }

  private extractSearchQueries(message: string): string[] {
    // Extract search queries from user message
    const queries = [];
    
    // Look for question patterns and keywords
    if (message.includes('what is') || message.includes('tell me about')) {
      const matches = message.match(/(?:what is|tell me about)\s+(.+?)(?:\?|$)/i);
      if (matches) {
        queries.push(matches[1].trim());
      }
    }
    
    // Look for research keywords
    if (message.includes('research') || message.includes('find') || message.includes('search')) {
      // Extract the main topic
      const topic = message.replace(/\b(?:research|find|search)\b/gi, '').trim();
      if (topic) {
        queries.push(topic);
      }
    }
    
    // Default query if none found
    if (queries.length === 0) {
      queries.push(message.substring(0, 100)); // First 100 chars
    }
    
    return queries;
  }

  private generateNeo4jQueries(message: string, entities: any[]): string[] {
    const queries = [];
    
    // Generate queries based on entities found
    entities.forEach(entity => {
      queries.push(`MATCH (n) WHERE n.name =~ '(?i).*${entity.name}.*' RETURN n LIMIT 10`);
    });
    
    // Generate general query if no entities
    if (entities.length === 0) {
      queries.push(`MATCH (n) RETURN n LIMIT 20`);
    }
    
    return queries;
  }

  // Mock MCP calls (in real implementation, these would call actual MCP tools)
  private async callNeo4jMCP(query: string): Promise<any> {
    console.log(`Calling Neo4j MCP with query: ${query}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      query,
      results: [
        { id: '1', name: 'Sample Entity 1', type: 'organization' },
        { id: '2', name: 'Sample Entity 2', type: 'person' }
      ],
      executionTime: 1000
    };
  }

  private async callPerplexityMCP(query: string): Promise<any> {
    console.log(`Calling Perplexity MCP with query: ${query}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      query,
      content: `Research results for ${query}...`,
      sources: ['source1.com', 'source2.com'],
      confidence: 0.85
    };
  }

  private async synthesizeResults(context: any): Promise<any> {
    const { userMessage, results } = context;
    
    // Synthesize all results into a coherent response
    const synthesis = {
      userMessage,
      summary: `Based on your request about "${userMessage}", I've analyzed the available information...`,
      insights: [
        {
          title: 'Key Finding',
          content: 'Important insight from the analysis',
          confidence: 0.8,
          tags: ['analysis', 'finding']
        }
      ],
      recommendations: [],
      nextSteps: []
    };
    
    // Add specific insights based on available results
    if (results.web_research?.searchResults) {
      synthesis.insights.push({
        title: 'Web Research Findings',
        content: `Found ${results.web_research.searchResults.length} relevant web sources`,
        confidence: 0.9,
        tags: ['research', 'web']
      });
    }
    
    if (results.knowledge_graph_query?.graphResults) {
      synthesis.insights.push({
        title: 'Knowledge Graph Analysis',
        content: `Analyzed ${results.knowledge_graph_query.graphResults.length} entities from the knowledge graph`,
        confidence: 0.85,
        tags: ['knowledge-graph', 'entities']
      });
    }
    
    return synthesis;
  }

  // Public API methods
  getExecutionStatus(threadId: string): ParallelExecution | null {
    return this.executions.get(threadId) || null;
  }

  isThreadExecuting(threadId: string): boolean {
    const execution = this.executions.get(threadId);
    return execution?.status === 'running' || false;
  }

  abortExecution(threadId: string): boolean {
    const execution = this.executions.get(threadId);
    if (execution && execution.status === 'running') {
      execution.abortController?.abort();
      execution.status = 'error';
      execution.error = 'Execution aborted';
      execution.endTime = new Date();
      return true;
    }
    return false;
  }

  getQueueStatus(): { queued: number; running: number; completed: number } {
    const queued = this.executionQueue.length;
    const running = this.runningExecutions;
    const completed = Array.from(this.executions.values()).filter(e => e.status === 'completed').length;
    
    return { queued, running, completed };
  }

  // Get all executions for monitoring
  getAllExecutions(): ParallelExecution[] {
    return Array.from(this.executions.values());
  }

  // Clear completed executions (cleanup)
  clearCompletedExecutions(): void {
    for (const [threadId, execution] of this.executions.entries()) {
      if (execution.status === 'completed' || execution.status === 'error') {
        // Keep only recent executions (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (execution.endTime! < oneHourAgo) {
          this.executions.delete(threadId);
        }
      }
    }
  }
}

// Singleton instance
export const parallelClaudeAgentService = new ParallelClaudeAgentService();
export default parallelClaudeAgentService;