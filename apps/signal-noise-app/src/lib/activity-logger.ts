/**
 * 📝 Activity Logger Service
 * 
 * Persistent logging system for RFP opportunity actions and findings
 */

interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  opportunityId: string;
  opportunityTitle: string;
  organization: string;
  userId?: string;
  userName?: string;
  details: any;
  status: 'completed' | 'pending' | 'failed';
  category: 'view' | 'analysis' | 'communication' | 'status_change' | 'follow_up' | 'team_assignment';
  impact: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

interface ActivitySummary {
  total: number;
  byCategory: Record<string, number>;
  byImpact: Record<string, number>;
  recent: ActivityLog[];
  topOrganizations: Array<{
    organization: string;
    count: number;
    lastAction: string;
  }>;
}

export class ActivityLogger {
  private static instance: ActivityLogger;
  private logs: ActivityLog[] = [];

  static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  /**
   * Log an activity action
   */
  async logActivity(action: string, data: {
    opportunityId: string;
    opportunityTitle: string;
    organization: string;
    userId?: string;
    userName?: string;
    details?: any;
    category?: ActivityLog['category'];
    impact?: ActivityLog['impact'];
    status?: ActivityLog['status'];
    metadata?: Record<string, any>;
  }): Promise<ActivityLog> {
    const log: ActivityLog = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      action,
      opportunityId: data.opportunityId,
      opportunityTitle: data.opportunityTitle,
      organization: data.organization,
      userId: data.userId || 'system',
      userName: data.userName || 'System User',
      details: data.details || {},
      status: data.status || 'completed',
      category: data.category || this.categorizeAction(action),
      impact: data.impact || 'medium',
      metadata: data.metadata
    };

    // Add to in-memory logs
    this.logs.unshift(log);

    // Persist to localStorage
    this.persistToStorage();

    // Send to API if available
    try {
      await this.sendToAPI(log);
    } catch (error) {
      console.warn('Failed to send activity to API:', error);
    }

    return log;
  }

  /**
   * Get activity logs with filtering
   */
  getActivities(filters: {
    limit?: number;
    category?: string;
    organization?: string;
    opportunityId?: string;
    dateFrom?: string;
    dateTo?: string;
    impact?: string;
  } = {}): ActivityLog[] {
    let filtered = [...this.logs];

    if (filters.category) {
      filtered = filtered.filter(log => log.category === filters.category);
    }

    if (filters.organization) {
      filtered = filtered.filter(log => 
        log.organization.toLowerCase().includes(filters.organization!.toLowerCase())
      );
    }

    if (filters.opportunityId) {
      filtered = filtered.filter(log => log.opportunityId === filters.opportunityId);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(log => new Date(log.timestamp) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      filtered = filtered.filter(log => new Date(log.timestamp) <= toDate);
    }

    if (filters.impact) {
      filtered = filtered.filter(log => log.impact === filters.impact);
    }

    return filtered.slice(0, filters.limit || 100);
  }

  /**
   * Get activity summary statistics
   */
  getActivitySummary(days: number = 7): ActivitySummary {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentLogs = this.logs.filter(log => new Date(log.timestamp) >= cutoffDate);

    const byCategory = recentLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byImpact = recentLogs.reduce((acc, log) => {
      acc[log.impact] = (acc[log.impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const orgCounts = recentLogs.reduce((acc, log) => {
      acc[log.organization] = (acc[log.organization] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topOrganizations = Object.entries(orgCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([organization, count]) => {
        const lastAction = recentLogs
          .filter(log => log.organization === organization)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        return {
          organization,
          count,
          lastAction: lastAction?.action || 'Unknown'
        };
      });

    return {
      total: recentLogs.length,
      byCategory,
      byImpact,
      recent: recentLogs.slice(0, 10),
      topOrganizations
    };
  }

  /**
   * Get activities for a specific opportunity
   */
  getOpportunityActivities(opportunityId: string): ActivityLog[] {
    return this.logs
      .filter(log => log.opportunityId === opportunityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Update user action status for opportunity
   */
  updateOpportunityStatus(opportunityId: string, status: string, details: any = {}): void {
    this.logActivity('status_update', {
      opportunityId,
      opportunityTitle: 'Status Update',
      organization: 'Unknown',
      details: { newStatus: status, ...details },
      category: 'status_change',
      impact: 'medium'
    });
  }

  /**
   * Export activities to CSV
   */
  exportToCSV(filters: any = {}): string {
    const activities = this.getActivities(filters);
    
    const headers = [
      'Timestamp', 'Action', 'Opportunity', 'Organization', 
      'User', 'Category', 'Impact', 'Status', 'Details'
    ];
    
    const rows = activities.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.action,
      log.opportunityTitle,
      log.organization,
      log.userName,
      log.category,
      log.impact,
      log.status,
      JSON.stringify(log.details)
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  /**
   * Clear old activities
   */
  clearOldActivities(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    this.logs = this.logs.filter(log => new Date(log.timestamp) >= cutoffDate);
    this.persistToStorage();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Categorize action based on action type
   */
  private categorizeAction(action: string): ActivityLog['category'] {
    const categoryMap: Record<string, ActivityLog['category']> = {
      'view_details': 'view',
      'mark_interested': 'status_change',
      'schedule_followup': 'follow_up',
      'assign_team': 'team_assignment',
      'analyze_competitors': 'analysis',
      'estimate_value': 'analysis',
      'add_notes': 'communication',
      'share_team': 'communication',
      'archive': 'status_change'
    };
    
    return categoryMap[action] || 'view';
  }

  /**
   * Persist logs to localStorage
   */
  private persistToStorage(): void {
    try {
      const dataToStore = this.logs.slice(0, 1000); // Limit storage
      localStorage.setItem('rfp_activity_logs', JSON.stringify(dataToStore));
    } catch (error) {
      console.warn('Failed to persist activity logs:', error);
    }
  }

  /**
   * Load logs from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('rfp_activity_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load activity logs:', error);
    }
  }

  /**
   * Send activity to API for persistent storage
   */
  private async sendToAPI(log: ActivityLog): Promise<void> {
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      // API not available, will just use localStorage
      throw error;
    }
  }

  /**
   * Initialize the logger
   */
  static initialize(): ActivityLogger {
    const logger = ActivityLogger.getInstance();
    logger.loadFromStorage();
    return logger;
  }
}

// Export singleton instance
export const activityLogger = ActivityLogger.initialize();