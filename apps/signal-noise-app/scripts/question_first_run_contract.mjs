export const QUESTION_FIRST_RUN_SCHEMA_VERSION = 'question_first_run_v2';

function _clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function _normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function _answerKey(item) {
  const questionId = String(item?.question_id || '').trim();
  if (questionId) return `id:${questionId}`;
  const questionText = _normalizeText(item?.question_text || item?.question || item?.query);
  return questionText ? `text:${questionText}` : '';
}

function _buildAnswerIndex(answerRecords) {
  const index = new Map();
  for (const answer of Array.isArray(answerRecords) ? answerRecords : []) {
    const key = _answerKey(answer);
    if (key && !index.has(key)) index.set(key, answer);
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
  if (!value) return null;
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name } : null;
  }
  if (typeof value !== 'object') return null;
  const name = String(value.name || value.full_name || value.person || '').trim();
  if (!name) return null;
  const title = String(value.title || value.role || '').trim();
  const organization = String(value.organization || value.company || '').trim();
  const linkedin_url = String(value.linkedin_url || value.linkedin || value.profile_url || '').trim();
  const relevance = String(value.relevance || '').trim();
  const candidate = { name };
  if (title) candidate.title = title;
  if (organization) candidate.organization = organization;
  if (linkedin_url) candidate.linkedin_url = linkedin_url;
  if (relevance) candidate.relevance = relevance;
  return candidate;
}

function _normalizeQuestionTiming(value) {
  if (!value || typeof value !== 'object') return null;
  const started_at = String(value.started_at || '').trim();
  const completed_at = String(value.completed_at || '').trim();
  const duration_seconds = Number(value.duration_seconds);
  if (!started_at && !completed_at && !Number.isFinite(duration_seconds)) return null;
  const timing = {};
  if (started_at) timing.started_at = started_at;
  if (completed_at) timing.completed_at = completed_at;
  if (Number.isFinite(duration_seconds)) timing.duration_seconds = duration_seconds;
  return timing;
}

function _buildQuestionTimingIndex(question_timings) {
  const index = new Map();
  if (!question_timings || typeof question_timings !== 'object') return index;
  for (const [questionId, timing] of Object.entries(question_timings)) {
    const normalized = _normalizeQuestionTiming(timing);
    if (questionId && normalized) index.set(String(questionId), normalized);
  }
  return index;
}

function _normalizeValidationState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'no_signal';
  if (normalized === 'tool_call_missing' || normalized === 'failed') return 'failed';
  if (normalized === 'exhausted' || normalized === 'no_signal') return 'no_signal';
  if (normalized === 'validated') return 'validated';
  if (normalized === 'partially_validated') return 'partially_validated';
  if (normalized === 'deterministic_detected') return 'deterministic_detected';
  if (normalized === 'provisional') return 'provisional';
  if (normalized === 'inferred') return 'inferred';
  if (normalized === 'pending') return 'provisional';
  return normalized;
}

function _normalizeAnswerStatus(validationState, confidence) {
  if (validationState === 'failed') return 'failed';
  if (validationState === 'no_signal') return 'no_signal';
  if (validationState === 'validated' || validationState === 'partially_validated' || validationState === 'deterministic_detected' || validationState === 'provisional' || validationState === 'inferred') {
    return 'answered';
  }
  return Number(confidence || 0) > 0 ? 'answered' : 'partial';
}

function _normalizeTopSignals(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return { name: item, version: null, category: null, confidence: 0.5, validation_state: 'inferred', evidence_refs: [] };
        }
        if (typeof item !== 'object') return null;
        const name = String(item.name || item.technology || item.label || '').trim();
        if (!name) return null;
        return {
          name,
          version: item.version ?? null,
          category: item.category ?? item.type ?? null,
          confidence: Number(item.confidence ?? 0.5),
          validation_state: _normalizeValidationState(item.validation_state || item.validationState || item.state || 'inferred'),
          evidence_refs: Array.isArray(item.evidence_refs) ? [...item.evidence_refs] : [],
        };
      })
      .filter(Boolean);
  }
  return [];
}

function _normalizeCommercialInterpretation(answerPayload, structuredOutput) {
  if (answerPayload?.commercial_interpretation && typeof answerPayload.commercial_interpretation === 'object') {
    return _clone(answerPayload.commercial_interpretation);
  }
  const summary = String(
    structuredOutput?.commercial_interpretation?.summary ||
      structuredOutput?.commercial_interpretation ||
      structuredOutput?.context ||
      structuredOutput?.notes ||
      '',
  ).trim();
  const themes = Array.isArray(structuredOutput?.commercial_interpretation?.themes)
    ? structuredOutput.commercial_interpretation.themes
    : [];
  const implicationStrength = structuredOutput?.commercial_interpretation?.implication_strength || null;
  return {
    summary: summary || null,
    themes,
    implication_strength: implicationStrength,
  };
}

function _normalizeOpportunityHypotheses(answerPayload, structuredOutput) {
  const existing = Array.isArray(answerPayload?.opportunity_hypotheses) ? answerPayload.opportunity_hypotheses : [];
  if (existing.length > 0) return _clone(existing);
  const candidate = structuredOutput?.opportunity_hypotheses || structuredOutput?.opportunity || structuredOutput?.opportunities;
  if (Array.isArray(candidate)) return _clone(candidate);
  if (candidate && typeof candidate === 'object') return [_clone(candidate)];
  if (typeof candidate === 'string' && candidate.trim()) {
    return [{ type: 'commercial_opportunity', label: candidate.trim(), confidence: Number(structuredOutput?.confidence ?? 0.5) }];
  }
  return [];
}

function _inferAnswerKind(answer, structuredOutput) {
  const questionType = String(answer?.question_type || '').trim().toLowerCase();
  if (['foundation'].includes(questionType)) return 'fact';
  if (['digital_stack', 'procurement', 'opportunity_signal', 'launch'].includes(questionType)) return 'signal_set';
  if (['decision_owner', 'related_pois', 'leadership', 'poi'].includes(questionType)) return 'list';
  return 'summary';
}

function _normalizeAnswerPayload(answer) {
  if (answer?.answer && typeof answer.answer === 'object' && answer.answer.kind) {
    return _clone(answer.answer);
  }
  const structuredOutput = answer?.reasoning?.structured_output || {};
  const kind = _inferAnswerKind(answer, structuredOutput);
  if (kind === 'fact') {
    return {
      kind,
      value: answer?.answer ?? structuredOutput?.answer ?? null,
      summary: null,
      top_signals: [],
      commercial_interpretation: {},
      opportunity_hypotheses: [],
      maturity_signal: null,
      raw_structured_output: Object.keys(structuredOutput).length > 0 ? _clone(structuredOutput) : null,
    };
  }
  if (kind === 'signal_set') {
    const topSignals = _normalizeTopSignals(structuredOutput?.top_signals || structuredOutput?.signals || structuredOutput?.technologies);
    return {
      kind,
      value: null,
      summary: String(answer?.answer || structuredOutput?.summary || structuredOutput?.answer || '').trim() || null,
      top_signals: topSignals,
      commercial_interpretation: _normalizeCommercialInterpretation(answer, structuredOutput),
      opportunity_hypotheses: _normalizeOpportunityHypotheses(answer, structuredOutput),
      maturity_signal: structuredOutput?.maturity_signal || null,
      raw_structured_output: Object.keys(structuredOutput).length > 0 ? _clone(structuredOutput) : null,
    };
  }
  if (kind === 'list') {
    const values = []
      .concat(answer?.primary_owner ? [answer.primary_owner] : [])
      .concat(Array.isArray(answer?.supporting_candidates) ? answer.supporting_candidates : [])
      .concat(Array.isArray(answer?.candidates) ? answer.candidates : [])
      .map((item) => _normalizeCandidate(item))
      .filter(Boolean);
    return {
      kind,
      value: null,
      summary: String(answer?.answer || structuredOutput?.summary || '').trim() || null,
      top_signals: [],
      commercial_interpretation: {},
      opportunity_hypotheses: [],
      maturity_signal: null,
      raw_structured_output: values.length ? { candidates: values } : Object.keys(structuredOutput).length > 0 ? _clone(structuredOutput) : null,
    };
  }
  return {
    kind,
    value: null,
    summary: String(answer?.answer || structuredOutput?.summary || structuredOutput?.answer || '').trim() || null,
    top_signals: [],
    commercial_interpretation: _normalizeCommercialInterpretation(answer, structuredOutput),
    opportunity_hypotheses: _normalizeOpportunityHypotheses(answer, structuredOutput),
    maturity_signal: null,
    raw_structured_output: Object.keys(structuredOutput).length > 0 ? _clone(structuredOutput) : null,
  };
}

function _normalizeQuestionSpec(question, entityMeta = {}) {
  const normalized = _clone(question) || {};
  return {
    question_id: String(normalized.question_id || '').trim(),
    question_family: String(normalized.question_family || normalized.question_type || 'general').trim(),
    question_type: String(normalized.question_type || '').trim(),
    question_text: String(normalized.question_text || normalized.question || '').trim(),
    query: String(normalized.query || '').trim(),
    hop_budget: Number(normalized.hop_budget || 0),
    evidence_extension_budget: Number.isFinite(Number(normalized.evidence_extension_budget))
      ? Number(normalized.evidence_extension_budget)
      : 0,
    source_priority: Array.isArray(normalized.source_priority) ? [...normalized.source_priority] : [],
    search_strategy: _clone(normalized.search_strategy) || {},
    deterministic_tools: Array.isArray(normalized.deterministic_tools) ? [...normalized.deterministic_tools] : [],
    fallback_to_retrieval: Boolean(normalized.fallback_to_retrieval),
    deterministic_input: normalized.deterministic_input ?? null,
    evidence_focus: String(normalized.evidence_focus || 'general').trim(),
    promotion_target: String(normalized.promotion_target || 'general').trim(),
    answer_kind: String(normalized.answer_kind || 'summary').trim(),
    question_shape: String(normalized.question_shape || 'atomic').trim(),
    question_timeout_ms: Number(normalized.question_timeout_ms || 0),
    hop_timeout_ms: Number(normalized.hop_timeout_ms || 0),
    evidence_extension_confidence_threshold: Number.isFinite(Number(normalized.evidence_extension_confidence_threshold))
      ? Number(normalized.evidence_extension_confidence_threshold)
      : 0.65,
    entity_name: String(normalized.entity_name || entityMeta.entity_name || '').trim(),
    entity_id: String(normalized.entity_id || entityMeta.entity_id || '').trim(),
    entity_type: String(normalized.entity_type || entityMeta.entity_type || '').trim(),
    preset: normalized.preset ?? entityMeta.preset ?? null,
    pack_role: String(normalized.pack_role || 'discovery').trim(),
    execution_class: String(normalized.execution_class || 'atomic_retrieval').trim(),
    rollout_phase: String(normalized.rollout_phase || 'phase_1_core').trim(),
    conditional_on: Array.isArray(normalized.conditional_on) ? _clone(normalized.conditional_on) : [],
    depends_on: Array.isArray(normalized.depends_on) ? [...normalized.depends_on] : [],
    structured_output_schema: String(normalized.structured_output_schema || '').trim(),
    graph_write_targets: Array.isArray(normalized.graph_write_targets) ? [...normalized.graph_write_targets] : [],
  };
}

function _normalizeAnswerRecord(answer, questionTiming, questionSpec) {
  const normalized = _clone(answer) || {};
  const validationState = _normalizeValidationState(normalized.validation_state);
  const confidence = Number(normalized.confidence ?? 0);
  const timing = questionTiming || {};
  return {
    question_id: String(normalized.question_id || questionSpec?.question_id || '').trim(),
    question_type: String(normalized.question_type || questionSpec?.question_type || '').trim(),
    status: String(normalized.status || _normalizeAnswerStatus(validationState, confidence)),
    validation_state: validationState,
    confidence,
    signal_type: String(normalized.signal_type || (questionSpec?.question_type ? questionSpec.question_type.toUpperCase() : 'GENERAL')).trim(),
    execution_class: String(normalized.execution_class || questionSpec?.execution_class || '').trim() || null,
    rollout_phase: String(normalized.rollout_phase || questionSpec?.rollout_phase || '').trim() || null,
    structured_output_schema: String(normalized.structured_output_schema || questionSpec?.structured_output_schema || '').trim() || null,
    answer: _normalizeAnswerPayload(normalized),
    primary_owner: _normalizeCandidate(normalized.primary_owner),
    supporting_candidates: Array.isArray(normalized.supporting_candidates) ? normalized.supporting_candidates.map((item) => _normalizeCandidate(item)).filter(Boolean) : [],
    candidates: Array.isArray(normalized.candidates) ? normalized.candidates.map((item) => _normalizeCandidate(item)).filter(Boolean) : [],
    evidence_refs: Array.isArray(normalized.evidence_refs) ? [...normalized.evidence_refs] : [],
    trace_ref: normalized.trace_ref ?? null,
    recommended_next_query: normalized.recommended_next_query ?? null,
    notes: normalized.notes ?? null,
    ...(normalized.timeout_salvage ? { timeout_salvage: _clone(normalized.timeout_salvage) } : {}),
    started_at: normalized.started_at || timing.started_at || null,
    completed_at: normalized.completed_at || timing.completed_at || null,
    duration_seconds: Number.isFinite(Number(normalized.duration_seconds)) ? Number(normalized.duration_seconds) : Number(timing.duration_seconds || 0),
  };
}

function _collectStructuredSources(answer) {
  const structuredOutput = answer?.reasoning?.structured_output || {};
  const directSources = Array.isArray(structuredOutput.sources) ? structuredOutput.sources : [];
  return directSources
    .map((source) => {
      if (typeof source === 'string') return { url: source };
      if (source && typeof source === 'object') return source;
      return null;
    })
    .filter(Boolean);
}

function _buildEvidenceItems({ answerRecords, explicitEvidenceItems = [] }) {
  if (Array.isArray(explicitEvidenceItems) && explicitEvidenceItems.length > 0) {
    return explicitEvidenceItems.map((item) => {
      const normalized = _clone(item) || {};
      if (!normalized.url && normalized.evidence_url) normalized.url = normalized.evidence_url;
      if (!normalized.source_type) normalized.source_type = normalized.raw_ref || 'other';
      if (!Array.isArray(normalized.supports)) normalized.supports = normalized.answer ? [String(normalized.answer)] : [];
      if (!normalized.captured_at) normalized.captured_at = new Date().toISOString();
      if (normalized.relevance === undefined) normalized.relevance = Number(normalized.confidence ?? 0.5);
      return normalized;
    });
  }

  const items = [];
  for (const answer of answerRecords) {
    const sources = _collectStructuredSources(answer).slice();
    if (answer.evidence_url && !sources.find((source) => String(source.url || '') === String(answer.evidence_url))) {
      sources.unshift({ url: answer.evidence_url, title: null, snippet: null });
    }
    if (sources.length === 0 && answer.answer?.value) {
      continue;
    }
    sources.forEach((source, index) => {
      const evidenceId = `ev:${answer.question_id}:${String(index + 1).padStart(3, '0')}`;
      items.push({
        evidence_id: evidenceId,
        question_id: answer.question_id,
        source_type: source.source_type || source.type || 'other',
        url: String(source.url || '').trim(),
        title: source.title ?? null,
        snippet: source.snippet ?? null,
        captured_at: answer.completed_at || answer.started_at || new Date().toISOString(),
        relevance: Number(source.relevance ?? answer.confidence ?? 0.5),
        confidence: Number(source.confidence ?? answer.confidence ?? 0.5),
        supports: source.supports || [String(answer.answer?.value || answer.answer?.summary || answer.signal_type || '').trim()].filter(Boolean),
        raw_ref: source.raw_ref || source.source || null,
      });
    });
  }
  return items;
}

function _attachEvidenceRefs(answerRecords, evidenceItems) {
  const byQuestion = new Map();
  for (const item of Array.isArray(evidenceItems) ? evidenceItems : []) {
    const questionId = String(item.question_id || '').trim();
    if (!questionId) continue;
    if (!byQuestion.has(questionId)) byQuestion.set(questionId, []);
    byQuestion.get(questionId).push(String(item.evidence_id || '').trim());
  }
  return answerRecords.map((answer) => ({
    ...answer,
    evidence_refs: answer.evidence_refs.length > 0 ? answer.evidence_refs : (byQuestion.get(answer.question_id) || []).filter(Boolean),
  }));
}

export function buildPoiGraph({ entity_id, entity_name, answers = [] }) {
  const entityId = String(entity_id || '').trim();
  const entityName = String(entity_name || '').trim();
  const nodes = [];
  const edges = [];
  const seenNodes = new Set();
  const seenEdges = new Set();

  const addNode = (node) => {
    if (!node?.node_id || seenNodes.has(node.node_id)) return;
    seenNodes.add(node.node_id);
    nodes.push(node);
  };
  const addEdge = (edge) => {
    const key = `${edge.from_id}:${edge.edge_type}:${edge.to_id}`;
    if (seenEdges.has(key)) return;
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
    if (validationState !== 'validated') continue;
    if (!['decision_owner', 'related_pois', 'leadership'].includes(questionType)) continue;

    const confidence = Number(answer?.confidence || 0);
    const sourceQuestionId = String(answer?.question_id || '').trim();
    const primaryOwner = _normalizeCandidate(answer?.primary_owner);
    const supportingCandidates = Array.isArray(answer?.supporting_candidates) ? answer.supporting_candidates.map((item) => _normalizeCandidate(item)).filter(Boolean) : [];
    const candidates = Array.isArray(answer?.candidates) ? answer.candidates.map((item) => _normalizeCandidate(item)).filter(Boolean) : [];
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
          relevance: candidate.relevance || undefined,
        });
      }
    }
  }

  for (const answer of Array.isArray(answers) ? answers : []) {
    const rawStructuredOutput = answer?.answer?.raw_structured_output;
    const graphEpisode = rawStructuredOutput?.graph_episode;
    const questionType = String(answer?.question_type || '').trim().toLowerCase();
    if (!graphEpisode || typeof graphEpisode !== 'object') continue;
    if (!['capability_gap', 'yp_fit', 'outreach_strategy'].includes(questionType)) continue;
    const episodeId = `episode:${questionType}:${_slugify(graphEpisode.label || answer.question_id || questionType)}`;
    addNode({
      node_id: episodeId,
      node_type: 'derived_episode',
      name: String(graphEpisode.label || questionType).trim() || questionType,
      episode_type: String(graphEpisode.episode_type || questionType).trim(),
      score: Number(graphEpisode.score || answer?.confidence || 0),
    });
    if (entityId || entityName) {
      addEdge({
        from_id: entityId || `entity:${_slugify(entityName)}`,
        to_id: episodeId,
        edge_type: `derived_${questionType}`,
        confidence: Number(answer?.confidence || graphEpisode.score || 0),
        source_question_id: String(answer?.question_id || '').trim() || undefined,
      });
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

export function buildQuestionFirstRunMergePatch({
  generated_at = new Date().toISOString(),
  answer_records = [],
  categories = [],
  question_timings = {},
}) {
  const normalizedQuestionTimings = {};
  for (const [questionId, timing] of _buildQuestionTimingIndex(question_timings).entries()) {
    normalizedQuestionTimings[questionId] = _clone(timing);
  }
  return {
    metadata: {
      question_first: {
        enabled: true,
        schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
        questions_answered: Array.isArray(answer_records) ? answer_records.length : 0,
        generated_at,
      },
    },
    question_first: {
      enabled: true,
      schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
      questions_answered: Array.isArray(answer_records) ? answer_records.length : 0,
      generated_at,
      categories: _clone(categories) || [],
      question_timings: _clone(normalizedQuestionTimings),
      answers: (Array.isArray(answer_records) ? answer_records : []).map((answer) => ({
        question_id: answer.question_id,
        question_type: answer.question_type,
        validation_state: answer.validation_state,
        confidence: answer.confidence,
        signal_type: answer.signal_type,
        answer: _clone(answer.answer),
      })),
    },
  };
}

export function buildQuestionFirstRunArtifact({
  entity_id,
  entity_name,
  entity_type,
  run_id = null,
  preset = null,
  question_source_path = null,
  question_specs = [],
  answer_records = [],
  questions = [],
  answers = [],
  evidence_items = [],
  trace_index = [],
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
  const baseEntity = { entity_id, entity_name, entity_type, preset };
  const rawQuestionSpecs = (Array.isArray(question_specs) && question_specs.length > 0 ? question_specs : questions).map((question) => _normalizeQuestionSpec(question, baseEntity));
  const timingIndex = _buildQuestionTimingIndex(question_timings);
  const rawAnswerRecords = (Array.isArray(answer_records) && answer_records.length > 0 ? answer_records : answers)
    .map((answer) => {
      const questionId = String(answer?.question_id || '').trim();
      const questionSpec = rawQuestionSpecs.find((item) => item.question_id === questionId) || null;
      const questionTiming = questionId ? timingIndex.get(questionId) : undefined;
      return _normalizeAnswerRecord(answer, questionTiming, questionSpec);
    });
  const normalizedEvidenceItems = _buildEvidenceItems({ answerRecords: Array.isArray(answer_records) && answer_records.length > 0 ? answer_records : answers, explicitEvidenceItems: evidence_items });
  const normalizedAnswerRecords = _attachEvidenceRefs(rawAnswerRecords, normalizedEvidenceItems);
  const normalizedCategories = Array.isArray(categories) ? categories.map((category) => _clone(category)) : [];
  const normalizedQuestionTimings = _clone(question_timings) || {};
  const normalizedRollup = _clone(run_rollup) || {};
  const normalizedTraceIndex = Array.isArray(trace_index) ? trace_index.map((trace) => _clone(trace)) : [];
  const normalizedPromotionCandidates = Array.isArray(promotion_candidates) ? promotion_candidates.map((candidate) => _clone(candidate)) : [];
  const normalizedPoiGraph = buildPoiGraph({ entity_id, entity_name, answers: normalizedAnswerRecords });
  const normalizedMergePatch =
    merge_patch ||
    buildQuestionFirstRunMergePatch({
      generated_at,
      answer_records: normalizedAnswerRecords,
      categories: normalizedCategories,
      question_timings: normalizedQuestionTimings,
    });

  return {
    schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
    run_id: run_id || `${_slugify(entity_id || entity_name)}_${generated_at}`,
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
    question_specs: rawQuestionSpecs,
    answer_records: normalizedAnswerRecords,
    evidence_items: normalizedEvidenceItems,
    promotion_candidates: normalizedPromotionCandidates,
    poi_graph: normalizedPoiGraph,
    trace_index: normalizedTraceIndex,
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
  for (const field of ['question_specs', 'answer_records', 'evidence_items', 'trace_index', 'promotion_candidates', 'poi_graph', 'categories', 'question_timings', 'run_rollup', 'merge_patch']) {
    if (!(field in artifact)) {
      throw new TypeError(`Missing canonical question_first_run field: ${field}`);
    }
  }
  const answerRecords = Array.isArray(artifact.answer_records) ? artifact.answer_records : [];
  for (const answer of answerRecords) {
    const questionType = String(answer?.question_type || '').trim().toLowerCase();
    const status = String(answer?.status || '').trim().toLowerCase();
    if (status === 'failed' || status === 'no_signal') continue;
    if (questionType === 'decision_owner') {
      const hasPrimaryOwner = Boolean(answer?.primary_owner && typeof answer.primary_owner === 'object' && String(answer.primary_owner.name || '').trim());
      const hasCandidates = Array.isArray(answer?.supporting_candidates) || Array.isArray(answer?.candidates);
      if (!hasPrimaryOwner && !hasCandidates) {
        throw new TypeError('decision_owner answers must include a primary_owner or ranked candidates');
      }
    }
    if (questionType === 'connections') {
      const candidatePaths = answer?.answer?.raw_structured_output?.candidate_paths;
      if (!Array.isArray(candidatePaths)) {
        throw new TypeError('connections answers must include candidate_paths in raw_structured_output');
      }
    }
    if (['capability_gap', 'yp_fit', 'outreach_strategy'].includes(questionType)) {
      const rawStructuredOutput = answer?.answer?.raw_structured_output;
      if (!rawStructuredOutput || typeof rawStructuredOutput !== 'object') {
        throw new TypeError(`${questionType} answers must include raw_structured_output`);
      }
    }
  }
  return artifact;
}
