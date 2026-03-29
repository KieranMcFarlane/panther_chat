import { existsSync, readFileSync } from 'fs'
import path from 'path'

export interface EntityQuestionPackQuestion {
  question_id: string
  question: string
  yp_service_fit: string[]
  budget_range: string
  yp_advantage: string
  positioning_strategy: string
  hypothesis_template: string
  next_signals: string[]
  hop_types: string[]
  accept_criteria: string
  confidence_boost: number
}

export interface EntityQuestionPackHypothesis {
  hypothesis_id: string
  entity_id: string
  entity_name: string
  statement: string
  category: string
  prior_probability: number
  confidence: number
  status: string
  metadata: Record<string, any>
}

export interface EntityQuestionPack {
  entity_id?: string | null
  entity_name: string
  entity_type: string
  source_entity_type?: string
  question_count: number
  prompt_context: string
  questions: EntityQuestionPackQuestion[]
  hypotheses: EntityQuestionPackHypothesis[]
  service_context?: Record<string, any>
}

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'
const DEFAULT_MAX_QUESTIONS = 10

const LOCAL_FINAL_RALPH_PACK_PATHS = [
  path.join(process.cwd(), 'backend', 'data', 'dossier_question_final_ralph_pack.json'),
  path.join(process.cwd(), 'apps', 'signal-noise-app', 'backend', 'data', 'dossier_question_final_ralph_pack.json'),
  path.join(process.cwd(), '..', 'backend', 'data', 'dossier_question_final_ralph_pack.json'),
  path.join(process.cwd(), '..', '..', 'backend', 'data', 'dossier_question_final_ralph_pack.json'),
]

const SERVICE_KEYWORDS: Record<string, string[]> = {
  MOBILE_APPS: ['mobile app', 'mobile', 'ios', 'android', 'app'],
  DIGITAL_TRANSFORMATION: ['digital transformation', 'modernization', 'modernisation', 'migration', 'legacy', 'platform'],
  FAN_ENGAGEMENT: ['fan engagement', 'fan experience', 'supporter', 'loyalty'],
  ANALYTICS: ['analytics', 'data', 'reporting', 'insight', 'dashboard'],
  ECOMMERCE: ['e-commerce', 'ecommerce', 'ticketing', 'merchandise', 'shop', 'checkout'],
  UI_UX_DESIGN: ['ui', 'ux', 'design', 'experience', 'interface'],
}

function normalizeText(text: string) {
  return String(text || '').trim().toLowerCase()
}

function deriveServices(prompt: string): string[] {
  const normalized = normalizeText(prompt)
  const services = Object.entries(SERVICE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
    .map(([service]) => service)

  if (services.length > 0) {
    return Array.from(new Set(services))
  }

  if (normalized.includes('digital')) return ['DIGITAL_TRANSFORMATION']
  if (normalized.includes('fan')) return ['FAN_ENGAGEMENT']
  if (normalized.includes('data') || normalized.includes('analytics')) return ['ANALYTICS']
  return ['MOBILE_APPS']
}

function deriveBudgetRange(service: string) {
  const map: Record<string, string> = {
    MOBILE_APPS: '£80K-£300K',
    DIGITAL_TRANSFORMATION: '£150K-£500K',
    FAN_ENGAGEMENT: '£80K-£250K',
    ANALYTICS: '£100K-£400K',
    ECOMMERCE: '£100K-£500K',
    UI_UX_DESIGN: '£50K-£150K',
  }

  return map[service] || '£80K-£500K'
}

function loadLocalFinalRalphPack(): any | null {
  for (const candidatePath of LOCAL_FINAL_RALPH_PACK_PATHS) {
    if (!existsSync(candidatePath)) continue

    try {
      return JSON.parse(readFileSync(candidatePath, 'utf-8'))
    } catch {
      continue
    }
  }

  return null
}

function mapLocalFinalRalphPackToQuestionPack(
  pack: any,
  entityType: string,
  entityName: string,
  entityId?: string | null,
  maxQuestions = DEFAULT_MAX_QUESTIONS,
): EntityQuestionPack | null {
  const sourceQuestions = Array.isArray(pack?.final_ralph_pack?.questions) ? pack.final_ralph_pack.questions : []
  if (sourceQuestions.length === 0) return null

  const selectedQuestions = sourceQuestions.slice(0, Math.max(1, Math.min(maxQuestions, sourceQuestions.length)))
  const packQuestions: EntityQuestionPackQuestion[] = selectedQuestions.map((item: any, index: number) => {
    const prompt = String(item?.prompt || item?.question || '').trim()
    const services = deriveServices(prompt)
    const primaryService = services[0] || 'MOBILE_APPS'
    const bucket = String(item?.final_goal_bucket || 'context_support')
    const rank = Number(item?.final_goal_rank || index + 1)
    const score = Number(item?.final_goal_score || 0)

    return {
      question_id: `frq_${String(rank).padStart(3, '0')}`,
      question: prompt,
      yp_service_fit: services,
      budget_range: deriveBudgetRange(primaryService),
      yp_advantage: `Yellow Panther fit for ${primaryService.toLowerCase().replace(/_/g, ' ')}`,
      positioning_strategy: bucket === 'direct_revenue_signal' ? 'SOLUTION_PROVIDER' : bucket === 'high_signal' ? 'STRATEGIC_PARTNER' : 'TRUSTED_ADVISOR',
      hypothesis_template: `${entityName} may have a Yellow Panther opportunity around: ${prompt}`,
      next_signals: [
        'official site',
        'press releases',
        'job postings',
      ],
      hop_types: ['OFFICIAL_SITE', 'PRESS_RELEASE', 'CAREERS_PAGE', 'PROCUREMENT_PAGE'],
      accept_criteria: `Evidence supporting: ${prompt}`,
      confidence_boost: Math.min(0.3, Math.max(0.1, score / 1000 + 0.1)),
      final_goal_bucket: bucket,
      final_goal_score: score,
      final_goal_rank: rank,
      section_title: String(item?.section_title || 'Unclassified'),
      source_questions: Array.isArray(item?.source_questions) ? item.source_questions : [],
      final_goal_rationale: String(item?.final_goal_rationale || ''),
    } as EntityQuestionPackQuestion & Record<string, any>
  })

  return {
    entity_id: entityId || null,
    entity_name: entityName,
    entity_type: entityType,
    source_entity_type: entityType,
    question_count: packQuestions.length,
    prompt_context: `Final Ralph pack for ${entityName}. Questions are ordered by Yellow Panther business value and keep the Ralph loop focused on direct revenue signals.`,
    questions: packQuestions,
    hypotheses: packQuestions.map((question, index) => ({
      hypothesis_id: `${entityId || entityName}-frq-${String(index + 1).padStart(3, '0')}`,
      entity_id: entityId || entityName,
      entity_name: entityName,
      statement: question.hypothesis_template,
      category: question.final_goal_bucket || 'context_support',
      prior_probability: 0.5 + question.confidence_boost,
      confidence: 0.55 + question.confidence_boost,
      status: 'active',
      metadata: {
        yp_service_fit: question.yp_service_fit,
        positioning_strategy: question.positioning_strategy,
        budget_range: question.budget_range,
        confidence_boost: question.confidence_boost,
        source_questions: question.source_questions,
      },
    })),
    service_context: {
      source: 'local_final_ralph_pack',
      source_questions: sourceQuestions.length,
    },
  }
}

export async function getEntityQuestionPack(
  entityType: string,
  entityName: string,
  entityId?: string | null,
  maxQuestions = DEFAULT_MAX_QUESTIONS,
): Promise<EntityQuestionPack | null> {
  const normalizedName = String(entityName || '').trim()
  if (!normalizedName) return null

  const localPack = loadLocalFinalRalphPack()
  if (localPack) {
    const mappedLocalPack = mapLocalFinalRalphPackToQuestionPack(localPack, entityType, normalizedName, entityId, maxQuestions)
    if (mappedLocalPack) {
      return mappedLocalPack
    }
  }

  const params = new URLSearchParams({
    entity_type: String(entityType || '').trim() || 'SPORT_CLUB',
    entity_name: normalizedName,
    max_questions: String(maxQuestions),
  })

  if (entityId) {
    params.set('entity_id', String(entityId).trim())
  }

  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/entity-question-pack?${params.toString()}`, {
      cache: 'no-store',
    })

    if (!response.ok) return null

    return await response.json() as EntityQuestionPack
  } catch {
    return null
  }
}
