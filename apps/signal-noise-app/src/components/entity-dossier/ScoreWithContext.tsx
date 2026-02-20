"use client";

import { Info, TrendingUp, BarChart, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// Type Definitions
// =============================================================================

export interface ScoreWithContextProps {
  score: number;
  meaning: string;
  why: string;
  benchmark?: string;
  action: string;
  label: string;
  icon?: React.ReactNode;
}

export interface ScoreData {
  score: number;
  meaning: string;
  why: string;
  benchmark?: string;
  action: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getScoreLevel(score: number): { level: string; color: string } {
  if (score >= 80) {
    return { level: "Excellent", color: "text-green-600" };
  } else if (score >= 60) {
    return { level: "Good", color: "text-blue-600" };
  } else if (score >= 40) {
    return { level: "Moderate", color: "text-yellow-600" };
  } else {
    return { level: "Low", color: "text-red-600" };
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function ScoreWithContext({
  score,
  meaning,
  why,
  benchmark,
  action,
  label,
  icon
}: ScoreWithContextProps) {
  const scoreInfo = getScoreLevel(score);

  return (
    <div className="score-with-context space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Score Header */}
      <div className="score-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon || <Zap className="h-5 w-5 text-primary" />}
          <span className="score-label font-semibold text-gray-900 dark:text-white">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="score-value text-2xl font-bold text-gray-900 dark:text-white">{score}</span>
          <span className="text-sm text-gray-500">/100</span>
          <Badge variant="outline" className={scoreInfo.color}>
            {scoreInfo.level}
          </Badge>
        </div>
      </div>

      {/* Score Context */}
      <div className="score-context space-y-3">
        {/* What This Means */}
        <div className="context-item flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="text-sm font-semibold text-blue-900 dark:text-blue-100">What This Means:</strong>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{meaning}</p>
          </div>
        </div>

        {/* Why This Score */}
        <div className="context-item flex gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
          <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="text-sm font-semibold text-green-900 dark:text-green-100">Why This Score:</strong>
            <p className="text-sm text-green-800 dark:text-green-200 mt-1">{why}</p>
          </div>
        </div>

        {/* Benchmark (optional) */}
        {benchmark && (
          <div className="context-item flex gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
            <BarChart className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="text-sm font-semibold text-purple-900 dark:text-purple-100">Benchmark:</strong>
              <p className="text-sm text-purple-800 dark:text-purple-200 mt-1">{benchmark}</p>
            </div>
          </div>
        )}

        {/* Recommended Action */}
        <div className="context-item flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border-2 border-amber-200 dark:border-amber-800">
          <Zap className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="text-sm font-semibold text-amber-900 dark:text-amber-100">Recommended Action:</strong>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{action}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Compact Variant (for smaller displays)
// =============================================================================

interface ScoreWithContextCompactProps {
  score: number;
  meaning: string;
  label: string;
}

export function ScoreWithContextCompact({
  score,
  meaning,
  label
}: ScoreWithContextCompactProps) {
  const scoreInfo = getScoreLevel(score);

  return (
    <div className="score-with-context-compact flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}:</span>
      <span className="font-bold text-gray-900 dark:text-white">{score}/100</span>
      <Badge variant="outline" className={cn("text-xs", scoreInfo.color)}>
        {scoreInfo.level}
      </Badge>
      <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{meaning}</span>
    </div>
  );
}

// =============================================================================
// Usage Example
// =============================================================================

export function ScoreExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Score Display Examples</h2>

      {/* Full Score */}
      <ScoreWithContext
        label="Digital Maturity"
        score={72}
        meaning="This entity has advanced digital capabilities with integrated systems"
        why="Recent CRM platform announcement, active social media, job postings for data analysts"
        benchmark="Above industry average (most clubs: 55-65)"
        action="Position Yellow Panther as strategic partner for next-phase optimization, not foundational implementation"
      />

      {/* Compact Score */}
      <div className="mt-6">
        <ScoreWithContextCompact
          label="Procurement Readiness"
          score={45}
          meaning="Moderate procurement signals detected"
        />
      </div>
    </div>
  );
}
