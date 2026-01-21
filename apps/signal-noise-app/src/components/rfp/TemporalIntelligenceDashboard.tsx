/**
 * TemporalIntelligenceDashboard Component
 *
 * Enhanced RFP dashboard with temporal intelligence features.
 * Shows temporal fit scores, trends, and recommendations.
 *
 * Usage:
 *   <TemporalIntelligenceDashboard entityId="arsenal-fc" rfpId="rfp-123" />
 */

'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'

interface FitAnalysisResult {
  entity_id: string
  rfp_id: string
  fit_score: number
  confidence: number
  trend_analysis: {
    rfp_count_last_90_days: number
    time_horizon_days: number
    trend: 'increasing' | 'stable' | 'decreasing'
  }
  key_factors: Array<{
    factor: string
    value: any
    impact: 'positive' | 'neutral' | 'negative'
  }>
  recommendations: string[]
  analyzed_at: string
}

interface TemporalIntelligenceDashboardProps {
  entityId: string
  rfpId: string
  rfpCategory?: string
  rfpValue?: number
  timeHorizon?: number
  className?: string
}

const fetcher = async (url: string, body?: any) => {
  const options = body
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    : undefined

  const res = await fetch(url, options)
  if (!res.ok) throw new Error('Failed to analyze fit')
  return res.json()
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-400'
  if (score >= 0.6) return 'text-yellow-400'
  return 'text-red-400'
}

function getScoreBgColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500/20 border-green-500/30'
  if (score >= 0.6) return 'bg-yellow-500/20 border-yellow-500/30'
  return 'bg-red-500/20 border-red-500/30'
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'increasing':
      return '📈'
    case 'decreasing':
      return '📉'
    default:
      return '➡️'
  }
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case 'positive':
      return 'text-green-400 bg-green-500/10'
    case 'negative':
      return 'text-red-400 bg-red-500/10'
    default:
      return 'text-zinc-400 bg-zinc-500/10'
  }
}

export function TemporalIntelligenceDashboard({
  entityId,
  rfpId,
  rfpCategory,
  rfpValue,
  timeHorizon = 90,
  className = '',
}: TemporalIntelligenceDashboardProps) {
  const [analyzeTrigger, setAnalyzeTrigger] = useState(0)

  const { data, error, isLoading } = useSWR<FitAnalysisResult>(
    `/api/temporal/analyze-fit`,
    (url) =>
      fetcher(url, {
        entity_id: entityId,
        rfp_id: rfpId,
        rfp_category: rfpCategory,
        rfp_value: rfpValue,
        time_horizon: timeHorizon,
      }),
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  )

  const analysis = data
  const fitScore = analysis?.fit_score ?? 0
  const confidence = analysis?.confidence ?? 0

  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div>
          <h3 className="text-lg font-semibold text-white">Temporal Intelligence</h3>
          <p className="text-sm text-zinc-500">
            Based on {timeHorizon}-day historical analysis
          </p>
        </div>
        <button
          onClick={() => setAnalyzeTrigger((prev) => prev + 1)}
          className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}

        {error && (
          <div className="text-center text-zinc-500 py-8">
            <p>Unable to load temporal analysis</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        )}

        {analysis && !isLoading && (
          <>
            {/* Fit Score */}
            <div className={`p-4 rounded-lg border ${getScoreBgColor(fitScore)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Fit Score</span>
                <span className={`text-2xl font-bold ${getScoreColor(fitScore)}`}>
                  {(fitScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    fitScore >= 0.8 ? 'bg-green-500' : fitScore >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${fitScore * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
                <span>Confidence: {(confidence * 100).toFixed(0)}%</span>
                <span>{getTrendIcon(analysis.trend_analysis.trend)} {analysis.trend_analysis.trend}</span>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-white">
                  {analysis.trend_analysis.rfp_count_last_90_days}
                </p>
                <p className="text-xs text-zinc-500">RFPs (90 days)</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-white">
                  {analysis.trend_analysis.time_horizon_days}
                </p>
                <p className="text-xs text-zinc-500">Day Horizon</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className={`text-2xl font-semibold ${
                  analysis.trend_analysis.trend === 'increasing'
                    ? 'text-green-400'
                    : analysis.trend_analysis.trend === 'decreasing'
                    ? 'text-red-400'
                    : 'text-zinc-400'
                }`}>
                  {getTrendIcon(analysis.trend_analysis.trend)}
                </p>
                <p className="text-xs text-zinc-500">Trend</p>
              </div>
            </div>

            {/* Key Factors */}
            {analysis.key_factors && analysis.key_factors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Key Factors</h4>
                <div className="space-y-2">
                  {analysis.key_factors.map((factor, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-zinc-800/30 rounded"
                    >
                      <span className="text-sm text-zinc-300 capitalize">
                        {factor.factor.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">{String(factor.value)}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${getImpactColor(factor.impact)}`}
                        >
                          {factor.impact}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Compact version for inline fit score display
 */
export function TemporalFitScore({
  entityId,
  rfpId,
  rfpCategory,
}: {
  entityId: string
  rfpId: string
  rfpCategory?: string
}) {
  const { data } = useSWR<FitAnalysisResult>(
    `/api/temporal/analyze-fit`,
    (url) =>
      fetcher(url, {
        entity_id: entityId,
        rfp_id: rfpId,
        rfp_category: rfpCategory,
        time_horizon: 90,
      })
  )

  if (!data) return null

  const fitScore = data.fit_score ?? 0

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getScoreBgColor(fitScore)}`}>
      <span className="text-xs text-zinc-400">Temporal Fit</span>
      <span className={`font-semibold ${getScoreColor(fitScore)}`}>
        {(fitScore * 100).toFixed(0)}%
      </span>
    </div>
  )
}
