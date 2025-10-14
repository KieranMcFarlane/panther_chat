/**
 * Enhanced Scoring Algorithm with Network Intelligence
 * 
 * Integrates LinkedIn Connection Analysis results into opportunity scoring
 * Provides weighted scoring based on Yellow Panther team network access
 */

interface RFPOpportunity {
  organization: string;
  base_score: number;
  estimated_value: string;
  deadline?: Date;
  requirements: string[];
  yellow_panther_fit: number;
  competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  urgency_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface ConnectionIntelligence {
  stuart_cope_connections: number;
  total_team_connections: number;
  strong_paths: number;
  medium_paths: number;
  primary_path_available: boolean;
  network_boost: number;
  success_probability: number;
  optimal_introduction_paths: Array<{
    yellow_panther_contact: string;
    connection_strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    confidence_score: number;
    timeline_to_introduction: string;
  }>;
}

interface EnhancedScoringResult {
  original_score: number;
  network_boost_breakdown: {
    stuart_cope_bonus: number;
    connection_strength_bonus: number;
    path_diversity_bonus: number;
    urgency_multiplier: number;
    strategic_value_bonus: number;
  };
  final_score: number;
  success_probability: number;
  competitive_advantage: string;
  recommended_approach: string;
  priority_ranking: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  next_step_timeline: string;
}

export class EnhancedScoringAlgorithm {
  
  /**
   * Calculate enhanced opportunity score with network intelligence
   */
  static calculateEnhancedScore(
    opportunity: RFPOpportunity,
    connectionIntelligence?: ConnectionIntelligence
  ): EnhancedScoringResult {
    
    const originalScore = opportunity.base_score;
    
    // Network boost calculation
    const networkBoost = this.calculateNetworkBoost(connectionIntelligence);
    
    // Strategic value bonus
    const strategicBonus = this.calculateStrategicValueBonus(opportunity);
    
    // Urgency multiplier
    const urgencyMultiplier = this.calculateUrgencyMultiplier(opportunity);
    
    // Competition penalty
    const competitionPenalty = this.calculateCompetitionPenalty(opportunity);
    
    // Final enhanced score
    const baseNetworkScore = originalScore + networkBoost.total;
    const strategicScore = baseNetworkScore + strategicBonus;
    const urgencyScore = strategicScore * urgencyMultiplier;
    const finalScore = Math.max(0, Math.min(100, urgencyScore - competitionPenalty));
    
    // Calculate success probability
    const successProbability = this.calculateSuccessProbability(
      finalScore,
      connectionIntelligence,
      opportunity
    );
    
    // Determine competitive advantage
    const competitiveAdvantage = this.determineCompetitiveAdvantage(
      connectionIntelligence,
      opportunity
    );
    
    // Recommended approach
    const recommendedApproach = this.generateRecommendedApproach(
      finalScore,
      connectionIntelligence,
      opportunity
    );
    
    // Priority ranking
    const priorityRanking = this.determinePriorityRanking(finalScore, successProbability);
    
    // Next step timeline
    const nextStepTimeline = this.calculateNextStepTimeline(
      connectionIntelligence,
      opportunity
    );

    return {
      original_score: originalScore,
      network_boost_breakdown: {
        stuart_cope_bonus: networkBoost.stuart_cope_bonus,
        connection_strength_bonus: networkBoost.connection_strength_bonus,
        path_diversity_bonus: networkBoost.path_diversity_bonus,
        urgency_multiplier: urgencyMultiplier - 1, // Show as additive bonus
        strategic_value_bonus: strategicBonus
      },
      final_score: Math.round(finalScore),
      success_probability: successProbability,
      competitive_advantage,
      recommended_approach,
      priority_ranking: priorityRanking,
      next_step_timeline: nextStepTimeline
    };
  }

  /**
   * Calculate network boost based on connection intelligence
   */
  private static calculateNetworkBoost(connectionIntelligence?: ConnectionIntelligence): {
    total: number;
    stuart_cope_bonus: number;
    connection_strength_bonus: number;
    path_diversity_bonus: number;
  } {
    if (!connectionIntelligence) {
      return { total: 0, stuart_cope_bonus: 0, connection_strength_bonus: 0, path_diversity_bonus: 0 };
    }

    let stuartCopeBonus = 0;
    let connectionStrengthBonus = 0;
    let pathDiversityBonus = 0;

    // Stuart Cope connections (primary connection - highest value)
    if (connectionIntelligence.stuart_cope_connections > 0) {
      stuartCopeBonus = Math.min(connectionIntelligence.stuart_cope_connections * 8, 20); // Max 20 points
    }

    // Connection strength bonus
    if (connectionIntelligence.strong_paths > 0) {
      connectionStrengthBonus = Math.min(connectionIntelligence.strong_paths * 6, 15); // Max 15 points
    }
    if (connectionIntelligence.medium_paths > 0) {
      connectionStrengthBonus += Math.min(connectionIntelligence.medium_paths * 3, 8); // Max 8 points
    }

    // Path diversity bonus (multiple Yellow Panther team members)
    if (connectionIntelligence.total_team_connections >= 3) {
      pathDiversityBonus = 8; // Multiple team member access
    } else if (connectionIntelligence.total_team_connections >= 2) {
      pathDiversityBonus = 4; // Some team diversity
    }

    const total = Math.min(stuartCopeBonus + connectionStrengthBonus + pathDiversityBonus, 35); // Cap at 35 points

    return {
      total,
      stuart_cope_bonus: stuartCopeBonus,
      connection_strength_bonus: connectionStrengthBonus,
      path_diversity_bonus: pathDiversityBonus
    };
  }

  /**
   * Calculate strategic value bonus based on opportunity characteristics
   */
  private static calculateStrategicValueBonus(opportunity: RFPOpportunity): number {
    let bonus = 0;

    // Value-based bonus
    if (opportunity.estimated_value) {
      const valueMatch = opportunity.estimated_value.match(/£(\d+)(\.\d+)?([KM])/);
      if (valueMatch) {
        const amount = parseFloat(valueMatch[1]);
        const unit = valueMatch[3];
        
        if (unit === 'M') {
          bonus += Math.min(amount * 2, 15); // Million pound projects
        } else if (unit === 'K') {
          bonus += Math.min(amount / 50, 8); // Hundred thousand pound projects
        }
      }
    }

    // Requirements-based bonus
    const highValueKeywords = [
      'digital transformation', 'mobile application', 'fan engagement',
      'data analytics', 'AI', 'machine learning', 'cloud migration'
    ];
    
    const matchingKeywords = opportunity.requirements.filter(req =>
      highValueKeywords.some(keyword => req.toLowerCase().includes(keyword))
    );
    
    bonus += Math.min(matchingKeywords.length * 3, 10);

    return Math.min(bonus, 15); // Cap at 15 points
  }

  /**
   * Calculate urgency multiplier
   */
  private static calculateUrgencyMultiplier(opportunity: RFPOpportunity): number {
    const urgencyMultipliers = {
      'CRITICAL': 1.15,    // 15% boost
      'HIGH': 1.10,        // 10% boost
      'MEDIUM': 1.05,      // 5% boost
      'LOW': 1.0           // No boost
    };

    return urgencyMultipliers[opportunity.urgency_level] || 1.0;
  }

  /**
   * Calculate competition penalty
   */
  private static calculateCompetitionPenalty(opportunity: RFPOpportunity): number {
    const competitionPenalties = {
      'VERY_HIGH': 15,  // High competition reduces score
      'HIGH': 8,
      'MEDIUM': 3,
      'LOW': 0
    };

    return competitionPenalties[opportunity.competition_level] || 0;
  }

  /**
   * Calculate success probability
   */
  private static calculateSuccessProbability(
    finalScore: number,
    connectionIntelligence?: ConnectionIntelligence,
    opportunity?: RFPOpportunity
  ): number {
    let baseProbability = finalScore * 0.6; // Base probability from score

    // Network intelligence boost
    if (connectionIntelligence) {
      baseProbability += connectionIntelligence.success_probability * 0.4;
    }

    // Competition adjustment
    if (opportunity) {
      const competitionFactors = {
        'VERY_HIGH': 0.7,
        'HIGH': 0.8,
        'MEDIUM': 0.9,
        'LOW': 1.0
      };
      baseProbability *= competitionFactors[opportunity.competition_level] || 1.0;
    }

    // Urgency adjustment
    if (opportunity && opportunity.deadline) {
      const daysUntilDeadline = Math.max(0, (opportunity.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 30) {
        baseProbability *= 1.1; // Urgent opportunities have slightly higher success rate
      } else if (daysUntilDeadline > 90) {
        baseProbability *= 0.9; // Long deadlines may reduce urgency
      }
    }

    return Math.min(Math.round(baseProbability), 95); // Cap at 95%
  }

  /**
   * Determine competitive advantage description
   */
  private static determineCompetitiveAdvantage(
    connectionIntelligence?: ConnectionIntelligence,
    opportunity?: RFPOpportunity
  ): string {
    const advantages = [];

    if (connectionIntelligence) {
      if (connectionIntelligence.stuart_cope_connections > 0) {
        advantages.push(`Stuart Cope has ${connectionIntelligence.stuart_cope_connections} direct connections`);
      }
      
      if (connectionIntelligence.strong_paths > 0) {
        advantages.push(`${connectionIntelligence.strong_paths} strong introduction paths available`);
      }
      
      if (connectionIntelligence.total_team_connections >= 3) {
        advantages.push('Multiple Yellow Panther team members have network access');
      }
      
      if (connectionIntelligence.primary_path_available) {
        advantages.push('Primary connection available for executive-level engagement');
      }
    }

    if (opportunity && opportunity.yellow_panther_fit >= 85) {
      advantages.push('Perfect service alignment with Yellow Panther expertise');
    }

    if (advantages.length === 0) {
      return 'Standard competitive positioning - proceed with professional outreach';
    }

    return advantages.join('; ');
  }

  /**
   * Generate recommended approach
   */
  private static generateRecommendedApproach(
    finalScore: number,
    connectionIntelligence?: ConnectionIntelligence,
    opportunity?: RFPOpportunity
  ): string {
    if (finalScore >= 85 && connectionIntelligence && connectionIntelligence.stuart_cope_connections > 0) {
      return 'CRITICAL PRIORITY: Activate Stuart Cope warm introduction protocol immediately';
    }

    if (finalScore >= 75 && connectionIntelligence && connectionIntelligence.strong_paths > 0) {
      return 'HIGH PRIORITY: Leverage strong network connections for warm introduction within 48 hours';
    }

    if (finalScore >= 65) {
      return 'MEDIUM PRIORITY: Professional outreach with strategic positioning and relevant case studies';
    }

    if (connectionIntelligence && connectionIntelligence.medium_paths > 0) {
      return 'NETWORK-ASSISTED: Use identified mutual connections for introduction opportunity';
    }

    return 'STANDARD APPROACH: Professional cold outreach with Yellow Panther value proposition';
  }

  /**
   * Determine priority ranking
   */
  private static determinePriorityRanking(finalScore: number, successProbability: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (finalScore >= 85 && successProbability >= 70) return 'CRITICAL';
    if (finalScore >= 75 && successProbability >= 60) return 'HIGH';
    if (finalScore >= 65 && successProbability >= 50) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate next step timeline
   */
  private static calculateNextStepTimeline(
    connectionIntelligence?: ConnectionIntelligence,
    opportunity?: RFPOpportunity
  ): string {
    if (connectionIntelligence && connectionIntelligence.stuart_cope_connections > 0) {
      return 'Immediate: Contact Stuart Cope within 24 hours';
    }

    if (connectionIntelligence && connectionIntelligence.strong_paths > 0) {
      return 'Within 48 hours: Activate warm introduction';
    }

    if (connectionIntelligence && connectionIntelligence.medium_paths > 0) {
      return 'Within 72 hours: Reach out to mutual connections';
    }

    if (opportunity && opportunity.deadline) {
      const daysUntilDeadline = Math.max(0, (opportunity.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 30) {
        return 'Within 24 hours: Urgent deadline approaching';
      }
    }

    return 'Within 1 week: Professional outreach campaign';
  }

  /**
   * Batch calculate enhanced scores for multiple opportunities
   */
  static calculateBatchEnhancedScores(
    opportunities: Array<RFPOpportunity & { connection_intelligence?: ConnectionIntelligence }>
  ): EnhancedScoringResult[] {
    return opportunities.map(opp => 
      this.calculateEnhancedScore(opp, opp.connection_intelligence)
    ).sort((a, b) => b.final_score - a.final_score);
  }

  /**
   * Generate opportunity ranking report
   */
  static generateRankingReport(results: EnhancedScoringResult[]): {
    summary: {
      total_opportunities: number;
      critical_priority: number;
      high_priority: number;
      average_score: number;
      average_success_probability: number;
    };
    top_opportunities: Array<{
      rank: number;
      score: number;
      success_probability: number;
      competitive_advantage: string;
      recommended_approach: string;
      timeline: string;
    }>;
  } {
    const summary = {
      total_opportunities: results.length,
      critical_priority: results.filter(r => r.priority_ranking === 'CRITICAL').length,
      high_priority: results.filter(r => r.priority_ranking === 'HIGH').length,
      average_score: Math.round(results.reduce((sum, r) => sum + r.final_score, 0) / results.length),
      average_success_probability: Math.round(results.reduce((sum, r) => sum + r.success_probability, 0) / results.length)
    };

    const topOpportunities = results.slice(0, 10).map((result, index) => ({
      rank: index + 1,
      score: result.final_score,
      success_probability: result.success_probability,
      competitive_advantage: result.competitive_advantage,
      recommended_approach: result.recommended_approach,
      timeline: result.next_step_timeline
    }));

    return {
      summary,
      top_opportunities: topOpportunities
    };
  }
}