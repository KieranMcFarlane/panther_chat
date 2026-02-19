'use client';

/**
 * ScoreCard Component
 *
 * Displays hypothesis state with maturity score, activity score, and state badge.
 *
 * Part of Temporal Sports Procurement Prediction Engine MVP.
 */

import React from 'react';

export interface HypothesisStateProps {
  entity_id: string;
  category: string;
  maturity_score: number;
  activity_score: number;
  state: 'MONITOR' | 'WARM' | 'ENGAGE' | 'LIVE';
  last_updated?: string;
}

interface ScoreCardProps {
  state: HypothesisStateProps;
  className?: string;
}

const STATE_CONFIG = {
  MONITOR: {
    label: 'Monitor',
    bgColor: 'bg-gray-700',
    textColor: 'text-gray-200',
    borderColor: 'border-gray-600',
  },
  WARM: {
    label: 'Warm',
    bgColor: 'bg-yellow-900',
    textColor: 'text-yellow-200',
    borderColor: 'border-yellow-700',
  },
  ENGAGE: {
    label: 'Engage',
    bgColor: 'bg-blue-900',
    textColor: 'text-blue-200',
    borderColor: 'border-blue-700',
  },
  LIVE: {
    label: 'Live',
    bgColor: 'bg-green-900',
    textColor: 'text-green-200',
    borderColor: 'border-green-700',
  },
};

export function ScoreCard({ state, className = '' }: ScoreCardProps) {
  const config = STATE_CONFIG[state.state];
  const maturityPercent = Math.round(state.maturity_score * 100);
  const activityPercent = Math.round(state.activity_score * 100);

  // Format category for display (convert SCREAMING_CASE to Title Case)
  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
      {/* Header with Category and State Badge */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-200">
          {formatCategory(state.category)}
        </h3>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.textColor} ${config.borderColor} border`}
        >
          {config.label}
        </span>
      </div>

      {/* Maturity Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Maturity</span>
          <span className="text-xs font-medium text-slate-300">{maturityPercent}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${maturityPercent}%` }}
          />
        </div>
      </div>

      {/* Activity Score */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Activity</span>
          <span className="text-xs font-medium text-slate-300">{activityPercent}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${activityPercent}%` }}
          />
        </div>
      </div>

      {/* Last Updated (optional) */}
      {state.last_updated && (
        <div className="mt-2 text-xs text-slate-500">
          Updated: {new Date(state.last_updated).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

interface ScoreCardGridProps {
  states: HypothesisStateProps[];
  entityId: string;
  className?: string;
}

/**
 * Grid of ScoreCards for displaying multiple hypothesis states
 */
export function ScoreCardGrid({ states, entityId, className = '' }: ScoreCardGridProps) {
  if (states.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-slate-400">No hypothesis states available for {entityId}</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {states.map((state) => (
        <ScoreCard key={`${state.entity_id}-${state.category}`} state={state} />
      ))}
    </div>
  );
}

export default ScoreCard;
