#!/usr/bin/env node

const {
  buildReport,
  createPgPool,
} = require('./report-dossier-quality.cjs')

const DEFAULT_REQUIRED_QUESTIONS = [
  'q1_foundation',
  'q2_digital_stack',
  'q3_leadership',
  'q4_performance',
  'q5_league_context',
  'q6_launch_signal',
  'q7_procurement_signal',
  'q8_explicit_rfp',
  'q9_news_signal',
  'q10_hiring_signal',
  'q11_decision_owner',
  'q12_connections',
  'q13_capability_gap',
  'q14_yp_fit',
  'q15_outreach_strategy',
]

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    maxZeroConfidenceRate: 0.9,
    maxFailedRate: 0.9,
    minArtifactCoverage: 1,
    requiredQuestions: DEFAULT_REQUIRED_QUESTIONS,
    noFail: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === '--max-zero-confidence-rate') {
      options.maxZeroConfidenceRate = Number(next)
      index += 1
    } else if (arg === '--max-failed-rate') {
      options.maxFailedRate = Number(next)
      index += 1
    } else if (arg === '--min-artifact-coverage') {
      options.minArtifactCoverage = Number(next)
      index += 1
    } else if (arg === '--questions') {
      options.requiredQuestions = String(next || '').split(',').map((item) => item.trim()).filter(Boolean)
      index += 1
    } else if (arg === '--no-fail') {
      options.noFail = true
    }
  }
  return options
}

function rate(numerator, denominator) {
  const total = Number(denominator || 0)
  return total > 0 ? Number(numerator || 0) / total : 0
}

function zeroConfidenceStats(stats) {
  const eligibleTotal = stats && Object.prototype.hasOwnProperty.call(stats, 'eligible_total')
    ? Number(stats.eligible_total || 0)
    : null
  if (eligibleTotal !== null) {
    return {
      numerator: Number(stats.eligible_zero_confidence || 0),
      denominator: eligibleTotal,
      label: 'eligible zero-confidence rate',
    }
  }
  return {
    numerator: Number(stats.zero_confidence || 0),
    denominator: Number(stats.total || 0),
    label: 'zero-confidence rate',
  }
}

function evaluateReport(report, options = {}) {
  const config = {
    ...parseArgs([]),
    ...options,
  }
  const failures = []
  const warnings = []
  const perQuestion = report?.per_question_quality || {}
  const artifacts = report?.artifact_coverage || {}

  for (const questionId of config.requiredQuestions) {
    const stats = perQuestion[questionId]
    if (!stats || Number(stats.total || 0) === 0) {
      failures.push(`${questionId}: no answer records found`)
      continue
    }
    const total = Number(stats.total || 0)
    const zeroStats = zeroConfidenceStats(stats)
    const zeroRate = rate(zeroStats.numerator, zeroStats.denominator)
    const failedRate = rate(stats.validation_states?.failed || 0, total)
    if (zeroRate > config.maxZeroConfidenceRate) {
      failures.push(`${questionId}: ${zeroStats.label} ${zeroRate.toFixed(3)} exceeds ${config.maxZeroConfidenceRate}`)
    }
    if (failedRate > config.maxFailedRate) {
      failures.push(`${questionId}: failed rate ${failedRate.toFixed(3)} exceeds ${config.maxFailedRate}`)
    }
  }

  for (const artifactName of ['graphiti_sales_brief', 'yellow_panther_fit', 'outreach_strategy']) {
    if (Number(artifacts[artifactName] || 0) < config.minArtifactCoverage) {
      failures.push(`${artifactName}: coverage ${Number(artifacts[artifactName] || 0)} below ${config.minArtifactCoverage}`)
    }
  }

  const fullPacks = Number(report?.answer_coverage_buckets?.['15_of_15'] || 0)
  if (fullPacks > 0 && Number(artifacts.graphiti_sales_brief || 0) === 0) {
    warnings.push('15/15 dossiers exist but no meaningful graphiti_sales_brief artifacts were detected')
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    summary: {
      persisted_dossier_entities: report?.persisted_dossier_entities || 0,
      answer_coverage_buckets: report?.answer_coverage_buckets || {},
      artifact_coverage: artifacts,
    },
  }
}

async function main() {
  const options = parseArgs()
  const pool = createPgPool()
  try {
    const report = await buildReport(pool)
    const evaluation = evaluateReport(report, options)
    process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`)
    if (!evaluation.ok && !options.noFail) {
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}

module.exports = {
  DEFAULT_REQUIRED_QUESTIONS,
  evaluateReport,
  parseArgs,
}
