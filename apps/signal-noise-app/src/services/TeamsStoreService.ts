'use client';

import { 
  TeamsStore, 
  Entity, 
  Insight, 
  Resource, 
  Connection, 
  WebResearchEntry,
  ScrapedContentEntry,
  ConversationSummary,
  ThreadReference 
} from '@/types/thread-system';

class TeamsStoreService {
  private store: TeamsStore;
  private listeners: ((store: TeamsStore) => void)[] = [];

  constructor() {
    this.store = this.initializeStore();
    this.loadFromPersistence();
  }

  private initializeStore(): TeamsStore {
    return {
      id: 'teams-store-main',
      name: 'Global Teams Knowledge Store',
      description: 'Shared knowledge base across all conversation threads',
      createdAt: new Date(),
      updatedAt: new Date(),
      entities: [],
      insights: [],
      resources: [],
      connections: [],
      conversations: [],
      webResearch: [],
      scrapedContent: [],
      threadReferences: []
    };
  }

  // Listen to store changes
  subscribe(listener: (store: TeamsStore) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.store));
    this.saveToPersistence();
  }

  // Persistence methods
  private async loadFromPersistence() {
    try {
      // Check if localStorage is available (SSR-safe)
      if (typeof window === 'undefined') {
        return; // Skip localStorage loading on server
      }
      
      // Load from localStorage first (client-side)
      const stored = localStorage.getItem('teams-store');
      if (stored) {
        const data = JSON.parse(stored);
        this.store = {
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          entities: data.entities.map((e: any) => ({
            ...e,
            lastUpdated: new Date(e.lastUpdated)
          })),
          insights: data.insights.map((i: any) => ({
            ...i,
            createdAt: new Date(i.createdAt)
          })),
          resources: data.resources.map((r: any) => ({
            ...r,
            createdAt: new Date(r.createdAt)
          })),
          connections: data.connections.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt)
          })),
          conversations: data.conversations.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt)
          })),
          webResearch: data.webResearch.map((w: any) => ({
            ...w,
            createdAt: new Date(w.createdAt)
          })),
          scrapedContent: data.scrapedContent.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt)
          }))
        };
      }

      // TODO: Load from Supabase/NeptuneDB for server-side persistence
      // This would provide cross-device sync and team-wide sharing
    } catch (error) {
      console.error('Error loading Teams Store:', error);
    }
  }

  private saveToPersistence() {
    try {
      // Check if localStorage is available (SSR-safe)
      if (typeof window !== 'undefined') {
        localStorage.setItem('teams-store', JSON.stringify(this.store));
      }
      this.store.updatedAt = new Date();
      
      // TODO: Save to Supabase/NeptuneDB
      // await supabase.from('teams_store').upsert(this.store);
    } catch (error) {
      console.error('Error saving Teams Store:', error);
    }
  }

  // Entity management
  addEntity(entity: Omit<Entity, 'id' | 'discoveredBy' | 'lastUpdated'>, threadId: string): Entity {
    const newEntity: Entity = {
      ...entity,
      id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      lastUpdated: new Date()
    };

    // Check if entity already exists
    const existingEntity = this.findEntityByName(entity.name);
    if (existingEntity) {
      // Update existing entity
      existingEntity.discoveredBy = [...new Set([...existingEntity.discoveredBy, threadId])];
      existingEntity.lastUpdated = new Date();
      if (entity.confidence > existingEntity.confidence) {
        existingEntity.confidence = entity.confidence;
      }
      existingEntity.properties = { ...existingEntity.properties, ...entity.properties };
      existingEntity.sources = [...new Set([...existingEntity.sources, ...entity.sources])];
      this.notifyListeners();
      return existingEntity;
    }

    this.store.entities.push(newEntity);
    this.notifyListeners();
    return newEntity;
  }

  findEntityByName(name: string): Entity | null {
    return this.store.entities.find(e => e.name.toLowerCase() === name.toLowerCase()) || null;
  }

  getEntitiesByType(type: Entity['type']): Entity[] {
    return this.store.entities.filter(e => e.type === type);
  }

  getEntitiesDiscoveredByThread(threadId: string): Entity[] {
    return this.store.entities.filter(e => e.discoveredBy.includes(threadId));
  }

  // Insight management
  addInsight(insight: Omit<Insight, 'id' | 'discoveredBy' | 'createdAt'>, threadId: string): Insight {
    const newInsight: Insight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      createdAt: new Date()
    };

    // Check for duplicate insights
    const isDuplicate = this.store.insights.some(i => 
      i.title.toLowerCase() === insight.title.toLowerCase() && 
      i.content.substring(0, 100) === insight.content.substring(0, 100)
    );

    if (!isDuplicate) {
      this.store.insights.push(newInsight);
      this.notifyListeners();
    }

    return newInsight;
  }

  getInsightsByCategory(category: string): Insight[] {
    return this.store.insights.filter(i => i.category === category);
  }

  getInsightsByThread(threadId: string): Insight[] {
    return this.store.insights.filter(i => i.discoveredBy.includes(threadId));
  }

  // Resource management (from BrightData MCP)
  addResource(resource: Omit<Resource, 'id' | 'discoveredBy' | 'createdAt'>, threadId: string): Resource {
    const newResource: Resource = {
      ...resource,
      id: `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      createdAt: new Date()
    };

    // Check for duplicate resources
    const existingResource = this.store.resources.find(r => r.url === resource.url);
    if (existingResource) {
      existingResource.discoveredBy = [...new Set([...existingResource.discoveredBy, threadId])];
      this.notifyListeners();
      return existingResource;
    }

    this.store.resources.push(newResource);
    this.notifyListeners();
    return newResource;
  }

  getResourcesByThread(threadId: string): Resource[] {
    return this.store.resources.filter(r => r.discoveredBy.includes(threadId));
  }

  getResourcesDiscoveredViaBrightData(): Resource[] {
    return this.store.resources.filter(r => r.discoveredVia === 'brightdata');
  }

  // Connection management
  addConnection(connection: Omit<Connection, 'id' | 'discoveredBy' | 'createdAt'>, threadId: string): Connection {
    const newConnection: Connection = {
      ...connection,
      id: `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      createdAt: new Date()
    };

    // Check for duplicate connections
    const existingConnection = this.store.connections.find(c => 
      (c.fromEntity === connection.fromEntity && c.toEntity === connection.toEntity) ||
      (c.fromEntity === connection.toEntity && c.toEntity === connection.fromEntity)
    );

    if (existingConnection) {
      existingConnection.discoveredBy = [...new Set([...existingConnection.discoveredBy, threadId])];
      existingConnection.strength = Math.max(existingConnection.strength, connection.strength);
      this.notifyListeners();
      return existingConnection;
    }

    this.store.connections.push(newConnection);
    this.notifyListeners();
    return newConnection;
  }

  // Web research management (BrightData MCP)
  addWebResearch(research: Omit<WebResearchEntry, 'id'>, threadId: string): WebResearchEntry {
    const newResearch: WebResearchEntry = {
      ...research,
      id: `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      performedBy: threadId
    };

    this.store.webResearch.push(newResearch);
    this.notifyListeners();
    return newResearch;
  }

  getWebResearchByQuery(query: string): WebResearchEntry[] {
    return this.store.webResearch.filter(r => 
      r.query.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Scraped content management (BrightData MCP)
  addScrapedContent(content: Omit<ScrapedContentEntry, 'id'>, threadId: string): ScrapedContentEntry {
    const newContent: ScrapedContentEntry = {
      ...content,
      id: `scraped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scrapedBy: threadId
    };

    // Check for duplicate scraped content
    const existingContent = this.store.scrapedContent.find(c => c.url === content.url);
    if (existingContent) {
      // Merge extracted data
      existingContent.extractedData = {
        ...existingContent.extractedData,
        ...content.extractedData
      };
      this.notifyListeners();
      return existingContent;
    }

    this.store.scrapedContent.push(newContent);
    this.notifyListeners();
    return newContent;
  }

  // Thread references (cross-thread connections)
  addThreadReference(reference: Omit<ThreadReference, 'id'>): ThreadReference {
    const newReference: ThreadReference = {
      ...reference,
      id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.store.threadReferences.push(newReference);
    this.notifyListeners();
    return newReference;
  }

  getThreadReferences(threadId: string): ThreadReference[] {
    return this.store.threadReferences.filter(r => r.threadId === threadId);
  }

  // Conversation summaries
  addConversationSummary(summary: Omit<ConversationSummary, 'id'>): ConversationSummary {
    const newSummary: ConversationSummary = {
      ...summary,
      id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.store.conversations.push(newSummary);
    this.notifyListeners();
    return newSummary;
  }

  // Search and analytics
  searchEntities(query: string): Entity[] {
    const lowerQuery = query.toLowerCase();
    return this.store.entities.filter(e => 
      e.name.toLowerCase().includes(lowerQuery) ||
      e.type.toLowerCase().includes(lowerQuery) ||
      Object.values(e.properties).some(value => 
        String(value).toLowerCase().includes(lowerQuery)
      )
    );
  }

  searchInsights(query: string): Insight[] {
    const lowerQuery = query.toLowerCase();
    return this.store.insights.filter(i => 
      i.title.toLowerCase().includes(lowerQuery) ||
      i.content.toLowerCase().includes(lowerQuery) ||
      i.category.toLowerCase().includes(lowerQuery) ||
      i.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getStoreStats() {
    return {
      entities: this.store.entities.length,
      insights: this.store.insights.length,
      resources: this.store.resources.length,
      connections: this.store.connections.length,
      conversations: this.store.conversations.length,
      webResearch: this.store.webResearch.length,
      scrapedContent: this.store.scrapedContent.length,
      lastUpdated: this.store.updatedAt
    };
  }

  // Get current store state
  getStore(): TeamsStore {
    return { ...this.store };
  }

  // Clear store (for testing/reset)
  clearStore() {
    this.store = this.initializeStore();
    this.notifyListeners();
  }

  // Export/Import functionality
  exportStore(): string {
    return JSON.stringify(this.store, null, 2);
  }

  importStore(data: string) {
    try {
      const imported = JSON.parse(data);
      this.store = {
        ...imported,
        createdAt: new Date(imported.createdAt),
        updatedAt: new Date(imported.updatedAt)
      };
      this.notifyListeners();
    } catch (error) {
      console.error('Error importing store:', error);
      throw new Error('Invalid store data format');
    }
  }
}

// Singleton instance
export const teamsStoreService = new TeamsStoreService();
export default teamsStoreService;