"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { EntityQuestionPack } from "@/lib/entity-question-pack"

interface EntityQuestionPackRailProps {
  entityName: string
  entityType: string
  questionPack?: EntityQuestionPack | null
}

export function EntityQuestionPackRail({ entityName, entityType, questionPack }: EntityQuestionPackRailProps) {
  if (!questionPack) {
    return (
      <Card className="border border-white/10 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-lg text-white">Question pack</CardTitle>
          <CardDescription className="text-slate-300">
            {entityName} will use the canonical Yellow Panther question bank once the backend pack is available.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-300">
          This dossier uses the entity-type template for {entityType || 'the entity'}.
        </CardContent>
      </Card>
    )
  }

  const visibleQuestions = questionPack.questions.slice(0, 6)
  const serviceFits = Array.from(new Set(questionPack.questions.flatMap((question) => question.yp_service_fit)))
  const isAtomicDiscoveryPack = String(questionPack.prompt_context || '').startsWith('Atomic discovery pack')
  const writeback = questionPack.service_context?.writeback || null

  return (
    <Card className="border border-white/10 bg-slate-950/80 backdrop-blur-md">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg text-white">Question pack</CardTitle>
            <CardDescription className="text-slate-300">
              {isAtomicDiscoveryPack
                ? `Atomic discovery pack for ${entityName}. Questions are for evidence collection and later dossier promotion.`
                : `Canonical question bank for ${entityName}. Each question drives a testable hypothesis and a Yellow Panther service-fit check.`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAtomicDiscoveryPack && (
              <Badge className="border-emerald-400/20 bg-emerald-500/10 text-emerald-100">
                Atomic discovery
              </Badge>
            )}
            <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
              {questionPack.question_count} questions
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-100">
              {questionPack.entity_type}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-slate-400">
            <span>Question coverage</span>
            <span>{Math.min(100, Math.max(10, questionPack.question_count * 10))}%</span>
          </div>
          <Progress value={Math.min(100, Math.max(10, questionPack.question_count * 10))} className="h-2 bg-white/5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {serviceFits.map((serviceFit) => (
            <Badge key={serviceFit} variant="secondary" className="text-xs">
              {serviceFit.replace(/_/g, ' ').toLowerCase()}
            </Badge>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleQuestions.map((question) => (
            <div key={question.question_id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-white">{question.question}</div>
                <Badge variant="outline" className="border-white/10 text-xs text-slate-100">
                  {question.positioning_strategy.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{question.accept_criteria}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {question.yp_service_fit.slice(0, 2).map((service) => (
                  <Badge key={`${question.question_id}-${service}`} variant="secondary" className="text-[11px]">
                    {service.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {questionPack.prompt_context && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Prompt context</div>
            <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{questionPack.prompt_context}</pre>
          </div>
        )}

        {writeback && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-400/20 bg-emerald-500/15 text-emerald-100">Persisted writeback</Badge>
              <span className="text-xs uppercase tracking-[0.24em] text-emerald-200">Artifact path</span>
            </div>
            <div className="mt-2 break-all text-sm text-emerald-50">{String(writeback.artifact_path || 'Unknown')}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-100">
              <Badge variant="outline" className="border-emerald-400/20 text-emerald-50">
                {writeback.persisted ? 'Persisted' : 'Pending'}
              </Badge>
              <Badge variant="outline" className="border-emerald-400/20 text-emerald-50">
                {Number(writeback.question_count || questionPack.question_count || 0)} questions
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default EntityQuestionPackRail
