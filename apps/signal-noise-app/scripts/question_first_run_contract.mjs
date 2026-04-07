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

function _slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function _normalizeCandidate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name } : null;
  }
  if (typeof value !== 'object') {
    return null;
  }
  const name = String(value.name || value.full_name || value.person || '').trim();
  if (!name) {
    return null;
  }
  const title = String(value.title || value.role || '').trim();
  const organization = String(value.organization || value.company || '').trim();
  const linkedin_url = String(value.linkedin_url || value.linkedin || '').trim();
  const relevance = String(value.relevance || '').trim();
  const candidate = { name };
  if (title) candidate.title = title;
  if (organization) candidate.organization = organization;
  if (linkedin_url) candidate.linkedin_url = linkedin_url;
  if (relevance) candidate.relevance = relevance;
  return candidate;
}

function _normalizeQuestionTiming(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const started_at = String(value.started_at || '').trim();
  const completed_at = String(value.completed_at || '').trim();
  const duration_seconds = Number(value.duration_seconds);
  if (!started_at && !completed_at && !Number.isFinite(duration_seconds)) {
    return null;
  }
  const timing = {};
  if (started_at) timing.started_at = started_at;
  if (completed_at) timing.completed_at = completed_at;
  if (Number.isFinite(duration_seconds)) timing.duration_seconds = duration_seconds;
  return timing;
}

function _buildQuestionTimingIndex(question_timings) {
  const index = new Map();
  if (!question_timings || typeof question_timings !== 'object') {
    return index;
  }
  for (const [questionId, timing] of Object.entries(question_timings)) {
    const normalized = _normalizeQuestionTiming(timing);
    if (questionId && normalized) {
      index.set(String(questionId), normalized);
    }
  }
  return index;
}

function buildPoiGraph({ entity_id, entity_name, answers = [] }) {
  const entityId = String(entity_id || '').trim();
  const entityName = String(entity_name || '').trim();
  const nodes = [];
  const edges = [];
  const seenNodes = new Set();
  const seenEdges = new Set();

  const addNode = (node) => {
    if (!node?.node_id || seenNodes.has(node.node_id)) {
      return;
    }
    seenNodes.add(node.node_id);
    nodes.push(node);
  };

  const addEdge = (edge) => {
    const key = `${edge.from_id}:${edge.edge_type}:${edge.to_id}`;
    if (seenEdges.has(key)) {
      return;
    }
    seenEdges.add(key);
    edges.push(edge);
  };

  if (entityId || entityName) {
    addNode({
      node_id: entityId || `entity:${_slugify(entityName)}`,
      node_type: 'entity',
      entity_id: entityId || undefined,
      name: entityName || entityId,
    });
  }

  for (const answer of Array.isArray(answers) ? answers : []) {
    const validationState = String(answer?.validation_state || '').trim().toLowerCase();
    const questionType = String(answer?.question_type || '').trim().toLowerCase();
    if (validationState !== 'validated') {
      continue;
    }
    if (!['decision_owner', 'related_pois', 'leadership'].includes(questionType)) {
      continue;
    }

    const evidenceUrl = String(answer?.evidence_url || '').trim();
    const confidence = Number(answer?.confidence || 0);
    const sourceQuestionId = String(answer?.question_id || '').trim();

    const primaryOwner = _normalizeCandidate(answer?.primary_owner);
    const supportingCandidates = Array.isArray(answer?.supporting_candidates)
      ? answer.supporting_candidates.map((item) => _normalizeCandidate(item)).filter(Boolean)
      : [];
    const candidates = Array.isArray(answer?.candidates)
      ? answer.candidates.map((item) => _normalizeCandidate(item)).filter(Boolean)
      : [];

    const mergedCandidates = [];
    const seenPeople = new Set();
    for (const candidate of [primaryOwner, ...supportingCandidates, ...candidates]) {
      if (!candidate?.name) continue;
      const key = candidate.name.toLowerCase();
      if (seenPeople.has(key)) continue;
      seenPeople.add(key);
      mergedCandidates.push(candidate);
    }

    for (const candidate of mergedCandidates) {
      const personId = `person:${_slugify(candidate.name)}`;
      addNode({
        node_id: personId,
        node_type: 'person',
        name: candidate.name,
        title: candidate.title,
        organization: candidate.organization,
        linkedin_url: candidate.linkedin_url,
      });

      if (entityId || entityName) {
        addEdge({
          from_id: entityId || `entity:${_slugify(entityName)}`,
          to_id: personId,
          edge_type: primaryOwner?.name === candidate.name ? 'primary_owner_of' : 'supports',
          confidence,
          source_question_id: sourceQuestionId,
          evidence_url: evidenceUrl || undefined,
          relevance: candidate.relevance || undefined,
        });
      }
    }
  }

  return {
    schema_version: 'poi_graph_v1',
    entity_id: entityId || null,
    entity_name: entityName || null,
    nodes,
    edges,
  };
}

function _mergeQuestionWithAnswer(question, answer, questionTiming) {
  const merged = { ..._clone(question) };
  if (!answer) {
    if (questionTiming) {
      merged.started_at = questionTiming.started_at;
      merged.completed_at = questionTiming.completed_at;
      merged.duration_seconds = questionTiming.duration_seconds;
    }
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
    'prompt_trace',
    'message_trace',
    'raw_execution_trace',
  ];
  for (const field of answerFields) {
    if (answerPayload[field] !== undefined) {
      merged[field] = answerPayload[field];
    }
  }
  if (questionTiming) {
    merged.started_at = questionTiming.started_at;
    merged.completed_at = questionTiming.completed_at;
    merged.duration_seconds = questionTiming.duration_seconds;
  }
  merged.question_first_answer = answerPayload;
  return merged;
}

export function buildQuestionFirstRunMergePatch({
  entity_id = null,
  entity_name = null,
  questions = [],
  answers = [],
  evidence_items = [],
  promotion_candidates = [],
  categories = [],
  question_timings = {},
  run_rollup = {},
  generated_at = new Date().toISOString(),
  question_source_path = null,
  warnings = [],
}) {
  const answerIndex = _buildQuestionAnswerIndex(answers);
  const timingIndex = _buildQuestionTimingIndex(question_timings);
  const poiGraph = buildPoiGraph({ entity_id, entity_name, answers });
  const mergedQuestions = (Array.isArray(questions) ? questions : []).map((question) => {
    const key = _answerKey(question);
    const answer = key ? answerIndex.get(key) : undefined;
    const questionTiming = key ? timingIndex.get(String(question.question_id || '').trim()) : undefined;
    return _mergeQuestionWithAnswer(question, answer, questionTiming);
  });
  const questionsAnswered = (Array.isArray(answers) ? answers : []).length;
  const normalizedQuestionTimings = {};
  for (const [questionId, timing] of timingIndex.entries()) {
    normalizedQuestionTimings[questionId] = _clone(timing);
  }

  return {
    metadata: {
      question_first: {
        enabled: true,
        schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
        questions_answered: questionsAnswered,
        categories: _clone(categories) || [],
        evidence_items: _clone(evidence_items) || [],
        promotion_candidates: _clone(promotion_candidates) || [],
        poi_graph: _clone(poiGraph),
        question_timings: _clone(normalizedQuestionTimings),
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
      evidence_items: _clone(evidence_items) || [],
      promotion_candidates: _clone(promotion_candidates) || [],
      poi_graph: _clone(poiGraph),
      question_timings: _clone(normalizedQuestionTimings),
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
  evidence_items = [],
  promotion_candidates = [],
  categories = [],
  question_timings = {},
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
  const normalizedEvidenceItems = Array.isArray(evidence_items) ? evidence_items.map((item) => _clone(item)) : [];
  const normalizedPromotionCandidates = Array.isArray(promotion_candidates) ? promotion_candidates.map((item) => _clone(item)) : [];
  const normalizedCategories = Array.isArray(categories) ? categories.map((category) => _clone(category)) : [];
  const normalizedQuestionTimings = _clone(question_timings) || {};
  const normalizedRollup = _clone(run_rollup) || {};
  const normalizedMergePatch = merge_patch || buildQuestionFirstRunMergePatch({
    entity_id,
    entity_name,
    questions: normalizedQuestions,
    answers: normalizedAnswers,
    evidence_items: normalizedEvidenceItems,
    promotion_candidates: normalizedPromotionCandidates,
    categories: normalizedCategories,
    question_timings: normalizedQuestionTimings,
    run_rollup: normalizedRollup,
    generated_at,
    question_source_path,
    warnings,
  });
  const timingIndex = _buildQuestionTimingIndex(normalizedQuestionTimings);
  const mergedQuestions = normalizedQuestions.map((question) => {
    const answer = _buildQuestionAnswerIndex(normalizedAnswers).get(_answerKey(question));
    const questionTiming = timingIndex.get(String(question.question_id || '').trim());
    return _mergeQuestionWithAnswer(question, answer, questionTiming);
  });
  const normalizedAnswersWithTimings = normalizedAnswers.map((answer) => {
    const questionId = String(answer.question_id || '').trim();
    const questionTiming = questionId ? timingIndex.get(questionId) : undefined;
    return questionTiming ? { ...answer, ...questionTiming } : answer;
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
    questions: mergedQuestions,
    answers: normalizedAnswersWithTimings,
    evidence_items: normalizedEvidenceItems,
    promotion_candidates: normalizedPromotionCandidates,
    poi_graph: buildPoiGraph({ entity_id, entity_name, answers: normalizedAnswers }),
    categories: normalizedCategories,
    question_timings: normalizedQuestionTimings,
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
  for (const field of ['questions', 'answers', 'evidence_items', 'promotion_candidates', 'poi_graph', 'categories', 'question_timings', 'run_rollup', 'merge_patch']) {
    if (!(field in artifact)) {
      throw new TypeError(`Missing canonical question_first_run field: ${field}`);
    }
  }
  return artifact;
}
