import { MemoryClient } from 'mem0ai';

export interface MemoryEntry {
  id: string;
  memory: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface MemorySearchResult {
  results: MemoryEntry[];
}

export class YellowPantherMemoryService {
  private memoryClient: MemoryClient | null = null;
  private userId: string;

  constructor() {
    this.userId = process.env.MEM0_USER_ID || 'user001';
  }

  private getMemoryClient(): MemoryClient {
    if (!this.memoryClient) {
      this.memoryClient = new MemoryClient({
        apiKey: process.env.MEM0_API_KEY || 'm0-v08M6MKKztyngCm9FlNukXHbLlhaOx2lWyGQuPn7'
      });
    }
    return this.memoryClient;
  }

  /**
   * Add a new memory from user interaction or discovery
   */
  async addMemory(
    content: string, 
    metadata?: {
      type?: 'user_preference' | 'discovery' | 'research_insight' | 'client_interaction';
      entityType?: 'club' | 'organization' | 'contact' | 'project';
      entityName?: string;
      context?: string;
    }
  ): Promise<void> {
    try {
      await this.getMemoryClient().add([{
        role: 'user',
        content: content
      }], {
        user_id: this.userId,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'yellow_panther_ai',
          ...metadata
        }
      });
      console.log(`✅ Memory added: ${content.substring(0, 50)}...`);
    } catch (error) {
      console.error('❌ Error adding memory:', error);
    }
  }

  /**
   * Search memories relevant to current context
   */
  async searchMemories(query: string, limit: number = 5): Promise<MemoryEntry[]> {
    try {
      const result = await this.getMemoryClient().search(query, {
        user_id: this.userId,
        limit
      });
      return result.results || [];
    } catch (error) {
      console.error('❌ Error searching memories:', error);
      return [];
    }
  }

  /**
   * Get all memories for comprehensive context
   */
  async getAllMemories(): Promise<MemoryEntry[]> {
    try {
      const result = await this.getMemoryClient().getAll({
        user_id: this.userId
      });
      return result.results || [];
    } catch (error) {
      console.error('❌ Error getting all memories:', error);
      return [];
    }
  }

  /**
   * Update existing memory
   */
  async updateMemory(memoryId: string, content: string): Promise<void> {
    try {
      await this.getMemoryClient().update(memoryId, [{
        role: 'user',
        content: content
      }], {
        user_id: this.userId
      });
      console.log(`✅ Memory updated: ${memoryId}`);
    } catch (error) {
      console.error('❌ Error updating memory:', error);
    }
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    try {
      await this.getMemoryClient().delete(memoryId, {
        user_id: this.userId
      });
      console.log(`✅ Memory deleted: ${memoryId}`);
    } catch (error) {
      console.error('❌ Error deleting memory:', error);
    }
  }

  /**
   * Add discovery to both memory and knowledge graph
   */
  async addDiscovery(
    discovery: string,
    entityType: 'club' | 'organization' | 'contact',
    entityName: string,
    context?: string
  ): Promise<void> {
    const memoryContent = `Discovery about ${entityName} (${entityType}): ${discovery}`;
    
    await this.addMemory(memoryContent, {
      type: 'discovery',
      entityType,
      entityName,
      context
    });

    // TODO: Integrate with Neo4j to add relationship or property
    console.log(`🔍 Discovery logged for ${entityName}: ${discovery}`);
  }

  /**
   * Add user preference/insight
   */
  async addUserInsight(insight: string, category?: string): Promise<void> {
    await this.addMemory(insight, {
      type: 'user_preference',
      context: category
    });
  }

  /**
   * Get contextual memories for enhanced responses
   */
  async getContextualMemories(
    query: string,
    entityName?: string,
    entityType?: string
  ): Promise<string> {
    const searchQueries = [query];
    
    if (entityName) {
      searchQueries.push(entityName);
    }
    
    if (entityType) {
      searchQueries.push(entityType);
    }

    const allMemories: MemoryEntry[] = [];
    
    for (const searchQuery of searchQueries) {
      const memories = await this.searchMemories(searchQuery, 3);
      allMemories.push(...memories);
    }

    // Remove duplicates and format
    const uniqueMemories = allMemories.filter((memory, index, self) => 
      index === self.findIndex(m => m.id === memory.id)
    );

    if (uniqueMemories.length === 0) {
      return '';
    }

    const memoryContext = uniqueMemories
      .slice(0, 5) // Limit to top 5 most relevant
      .map(memory => `- ${memory.memory}`)
      .join('\n');

    return `\n\n🧠 RELEVANT MEMORIES:\n${memoryContext}\n`;
  }

  /**
   * Initialize with some default Yellow Panther context
   */
  async initializeYellowPantherContext(): Promise<void> {
    const initialMemories = [
      "Yellow Panther specializes in mobile app development for sports organizations, with expertise in React Native, iOS, and Android",
      "Current active clients include Team GB and Premier Padel with successful app deployments",
      "Premier League is a high-priority target client with estimated £2.5M opportunity for next-gen mobile app",
      "Focus areas include fan engagement, digital transformation, and mobile strategy for sports organizations",
      "Strong track record in Olympic apps, tournament apps, and sports league mobile solutions"
    ];

    for (const memory of initialMemories) {
      await this.addMemory(memory, {
        type: 'user_preference',
        context: 'company_profile'
      });
    }

    console.log('🚀 Yellow Panther context initialized in Mem0');
  }
}

// Export singleton instance
export const memoryService = new YellowPantherMemoryService(); 