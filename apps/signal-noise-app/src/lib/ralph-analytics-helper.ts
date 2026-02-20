/**
 * Ralph Analytics Helper
 *
 * Provides aggregation functions for runtime binding analytics.
 * Loads entity JSON files from data/runtime_bindings/ and calculates metrics.
 */

import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CategoryStats {
  category: string;
  total_iterations: number;
  accept_count: number;
  weak_accept_count: number;
  reject_count: number;
  no_progress_count: number;
  saturated_count: number;
  last_decision: string;
  last_iteration?: number;
  saturation_score: number;
}

export interface RalphState {
  entity_id: string;
  entity_name: string;
  current_confidence: number;
  iterations_completed: number;
  category_stats: Record<string, CategoryStats>;
  active_hypotheses: Array<{
    hypothesis_id: string;
    entity_id: string;
    category: string;
    statement: string;
    confidence: number;
    created_at: string;
    reinforced_count: number;
    weakened_count: number;
  }>;
  confidence_history: number[];
  seen_evidences: string[];
  category_saturated: boolean;
  confidence_saturated: boolean;
  global_saturated: boolean;
  is_actionable: boolean;
  confidence_ceiling?: number;
}

export interface BootstrapIteration {
  iteration: number;
  entity: string;
  category: string;
  source: string;
  evidence_found: string;
  ralph_decision: "ACCEPT" | "WEAK_ACCEPT" | "REJECT" | "NO_PROGRESS" | "SATURATED";
  raw_delta: number;
  category_multiplier: number;
  applied_delta: number;
  confidence_before: number;
  confidence_after: number;
  cumulative_cost?: number;
  justification?: string;
  timestamp: string;
  entity_name?: string;
  novelty_multiplier?: number;
  hypothesis_alignment?: number;
  ceiling_damping?: number;
}

export interface RuntimeBinding {
  entity_id: string;
  entity_name: string;
  template_id: string;
  discovered_at: string;
  domains: string[];
  channels: {
    jobs: string;
    careers: string;
    news: string;
    press: string;
  };
  patterns: Record<string, {
    patterns_found: string[];
    confidence: number;
    iterations_used: number;
    source: string;
  }>;
  performance_metrics: {
    total_iterations: number;
    categories_discovered: number;
    overall_confidence: number;
    total_cost_usd: number;
    binding_type: string;
    final_confidence: number;
    last_bootstrapped_at: string;
    is_actionable: boolean;
    confidence_ceiling: number;
    categories_saturated: string[];
    cost_savings_percent: number;
  };
  next_refresh: number;
  metadata: {
    bootstrap_iterations: BootstrapIteration[];
  };
  ralph_state: RalphState;
}

export interface BandInfo {
  band: "EXPLORATORY" | "INFORMED" | "CONFIDENT" | "ACTIONABLE";
  count: number;
  percentage: number;
  price: number;
  revenue: number;
  color: string;
  entity_samples: string[];
}

export interface ClusterHealth {
  cluster_id: string;
  cluster_name: string;
  total_entities: number;
  saturation_rate: number;
  avg_confidence: number;
  actionable_count: number;
  health_status: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION";
  exhausted_hypotheses: number;
}

export interface CategoryPerformance {
  category: string;
  total_iterations: number;
  accept_count: number;
  weak_accept_count: number;
  reject_count: number;
  no_progress_count: number;
  saturated_count: number;
  accept_rate: number;
  roi_level: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
  recommendation: string;
  rank: number;
}

export interface FunnelStage {
  stage: "EXPLORATORY" | "INFORMED" | "CONFIDENT" | "ACTIONABLE";
  count: number;
  percentage: number;
  conversion_rate: number;
  drop_off: number;
  bottleneck: boolean;
}

export interface LifecycleFunnel {
  total_entities: number;
  stages: FunnelStage[];
  insights: string[];
}

export interface EvidenceImpact {
  source: string;
  source_type: "linkedin" | "official_site" | "job_board" | "press" | "other";
  total_impact: number;
  avg_impact: number;
  count: number;
  accept_count: number;
  weak_accept_count: number;
  effectiveness: "VERY_EFFECTIVE" | "EFFECTIVE" | "MODERATE" | "LOW";
  rank: number;
}

// ============================================================================
// Configuration
// ============================================================================

const BANDS = {
  EXPLORATORY: { min: 0, max: 0.30, price: 0, color: "#6b7280" },
  INFORMED: { min: 0.30, max: 0.60, price: 500, color: "#3b82f6" },
  CONFIDENT: { min: 0.60, max: 0.80, price: 2000, color: "#22c55e" },
  ACTIONABLE: { min: 0.80, max: 1.0, price: 5000, color: "#facc15" }
};

const CATEGORIES = [
  "Digital Infrastructure & Stack",
  "Commercial & Revenue Systems",
  "Fan Engagement & Experience",
  "Data, Analytics & AI",
  "Operations & Internal Transformation",
  "Media, Content & Broadcasting",
  "Partnerships, Vendors & Ecosystem",
  "Governance, Compliance & Security"
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get confidence band from confidence score
 */
export function getBandFromConfidence(
  confidence: number,
  isActionable: boolean
): "EXPLORATORY" | "INFORMED" | "CONFIDENT" | "ACTIONABLE" {
  if (isActionable && confidence >= 0.80) {
    return "ACTIONABLE";
  }
  if (confidence >= 0.80) {
    return "CONFIDENT";
  }
  if (confidence >= 0.60) {
    return "CONFIDENT";
  }
  if (confidence >= 0.30) {
    return "INFORMED";
  }
  return "EXPLORATORY";
}

/**
 * Categorize evidence source by domain
 */
export function categorizeSource(source: string): "linkedin" | "official_site" | "job_board" | "press" | "other" {
  const lowerSource = source.toLowerCase();

  if (lowerSource.includes("linkedin.com")) {
    return "linkedin";
  }
  if (lowerSource.includes("job") || lowerSource.includes("career") || lowerSource.includes("greenhouse")) {
    return "job_board";
  }
  if (lowerSource.includes("press") || lowerSource.includes("news")) {
    return "press";
  }
  if (lowerSource.includes("http") && !lowerSource.includes("linkedin")) {
    return "official_site";
  }
  return "other";
}

/**
 * Calculate ROI level from accept rate
 */
function getROILevel(acceptRate: number): "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" {
  if (acceptRate > 0.15) return "VERY_HIGH";
  if (acceptRate >= 0.10) return "HIGH";
  if (acceptRate >= 0.05) return "MEDIUM";
  return "LOW";
}

/**
 * Calculate effectiveness from average impact
 */
function getEffectiveness(avgImpact: number): "VERY_EFFECTIVE" | "EFFECTIVE" | "MODERATE" | "LOW" {
  if (avgImpact > 0.05) return "VERY_EFFECTIVE";
  if (avgImpact >= 0.03) return "EFFECTIVE";
  if (avgImpact >= 0.01) return "MODERATE";
  return "LOW";
}

/**
 * Calculate health status from saturation rate
 */
function getHealthStatus(saturationRate: number): "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION" {
  if (saturationRate > 0.70) return "EXCELLENT";
  if (saturationRate >= 0.50) return "GOOD";
  if (saturationRate >= 0.30) return "FAIR";
  return "NEEDS_ATTENTION";
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load all Ralph states from runtime bindings directory
 */
export async function loadAllRalphStates(): Promise<RalphState[]> {
  const bindingsDir = path.join(process.cwd(), 'data', 'runtime_bindings');

  try {
    const files = await fs.readdir(bindingsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const states: RalphState[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(bindingsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const binding: RuntimeBinding = JSON.parse(content);

        if (binding.ralph_state) {
          states.push(binding.ralph_state);
        }
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
        // Continue loading other files
      }
    }

    return states;
  } catch (error) {
    console.error('Error loading runtime bindings:', error);
    throw error;
  }
}

/**
 * Load entity-cluster mapping
 */
export async function loadEntityClusterMapping(): Promise<Record<string, string>> {
  const mappingPath = path.join(process.cwd(), 'data', 'entity_cluster_mapping.json');

  try {
    const content = await fs.readFile(mappingPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading entity cluster mapping:', error);
    return {};
  }
}

/**
 * Load production clusters
 */
export async function loadProductionClusters(): Promise<Record<string, string>> {
  const clustersPath = path.join(process.cwd(), 'data', 'production_clusters.json');

  try {
    const content = await fs.readFile(clustersPath, 'utf-8');
    const clusters = JSON.parse(content);

    // Map cluster_id to cluster_name
    const clusterMap: Record<string, string> = {};
    for (const cluster of clusters) {
      clusterMap[cluster.cluster_id] = cluster.cluster_name;
    }

    return clusterMap;
  } catch (error) {
    console.error('Error loading production clusters:', error);
    return {};
  }
}

/**
 * Get band distribution across all entities
 */
export function getBandDistribution(states: RalphState[]): Record<string, BandInfo> {
  const distribution: Record<string, BandInfo> = {
    EXPLORATORY: {
      band: "EXPLORATORY",
      count: 0,
      percentage: 0,
      price: BANDS.EXPLORATORY.price,
      revenue: 0,
      color: BANDS.EXPLORATORY.color,
      entity_samples: []
    },
    INFORMED: {
      band: "INFORMED",
      count: 0,
      percentage: 0,
      price: BANDS.INFORMED.price,
      revenue: 0,
      color: BANDS.INFORMED.color,
      entity_samples: []
    },
    CONFIDENT: {
      band: "CONFIDENT",
      count: 0,
      percentage: 0,
      price: BANDS.CONFIDENT.price,
      revenue: 0,
      color: BANDS.CONFIDENT.color,
      entity_samples: []
    },
    ACTIONABLE: {
      band: "ACTIONABLE",
      count: 0,
      percentage: 0,
      price: BANDS.ACTIONABLE.price,
      revenue: 0,
      color: BANDS.ACTIONABLE.color,
      entity_samples: []
    }
  };

  const total = states.length;

  for (const state of states) {
    const band = getBandFromConfidence(state.current_confidence, state.is_actionable);
    distribution[band].count++;

    // Add entity samples (up to 5 per band)
    if (distribution[band].entity_samples.length < 5) {
      distribution[band].entity_samples.push(state.entity_name);
    }
  }

  // Calculate percentages and revenue
  for (const band of Object.keys(distribution)) {
    distribution[band].percentage = (distribution[band].count / total) * 100;
    distribution[band].revenue = distribution[band].count * distribution[band].price;
  }

  return distribution;
}

/**
 * Get cluster health metrics
 */
export function getClusterHealth(
  states: RalphState[],
  clusterMapping: Record<string, string>,
  clusterNames: Record<string, string>
): ClusterHealth[] {
  // Group entities by cluster
  const clusterGroups: Record<string, RalphState[]> = {};

  for (const state of states) {
    const clusterId = clusterMapping[state.entity_id] || "unclustered";
    if (!clusterGroups[clusterId]) {
      clusterGroups[clusterId] = [];
    }
    clusterGroups[clusterId].push(state);
  }

  // Calculate health metrics for each cluster
  const health: ClusterHealth[] = [];

  for (const [clusterId, clusterStates] of Object.entries(clusterGroups)) {
    const totalEntities = clusterStates.length;

    // Calculate average confidence
    const avgConfidence = clusterStates.reduce((sum, s) => sum + s.current_confidence, 0) / totalEntities;

    // Calculate saturation rate (saturated categories / total possible)
    let totalSaturated = 0;
    let totalPossible = 0;
    let exhaustedHypotheses = 0;

    for (const state of clusterStates) {
      for (const [category, stats] of Object.entries(state.category_stats)) {
        totalPossible++;
        if (stats.last_decision === "SATURATED" || stats.saturation_score >= 1.0) {
          totalSaturated++;
        }
      }

      // Count exhausted hypotheses (all categories saturated)
      if (state.global_saturated) {
        exhaustedHypotheses++;
      }
    }

    const saturationRate = totalPossible > 0 ? totalSaturated / totalPossible : 0;

    // Count actionable entities
    const actionableCount = clusterStates.filter(s => s.is_actionable).length;

    health.push({
      cluster_id: clusterId,
      cluster_name: clusterNames[clusterId] || clusterId,
      total_entities: totalEntities,
      saturation_rate: saturationRate,
      avg_confidence: avgConfidence,
      actionable_count: actionableCount,
      health_status: getHealthStatus(saturationRate),
      exhausted_hypotheses: exhaustedHypotheses
    });
  }

  // Sort by total entities (descending)
  return health.sort((a, b) => b.total_entities - a.total_entities);
}

/**
 * Get category performance metrics
 */
export function getCategoryPerformance(states: RalphState[]): CategoryPerformance[] {
  const categoryStats: Record<string, {
    total_iterations: number;
    accept_count: number;
    weak_accept_count: number;
    reject_count: number;
    no_progress_count: number;
    saturated_count: number;
  }> = {};

  // Initialize categories
  for (const category of CATEGORIES) {
    categoryStats[category] = {
      total_iterations: 0,
      accept_count: 0,
      weak_accept_count: 0,
      reject_count: 0,
      no_progress_count: 0,
      saturated_count: 0
    };
  }

  // Aggregate stats across all entities
  for (const state of states) {
    for (const [category, stats] of Object.entries(state.category_stats)) {
      if (!categoryStats[category]) {
        categoryStats[category] = {
          total_iterations: 0,
          accept_count: 0,
          weak_accept_count: 0,
          reject_count: 0,
          no_progress_count: 0,
          saturated_count: 0
        };
      }

      categoryStats[category].total_iterations += stats.total_iterations;
      categoryStats[category].accept_count += stats.accept_count;
      categoryStats[category].weak_accept_count += stats.weak_accept_count;
      categoryStats[category].reject_count += stats.reject_count;
      categoryStats[category].no_progress_count += stats.no_progress_count;
      categoryStats[category].saturated_count += stats.saturated_count;
    }
  }

  // Calculate performance metrics
  const performance: CategoryPerformance[] = [];

  for (const [category, stats] of Object.entries(categoryStats)) {
    const acceptRate = stats.total_iterations > 0
      ? (stats.accept_count + stats.weak_accept_count) / stats.total_iterations
      : 0;

    const roiLevel = getROILevel(acceptRate);

    let recommendation = "";
    if (roiLevel === "VERY_HIGH") {
      recommendation = "Excellent performance - prioritize outreach for entities in this category";
    } else if (roiLevel === "HIGH") {
      recommendation = "Strong performance - continue monitoring and engaging";
    } else if (roiLevel === "MEDIUM") {
      recommendation = "Moderate performance - consider adjusting evidence sources";
    } else {
      recommendation = "Low performance - review category strategy and evidence quality";
    }

    performance.push({
      category,
      total_iterations: stats.total_iterations,
      accept_count: stats.accept_count,
      weak_accept_count: stats.weak_accept_count,
      reject_count: stats.reject_count,
      no_progress_count: stats.no_progress_count,
      saturated_count: stats.saturated_count,
      accept_rate: acceptRate,
      roi_level: roiLevel,
      recommendation,
      rank: 0 // Will be set after sorting
    });
  }

  // Sort by accept rate (descending) and assign ranks
  performance.sort((a, b) => b.accept_rate - a.accept_rate);
  performance.forEach((p, idx) => p.rank = idx + 1);

  return performance;
}

/**
 * Get lifecycle funnel metrics
 */
export function getLifecycleFunnel(states: RalphState[]): LifecycleFunnel {
  const totalEntities = states.length;

  // Count entities in each band
  const stageCounts: Record<string, number> = {
    EXPLORATORY: 0,
    INFORMED: 0,
    CONFIDENT: 0,
    ACTIONABLE: 0
  };

  for (const state of states) {
    const band = getBandFromConfidence(state.current_confidence, state.is_actionable);
    stageCounts[band]++;
  }

  // Build funnel stages
  const stages: FunnelStage[] = [];
  const stageOrder = ["EXPLORATORY", "INFORMED", "CONFIDENT", "ACTIONABLE"];
  let previousCount = totalEntities;

  for (const stage of stageOrder) {
    const count = stageCounts[stage];
    const percentage = (count / totalEntities) * 100;
    const conversionRate = previousCount > 0 ? (count / previousCount) : 0;
    const dropOff = previousCount - count;
    const bottleneck = conversionRate < 0.30 && previousCount > 0;

    stages.push({
      stage: stage as any,
      count,
      percentage,
      conversion_rate: conversionRate,
      drop_off: dropOff,
      bottleneck
    });

    previousCount = count;
  }

  // Generate insights
  const insights: string[] = [];
  const actionableStage = stages.find(s => s.stage === "ACTIONABLE");

  if (actionableStage && actionableStage.count > 0) {
    insights.push(`${actionableStage.count} entities (${actionableStage.percentage.toFixed(1)}%) are actionable and ready for immediate outreach`);
  }

  const bottlenecks = stages.filter(s => s.bottleneck);
  if (bottlenecks.length > 0) {
    insights.push(`Bottlenecks detected at: ${bottlenecks.map(b => b.stage).join(", ")}`);
  }

  const informedStage = stages.find(s => s.stage === "INFORMED");
  if (informedStage && informedStage.count > 0) {
    insights.push(`${informedStage.count} entities in INFORMED band - consider targeted campaigns to move them to CONFIDENT`);
  }

  return {
    total_entities: totalEntities,
    stages,
    insights
  };
}

/**
 * Get evidence impact metrics
 */
export function getEvidenceImpact(
  states: RalphState[],
  bootstrapIterations: Record<string, BootstrapIteration[]>
): EvidenceImpact[] {
  const impactBySource: Record<string, {
    total_impact: number;
    count: number;
    accept_count: number;
    weak_accept_count: number;
  }> = {};

  // Aggregate impact by source
  for (const state of states) {
    const iterations = bootstrapIterations[state.entity_id] || [];

    for (const iter of iterations) {
      const source = iter.source;

      if (!impactBySource[source]) {
        impactBySource[source] = {
          total_impact: 0,
          count: 0,
          accept_count: 0,
          weak_accept_count: 0
        };
      }

      impactBySource[source].total_impact += Math.abs(iter.applied_delta);
      impactBySource[source].count++;

      if (iter.ralph_decision === "ACCEPT") {
        impactBySource[source].accept_count++;
      } else if (iter.ralph_decision === "WEAK_ACCEPT") {
        impactBySource[source].weak_accept_count++;
      }
    }
  }

  // Calculate metrics and categorize sources
  const impact: EvidenceImpact[] = [];

  for (const [source, stats] of Object.entries(impactBySource)) {
    const avgImpact = stats.count > 0 ? stats.total_impact / stats.count : 0;
    const effectiveness = getEffectiveness(avgImpact);
    const sourceType = categorizeSource(source);

    impact.push({
      source,
      source_type: sourceType,
      total_impact: stats.total_impact,
      avg_impact: avgImpact,
      count: stats.count,
      accept_count: stats.accept_count,
      weak_accept_count: stats.weak_accept_count,
      effectiveness,
      rank: 0 // Will be set after sorting
    });
  }

  // Sort by total impact (descending) and assign ranks
  impact.sort((a, b) => b.total_impact - a.total_impact);
  impact.forEach((i, idx) => i.rank = idx + 1);

  return impact;
}

/**
 * Extract bootstrap iterations from runtime bindings
 */
export async function loadBootstrapIterations(
  states: RalphState[]
): Promise<Record<string, BootstrapIteration[]>> {
  const bindingsDir = path.join(process.cwd(), 'data', 'runtime_bindings');
  const iterations: Record<string, BootstrapIteration[]> = {};

  for (const state of states) {
    try {
      const filePath = path.join(bindingsDir, `${state.entity_id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const binding: RuntimeBinding = JSON.parse(content);

      if (binding.metadata?.bootstrap_iterations) {
        iterations[state.entity_id] = binding.metadata.bootstrap_iterations;
      }
    } catch (error) {
      console.error(`Error loading iterations for ${state.entity_id}:`, error);
      iterations[state.entity_id] = [];
    }
  }

  return iterations;
}
