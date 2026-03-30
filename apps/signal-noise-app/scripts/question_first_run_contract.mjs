export const QUESTION_FIRST_RUN_SCHEMA_VERSION = 'question_first_run_v1';

function _clone(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function _normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function _answerKey(item) {
  const questionId = String(item?.question_id || '').trim();
  if (questionId) {
    return `id:${questionId}`;
  }
  const questionText = _normalizeText(item?.question_text || item?.question || item?.query);
  return questionText ? `text:${questionText}` : '';
}

function _buildQuestionAnswerIndex(answers) {
  const index = new Map();
  for (const answer of Array.isArray(answers) ? answers : []) {
    const key = _answerKey(answer);
    if (key && !index.has(key)) {
      index.set(key, answer);
    }
  }
  return index;
}

function _mergeQuestionWithAnswer(question, answer) {
  const merged = { ..._clone(question) };
  if (!answer) {
    return merged;
  }

  const answerPayload = _clone(answer);
  const answerFields = [
    'answer',
    'confidence',
    'validation_state',
    'search_query',
    'search_queries',
    'search_hit',
    'search_results_count',
    'search_attempts',
    'scrape_url',
    'evidence_url',
    'reasoning_model_used',
    'category',
    'retry_count',
    'signal_type',
    'recommended_next_query',
    'notes',
  ];
  for (const field of answerFields) {
    if (answerPayload[field] !== undefined) {
      merged[field] = answerPayload[field];
    }
  }
  merged.question_first_answer = answerPayload;
  return merged;
}

export function buildQuestionFirstRunMergePatch({
  questions = [],
  answers = [],
  categories = [],
  run_rollup = {},
  generated_at = new Date().toISOString(),
  question_source_path = null,
  warnings = [],
}) {
  const answerIndex = _buildQuestionAnswerIndex(answers);
  const mergedQuestions = (Array.isArray(questions) ? questions : []).map((question) => {
    const key = _answerKey(question);
    const answer = key ? answerIndex.get(key) : undefined;
    return _mergeQuestionWithAnswer(question, answer);
  });
  const questionsAnswered = (Array.isArray(answers) ? answers : []).length;

  return {
    metadata: {
      question_first: {
        enabled: true,
        schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
        questions_answered: questionsAnswered,
        categories: _clone(categories) || [],
        question_source_path,
        generated_at,
        run_rollup: _clone(run_rollup) || {},
        warnings: Array.isArray(warnings) ? [...warnings] : [],
      },
    },
    question_first: {
      enabled: true,
      schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
      questions_answered: questionsAnswered,
      categories: _clone(categories) || [],
      answers: _clone(answers) || [],
      run_rollup: _clone(run_rollup) || {},
      question_source_path,
      generated_at,
      warnings: Array.isArray(warnings) ? [...warnings] : [],
    },
    questions: mergedQuestions,
  };
}

export function buildQuestionFirstRunArtifact({
  entity_id,
  entity_name,
  entity_type,
  preset = null,
  question_source_path = null,
  questions = [],
  answers = [],
  categories = [],
  run_rollup = {},
  merge_patch = null,
  generated_at = new Date().toISOString(),
  run_started_at = generated_at,
  source = 'opencode_agentic_batch',
  status = 'ready',
  warnings = [],
}) {
  const normalizedQuestions = Array.isArray(questions) ? questions.map((question) => _clone(question)) : [];
  const normalizedAnswers = Array.isArray(answers) ? answers.map((answer) => _clone(answer)) : [];
  const normalizedCategories = Array.isArray(categories) ? categories.map((category) => _clone(category)) : [];
  const normalizedRollup = _clone(run_rollup) || {};
  const normalizedMergePatch = merge_patch || buildQuestionFirstRunMergePatch({
    questions: normalizedQuestions,
    answers: normalizedAnswers,
    categories: normalizedCategories,
    run_rollup: normalizedRollup,
    generated_at,
    question_source_path,
    warnings,
  });

  return {
    schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
    generated_at,
    run_started_at,
    source,
    status,
    warnings: Array.isArray(warnings) ? [...warnings] : [],
    entity: {
      entity_id,
      entity_name,
      entity_type,
    },
    preset,
    question_source_path,
    questions: normalizedQuestions,
    answers: normalizedAnswers,
    categories: normalizedCategories,
    run_rollup: normalizedRollup,
    merge_patch: normalizedMergePatch,
  };
}

export function validateQuestionFirstRunArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new TypeError('question_first_run artifact must be an object');
  }
  if (artifact.schema_version !== QUESTION_FIRST_RUN_SCHEMA_VERSION) {
    throw new TypeError(`Expected schema_version ${QUESTION_FIRST_RUN_SCHEMA_VERSION}`);
  }
  for (const field of ['questions', 'answers', 'categories', 'run_rollup', 'merge_patch']) {
    if (!(field in artifact)) {
      throw new TypeError(`Missing canonical question_first_run field: ${field}`);
    }
  }
  return artifact;
}
