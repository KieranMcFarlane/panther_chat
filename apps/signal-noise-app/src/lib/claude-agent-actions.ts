import { CopilotRuntime } from '@copilotkit/runtime';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

// CopilotKit action for Claude Agent Scheduler commands
export const claudeAgentActions = {
  /**
   * Execute a slash command for the Claude Agent Scheduler
   */
  async executeSlashCommand(input: { command: string }): Promise<any> {
    try {
      // Ensure scheduler is configured
      try {
        claudeAgentScheduler.configure({
          brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
          brightdataZone: process.env.BRIGHTDATA_ZONE || '',
          neo4jUri: process.env.NEO4J_URI || '',
          neo4jUsername: process.env.NEO4J_USERNAME || '',
          neo4jPassword: process.env.NEO4J_PASSWORD || '',
          teamsWebhookUrl: '',
          perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
          searchQueries: [],
          targetIndustries: []
        });
      } catch (error) {
        // Scheduler might already be configured, which is fine
      }

      const result = await claudeAgentScheduler.executeSlashCommand(input.command);
      return {
        success: true,
        result,
        message: `Executed command: ${input.command}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Failed to execute command: ${input.command}`
      };
    }
  },

  /**
   * Get current agent status and available commands
   */
  async getAgentStatus(): Promise<any> {
    try {
      // Ensure scheduler is configured
      try {
        claudeAgentScheduler.configure({
          brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
          brightdataZone: process.env.BRIGHTDATA_ZONE || '',
          neo4jUri: process.env.NEO4J_URI || '',
          neo4jUsername: process.env.NEO4J_USERNAME || '',
          neo4jPassword: process.env.NEO4J_PASSWORD || '',
          teamsWebhookUrl: '',
          perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
          searchQueries: [],
          targetIndustries: []
        });
      } catch (error) {
        // Scheduler might already be configured, which is fine
      }

      const status = await claudeAgentScheduler.getAgentStatus();
      const commands = claudeAgentScheduler.getAvailableCommands();
      const help = await claudeAgentScheduler.executeSlashCommand('/help');

      return {
        success: true,
        status,
        availableCommands: commands,
        help
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to get agent status'
      };
    }
  },

  /**
   * Select and activate a specific agent
   */
  async selectAgent(input: { agentType: 'mines' | 'enrichment' }): Promise<any> {
    try {
      // Ensure scheduler is configured
      try {
        claudeAgentScheduler.configure({
          brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
          brightdataZone: process.env.BRIGHTDATA_ZONE || '',
          neo4jUri: process.env.NEO4J_URI || '',
          neo4jUsername: process.env.NEO4J_USERNAME || '',
          neo4jPassword: process.env.NEO4J_PASSWORD || '',
          teamsWebhookUrl: '',
          perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
          searchQueries: [],
          targetIndustries: []
        });
      } catch (error) {
        // Scheduler might already be configured, which is fine
      }

      const result = await claudeAgentScheduler.executeSlashCommand(`/select-${input.agentType}`);
      return {
        success: true,
        result,
        message: `Selected ${input.agentType} agent`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Failed to select ${input.agentType} agent`
      };
    }
  },

  /**
   * Execute the current agent immediately
   */
  async executeCurrentAgent(): Promise<any> {
    try {
      // Ensure scheduler is configured
      try {
        claudeAgentScheduler.configure({
          brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
          brightdataZone: process.env.BRIGHTDATA_ZONE || '',
          neo4jUri: process.env.NEO4J_URI || '',
          neo4jUsername: process.env.NEO4J_USERNAME || '',
          neo4jPassword: process.env.NEO4J_PASSWORD || '',
          teamsWebhookUrl: '',
          perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
          searchQueries: [],
          targetIndustries: []
        });
      } catch (error) {
        // Scheduler might already be configured, which is fine
      }

      const result = await claudeAgentScheduler.executeSlashCommand('/execute-now');
      return {
        success: true,
        result,
        message: 'Executed current agent immediately'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to execute current agent'
      };
    }
  }
};

// CopilotKit action descriptions
export const claudeAgentActionDefinitions = [
  {
    name: 'executeSlashCommand',
    description: 'Execute a slash command for the Claude Agent Scheduler',
    parameters: {
      command: {
        type: 'string',
        description: 'The slash command to execute (e.g., /select-mines, /execute-now, /help)',
        required: true
      }
    }
  },
  {
    name: 'getAgentStatus',
    description: 'Get current agent status and available commands',
    parameters: {}
  },
  {
    name: 'selectAgent',
    description: 'Select and activate a specific agent',
    parameters: {
      agentType: {
        type: 'string',
        description: 'The type of agent to select (mines or enrichment)',
        required: true,
        enum: ['mines', 'enrichment']
      }
    }
  },
  {
    name: 'executeCurrentAgent',
    description: 'Execute the currently selected agent immediately',
    parameters: {}
  }
];

export default claudeAgentActions;