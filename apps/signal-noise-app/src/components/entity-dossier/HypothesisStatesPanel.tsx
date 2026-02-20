'use client';

/**
 * HypothesisStatesPanel Component
 *
 * Displays all hypothesis states for an entity with loading/error states
 * and refresh functionality.
 *
 * Part of Temporal Sports Procurement Prediction Engine MVP.
 */

import React from 'react';
import { ScoreCardGrid } from './ScoreCard';
import { useHypothesisStates, formatHypothesisStates, recalculateHypothesisStates } from '@/hooks/useHypothesisStates';

interface HypothesisStatesPanelProps {
  entityId: string;
  className?: string;
}

export function HypothesisStatesPanel({ entityId, className = '' }: HypothesisStatesPanelProps) {
  const { data, error, isLoading, mutate } = useHypothesisStates(entityId);

  const handleRefresh = async () => {
    try {
      await recalculateHypothesisStates(entityId);
      mutate(); // Refresh the data
    } catch (err) {
      console.error('Failed to recalculate:', err);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-slate-800 border border-slate-700 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-300">Loading hypothesis states...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-slate-800 border border-red-700 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">Failed to load hypothesis states</p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const states = data ? formatHypothesisStates(data) : [];

  if (states.length === 0) {
    return (
      <div className={`bg-slate-800 border border-slate-700 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-slate-400 mb-2">No hypothesis states available</p>
          <p className="text-slate-500 text-sm">
            Run a discovery on this entity to generate hypothesis states
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200">Procurement Readiness</h2>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Score cards grid */}
      <ScoreCardGrid states={states} entityId={entityId} />
    </div>
  );
}

/**
 * Compact version for embedding in existing pages
 */
export interface HypothesisStatesCompactProps {
  entityId: string;
  maxStates?: number;
  className?: string;
}

export function HypothesisStatesCompact({
  entityId,
  maxStates = 3,
  className = ''
}: HypothesisStatesCompactProps) {
  const { data, error, isLoading } = useHypothesisStates(entityId, {
    refreshInterval: 120000, // Less frequent refresh for compact view
  });

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-slate-800 rounded h-24 ${className}`} />
    );
  }

  if (error || !data) {
    return null; // Don't show anything on error for compact view
  }

  const states = formatHypothesisStates(data).slice(0, maxStates);

  if (states.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="text-xs text-slate-500 mb-2">Procurement Signals</div>
      <div className="space-y-2">
        {states.map((state) => (
          <div
            key={`${state.entity_id}-${state.category}`}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-slate-400">
              {state.category.replace('_', ' ')}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                state.state === 'LIVE'
                  ? 'bg-green-900 text-green-200'
                  : state.state === 'ENGAGE'
                  ? 'bg-blue-900 text-blue-200'
                  : state.state === 'WARM'
                  ? 'bg-yellow-900 text-yellow-200'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {state.state.toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HypothesisStatesPanel;
