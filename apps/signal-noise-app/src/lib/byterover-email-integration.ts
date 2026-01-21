/**
 * ByteRover Email Integration
 * 
 * Connects email composition with ByteRover memory system for:
 * - Contact intelligence retrieval
 * - Goal and dossier context
 * - Interaction history
 * - Personalized email suggestions
 */

interface ContactIntelligence {
  email: string;
  name?: string;
  organization?: string;
  goals?: string[];
  dossier?: string;
  interactionHistory?: Array<{
    date: string;
    type: 'email' | 'meeting' | 'call';
    summary: string;
    outcome?: string;
  }>;
  communicationStyle?: {
    preferredTone: string;
    frequency: string;
    topics: string[];
    avoidTopics: string[];
  };
  businessContext?: {
    industry: string;
    role: string;
    companySize: string;
    challenges: string[];
    opportunities: string[];
  };
  lastContact?: string;
  opportunityScore?: number;
  riskFactors?: string[];
}

interface EmailMemory {
  contactEmail: string;
  threadId: string;
  emails: Array<{
    id: string;
    subject: string;
    content: string;
    direction: 'sent' | 'received';
    timestamp: string;
    aiAnalysis?: {
      sentiment: string;
      keyTopics: string[];
      nextActions: string[];
      pipelineStage: string;
    };
  }>;
  insights: Array<{
    id: string;
    content: string;
    category: 'preference' | 'opportunity' | 'risk' | 'strategy';
    confidence: number;
    timestamp: string;
  }>;
}

class ByteRoverEmailIntegration {
  private static instance: ByteRoverEmailIntegration;

  static getInstance(): ByteRoverEmailIntegration {
    if (!ByteRoverEmailIntegration.instance) {
      ByteRoverEmailIntegration.instance = new ByteRoverEmailIntegration();
    }
    return ByteRoverEmailIntegration.instance;
  }

  /**
   * Retrieve comprehensive contact intelligence from ByteRover
   */
  async getContactIntelligence(email: string): Promise<ContactIntelligence | null> {
    try {
      // Check if ByteRover MCP function is available
      if (typeof mcp__byterover_mcp__byterover_retrieve_knowledge !== 'function') {
        console.warn('ByteRover MCP function not available, skipping contact intelligence retrieval');
        return null;
      }

      // Query ByteRover for contact knowledge
      const contactQuery = `contact intelligence email ${email} goals dossier business context communication preferences`;
      
      const knowledgeResult = await mcp__byterover_mcp__byterover_retrieve_knowledge({
        query: contactQuery,
        limit: 10
      });

      if (!knowledgeResult || knowledgeResult.length === 0) {
        console.log(`No existing intelligence found for ${email}`);
        return null;
      }

      // Parse and structure the knowledge
      const intelligence = this.parseContactKnowledge(email, knowledgeResult);
      
      console.log(`Retrieved intelligence for ${email}:`, {
        goalsCount: intelligence.goals?.length || 0,
        interactionsCount: intelligence.interactionHistory?.length || 0,
        opportunityScore: intelligence.opportunityScore
      });

      return intelligence;
    } catch (error) {
      console.error('Failed to retrieve contact intelligence:', error);
      return null;
    }
  }

  /**
   * Store email interaction and analysis in ByteRover
   */
  async storeEmailInteraction(
    email: string,
    emailData: {
      subject: string;
      content: string;
      direction: 'sent' | 'received';
      threadId?: string;
      aiAnalysis?: any;
    }
  ): Promise<void> {
    try {
      const interactionData = {
        contactEmail: email,
        interaction: {
          type: 'email' as const,
          date: new Date().toISOString(),
          subject: emailData.subject,
          content: emailData.content,
          direction: emailData.direction,
          analysis: emailData.aiAnalysis
        }
      };

      // Store as structured knowledge
      const knowledgeContent = `
Email Interaction Stored:
- Contact: ${email}
- Date: ${new Date().toISOString()}
- Subject: ${emailData.subject}
- Direction: ${emailData.direction}
- Content Preview: ${emailData.content.substring(0, 200)}...
${emailData.aiAnalysis ? `- AI Analysis: ${JSON.stringify(emailData.aiAnalysis)}` : ''}
- Thread ID: ${emailData.threadId || 'new-thread'}
      `.trim();

      // Check if ByteRover MCP function is available
      if (typeof mcp__byterover_mcp__byterover_store_knowledge === 'function') {
        await mcp__byterover_mcp__byterover_store_knowledge({
          messages: knowledgeContent,
          context: `email_interaction_${email}_${Date.now()}`
        });
      } else {
        console.warn('ByteRover MCP store function not available, skipping interaction storage');
      }

      console.log(`Stored email interaction for ${email}`);
    } catch (error) {
      console.error('Failed to store email interaction:', error);
    }
  }

  /**
   * Store contact insights and goals
   */
  async storeContactInsights(
    email: string,
    insights: {
      goals?: string[];
      businessContext?: any;
      communicationStyle?: any;
      opportunities?: string[];
      risks?: string[];
    }
  ): Promise<void> {
    try {
      const insightContent = `
Contact Intelligence Update:
- Contact: ${email}
- Date: ${new Date().toISOString()}
- Goals: ${insights.goals?.join(', ') || 'Not specified'}
- Business Context: ${JSON.stringify(insights.businessContext || {})}
- Communication Style: ${JSON.stringify(insights.communicationStyle || {})}
- Opportunities: ${insights.opportunities?.join(', ') || 'Not identified'}
- Risks: ${insights.risks?.join(', ') || 'No risks identified'}
      `.trim();

      // Check if ByteRover MCP function is available
      if (typeof mcp__byterover_mcp__byterover_store_knowledge === 'function') {
        await mcp__byterover_mcp__byterover_store_knowledge({
          messages: insightContent,
          context: `contact_intelligence_${email}_${Date.now()}`
        });
      } else {
        console.warn('ByteRover MCP store function not available, skipping insights storage');
      }

      console.log(`Stored contact insights for ${email}`);
    } catch (error) {
      console.error('Failed to store contact insights:', error);
    }
  }

  /**
   * Get personalized email suggestions based on contact intelligence
   */
  async getEmailSuggestions(email: string, emailContext: {
    currentContent?: string;
    goal?: string;
    tone?: string;
  }): Promise<{
    subjectSuggestions: string[];
    contentGuidance: string[];
    personalizationPoints: string[];
    nextActions: string[];
    riskWarnings: string[];
  }> {
    try {
      const intelligence = await this.getContactIntelligence(email);
      
      if (!intelligence) {
        return {
          subjectSuggestions: ['Introduction', 'Following up', 'Opportunity discussion'],
          contentGuidance: ['Focus on building initial relationship', 'Ask about their current challenges'],
          personalizationPoints: [],
          nextActions: ['Schedule discovery call'],
          riskWarnings: []
        };
      }

      // Generate suggestions based on intelligence
      const suggestions = {
        subjectSuggestions: this.generateSubjectSuggestions(intelligence, emailContext),
        contentGuidance: this.generateContentGuidance(intelligence, emailContext),
        personalizationPoints: this.extractPersonalizationPoints(intelligence),
        nextActions: this.suggestNextActions(intelligence),
        riskWarnings: this.identifyRisks(intelligence)
      };

      return suggestions;
    } catch (error) {
      console.error('Failed to generate email suggestions:', error);
      return {
        subjectSuggestions: ['Following up', 'Checking in'],
        contentGuidance: ['Professional tone recommended'],
        personalizationPoints: [],
        nextActions: ['Follow up in a few days'],
        riskWarnings: []
      };
    }
  }

  /**
   * Parse ByteRover knowledge into structured contact intelligence
   */
  private parseContactKnowledge(email: string, knowledgeResults: any[]): ContactIntelligence {
    const intelligence: ContactIntelligence = {
      email,
      interactionHistory: [],
      communicationStyle: {
        preferredTone: 'professional',
        frequency: 'weekly',
        topics: [],
        avoidTopics: []
      },
      businessContext: {
        industry: '',
        role: '',
        companySize: '',
        challenges: [],
        opportunities: []
      }
    };

    knowledgeResults.forEach(result => {
      const content = result.content || result;
      
      // Extract goals
      if (content.includes('goals:') || content.includes('Goals:')) {
        const goalsMatch = content.match(/(?:goals|Goals):\s*([^\n]+)/i);
        if (goalsMatch) {
          intelligence.goals = goalsMatch[1].split(',').map(g => g.trim()).filter(g => g);
        }
      }

      // Extract organization/company
      if (content.includes('organization:') || content.includes('company:')) {
        const orgMatch = content.match(/(?:organization|company):\s*([^\n]+)/i);
        if (orgMatch) {
          intelligence.organization = orgMatch[1].trim();
        }
      }

      // Extract interaction history
      if (content.includes('interaction:') || content.includes('contact:')) {
        const interactionMatch = content.match(/(?:interaction|contact):\s*([^\n]+)/i);
        if (interactionMatch) {
          intelligence.interactionHistory?.push({
            date: new Date().toISOString(),
            type: 'email',
            summary: interactionMatch[1].trim()
          });
        }
      }

      // Extract communication preferences
      if (content.includes('tone:') || content.includes('style:')) {
        const toneMatch = content.match(/(?:tone|style):\s*([^\n]+)/i);
        if (toneMatch && intelligence.communicationStyle) {
          intelligence.communicationStyle.preferredTone = toneMatch[1].trim();
        }
      }

      // Extract business context
      if (content.includes('industry:') || content.includes('role:')) {
        const industryMatch = content.match(/industry:\s*([^\n]+)/i);
        const roleMatch = content.match(/role:\s*([^\n]+)/i);
        
        if (industryMatch && intelligence.businessContext) {
          intelligence.businessContext.industry = industryMatch[1].trim();
        }
        if (roleMatch && intelligence.businessContext) {
          intelligence.businessContext.role = roleMatch[1].trim();
        }
      }

      // Extract opportunity score if available
      if (content.includes('score:') || content.includes('opportunity:')) {
        const scoreMatch = content.match(/(?:score|opportunity):\s*(\d+)/i);
        if (scoreMatch) {
          intelligence.opportunityScore = parseInt(scoreMatch[1]);
        }
      }
    });

    return intelligence;
  }

  private generateSubjectSuggestions(intelligence: ContactIntelligence, context: any): string[] {
    const suggestions = [];
    
    if (intelligence.goals && intelligence.goals.length > 0) {
      suggestions.push(`Re: ${intelligence.goals[0]}`);
    }
    
    if (intelligence.organization) {
      suggestions.push(`Opportunity for ${intelligence.organization}`);
    }
    
    suggestions.push('Following up on our conversation', 'Introduction and opportunity discussion');
    
    return suggestions;
  }

  private generateContentGuidance(intelligence: ContactIntelligence, context: any): string[] {
    const guidance = [];
    
    if (intelligence.communicationStyle?.preferredTone) {
      guidance.push(`Use ${intelligence.communicationStyle.preferredTone} tone`);
    }
    
    if (intelligence.goals && intelligence.goals.length > 0) {
      guidance.push(`Address their goal: ${intelligence.goals[0]}`);
    }
    
    if (intelligence.businessContext?.challenges.length > 0) {
      guidance.push(`Acknowledge their challenges: ${intelligence.businessContext.challenges[0]}`);
    }
    
    return guidance;
  }

  private extractPersonalizationPoints(intelligence: ContactIntelligence): string[] {
    const points = [];
    
    if (intelligence.organization) {
      points.push(`They work at ${intelligence.organization}`);
    }
    
    if (intelligence.businessContext?.role) {
      points.push(`Their role is ${intelligence.businessContext.role}`);
    }
    
    if (intelligence.lastContact) {
      points.push(`Last contact: ${intelligence.lastContact}`);
    }
    
    return points;
  }

  private suggestNextActions(intelligence: ContactIntelligence): string[] {
    const actions = ['Schedule discovery call'];
    
    if (intelligence.opportunityScore && intelligence.opportunityScore > 70) {
      actions.push('Prepare proposal');
    }
    
    if (intelligence.businessContext?.challenges.length > 0) {
      actions.push('Address specific challenges');
    }
    
    return actions;
  }

  private identifyRisks(intelligence: ContactIntelligence): string[] {
    const risks = [];
    
    if (!intelligence.interactionHistory || intelligence.interactionHistory.length === 0) {
      risks.push('No previous interaction history');
    }
    
    if (intelligence.lastContact) {
      const lastContactDate = new Date(intelligence.lastContact);
      const daysSinceContact = Math.floor((Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceContact > 30) {
        risks.push(`Cold lead - ${daysSinceContact} days since last contact`);
      }
    }
    
    return risks;
  }
}

export const byteRoverEmailIntegration = ByteRoverEmailIntegration.getInstance();
export type { ContactIntelligence, EmailMemory };