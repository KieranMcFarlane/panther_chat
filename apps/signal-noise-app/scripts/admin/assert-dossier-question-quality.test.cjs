const assert = require('node:assert/strict')
const test = require('node:test')

const {
  DEFAULT_REQUIRED_QUESTIONS,
  evaluateReport,
  parseArgs,
} = require('./assert-dossier-question-quality.cjs')

function perQuestionStats({ total = 10, failed = 0, zero = 0 } = {}) {
  return {
    total,
    validation_states: {
      validated: total - failed,
      failed,
    },
    zero_confidence: zero,
  }
}

function report(overrides = {}) {
  return {
    persisted_dossier_entities: 10,
    answer_coverage_buckets: { '15_of_15': 10 },
    artifact_coverage: {
      graphiti_sales_brief: 2,
      yellow_panther_fit: 2,
      outreach_strategy: 2,
    },
    per_question_quality: Object.fromEntries(
      DEFAULT_REQUIRED_QUESTIONS.map((questionId) => [questionId, perQuestionStats()]),
    ),
    ...overrides,
  }
}

test('evaluateReport passes when all required question rates and artifacts are within thresholds', () => {
  const evaluation = evaluateReport(report(), {
    maxZeroConfidenceRate: 0.2,
    maxFailedRate: 0.2,
    minArtifactCoverage: 1,
  })

  assert.equal(evaluation.ok, true)
  assert.deepEqual(evaluation.failures, [])
})

test('evaluateReport fails when q14/q15 have excessive zero-confidence rates', () => {
  const fixture = report()
  fixture.per_question_quality.q14_yp_fit = perQuestionStats({ total: 10, zero: 10 })
  fixture.per_question_quality.q15_outreach_strategy = perQuestionStats({ total: 10, zero: 9 })

  const evaluation = evaluateReport(fixture, {
    maxZeroConfidenceRate: 0.8,
    maxFailedRate: 1,
    minArtifactCoverage: 1,
  })

  assert.equal(evaluation.ok, false)
  assert.match(evaluation.failures.join('\n'), /q14_yp_fit/)
  assert.match(evaluation.failures.join('\n'), /q15_outreach_strategy/)
})

test('evaluateReport fails when commercial artifact coverage disappears', () => {
  const evaluation = evaluateReport(report({
    artifact_coverage: {
      graphiti_sales_brief: 0,
      yellow_panther_fit: 0,
      outreach_strategy: 0,
    },
  }), {
    minArtifactCoverage: 1,
  })

  assert.equal(evaluation.ok, false)
  assert.match(evaluation.failures.join('\n'), /graphiti_sales_brief/)
  assert.match(evaluation.failures.join('\n'), /yellow_panther_fit/)
  assert.match(evaluation.failures.join('\n'), /outreach_strategy/)
})

test('parseArgs supports threshold overrides and no-fail mode', () => {
  const parsed = parseArgs([
    '--max-zero-confidence-rate',
    '0.75',
    '--max-failed-rate',
    '0.5',
    '--min-artifact-coverage',
    '3',
    '--questions',
    'q14_yp_fit,q15_outreach_strategy',
    '--no-fail',
  ])

  assert.equal(parsed.maxZeroConfidenceRate, 0.75)
  assert.equal(parsed.maxFailedRate, 0.5)
  assert.equal(parsed.minArtifactCoverage, 3)
  assert.deepEqual(parsed.requiredQuestions, ['q14_yp_fit', 'q15_outreach_strategy'])
  assert.equal(parsed.noFail, true)
})
