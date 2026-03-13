type VectorSearchMetric = {
  duration_ms: number
  result_count: number
  top_score: number
  semantic_enabled: boolean
}

type VectorSearchSnapshot = {
  total_requests: number
  zero_result_requests: number
  zero_result_rate: number
  avg_latency_ms: number
  p95_latency_ms: number
  rolling_size: number
}

const MAX_METRICS = 200
const HIGH_LATENCY_MS = 3000
const HIGH_ZERO_RATE = 0.4
const MIN_ALERT_SAMPLE = 20

const metrics: VectorSearchMetric[] = []
let totalRequests = 0
let zeroResultRequests = 0
let consecutiveNoResults = 0

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

export function recordVectorSearchMetric(metric: VectorSearchMetric): VectorSearchSnapshot {
  totalRequests += 1
  if (metric.result_count === 0) {
    zeroResultRequests += 1
    consecutiveNoResults += 1
  } else {
    consecutiveNoResults = 0
  }

  metrics.push(metric)
  if (metrics.length > MAX_METRICS) metrics.shift()

  const latencies = metrics.map((entry) => entry.duration_ms)
  const avgLatency = latencies.length > 0 ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 0
  const p95Latency = percentile(latencies, 95)
  const zeroRate = totalRequests > 0 ? zeroResultRequests / totalRequests : 0

  if (metric.duration_ms >= HIGH_LATENCY_MS) {
    console.warn(
      JSON.stringify({
        event: 'vector_search_alert',
        type: 'high_latency',
        duration_ms: metric.duration_ms,
        threshold_ms: HIGH_LATENCY_MS,
      }),
    )
  }

  if (consecutiveNoResults >= 5 || (totalRequests >= MIN_ALERT_SAMPLE && zeroRate >= HIGH_ZERO_RATE)) {
    console.warn(
      JSON.stringify({
        event: 'vector_search_alert',
        type: 'high_zero_result_rate',
        consecutive_no_results: consecutiveNoResults,
        zero_result_rate: Number(zeroRate.toFixed(4)),
        threshold: HIGH_ZERO_RATE,
      }),
    )
  }

  return {
    total_requests: totalRequests,
    zero_result_requests: zeroResultRequests,
    zero_result_rate: Number(zeroRate.toFixed(4)),
    avg_latency_ms: Number(avgLatency.toFixed(2)),
    p95_latency_ms: Number(p95Latency.toFixed(2)),
    rolling_size: metrics.length,
  }
}

export function getVectorSearchObservabilitySnapshot(): VectorSearchSnapshot {
  const latencies = metrics.map((entry) => entry.duration_ms)
  const avgLatency = latencies.length > 0 ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 0
  const zeroRate = totalRequests > 0 ? zeroResultRequests / totalRequests : 0
  return {
    total_requests: totalRequests,
    zero_result_requests: zeroResultRequests,
    zero_result_rate: Number(zeroRate.toFixed(4)),
    avg_latency_ms: Number(avgLatency.toFixed(2)),
    p95_latency_ms: Number(percentile(latencies, 95).toFixed(2)),
    rolling_size: metrics.length,
  }
}
