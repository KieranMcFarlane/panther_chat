"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EntitySmokeJourneyItem } from "@/lib/entity-smoke-set"

const STATUS_LABELS: Record<EntitySmokeJourneyItem["dossierStatus"], string> = {
  ready: "Dossier ready",
  stale: "Dossier stale",
  rerun_needed: "Needs rerun",
  pending: "Dossier pending",
  missing: "No dossier yet",
}

interface EntitySmokeJourneyProps {
  items: EntitySmokeJourneyItem[]
}

export function EntitySmokeJourney({ items }: EntitySmokeJourneyProps) {
  return (
    <Card className="border-slate-700/80 bg-slate-950/70 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">5-Entity Smoke Journey</CardTitle>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              A compact set for verifying the entity-first path, persisted dossiers, and the control surfaces in motion.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <PlayCircle className="h-3.5 w-3.5" />
            Live smoke
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {items.map((item, index) => (
            <div
              key={item.entityId}
              className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 transition-colors hover:border-sky-500/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {index + 1}. {item.name}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {item.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{item.purpose}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Step {index + 1}
                </Badge>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-400">{item.smokeNote}</p>
              <div className="mt-2 rounded-lg border border-slate-700/70 bg-slate-950/70 p-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Dossier status</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{STATUS_LABELS[item.dossierStatus]}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.dossierSummary}</p>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" className="gap-1.5 px-3 py-1.5 text-xs">
                  <Link href={`/entity-browser/${item.entityId}/dossier?from=1`}>
                    Open dossier
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="px-3 py-1.5 text-xs">
                  <Link href={`/entity-browser?search=${encodeURIComponent(item.name)}`}>
                    Find in browser
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/60 p-3">
          <p className="text-sm font-medium text-slate-200">Smoke acceptance checklist</p>
          <ul className="mt-2 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
            <li>Entity browser is the first screen, not the control center.</li>
            <li>Each dossier shows persisted state and the question-driven rail.</li>
            <li>At least one dossier visibly reuses stored data on the page.</li>
            <li>Major League Cricket shows the stronger/noisier edge case without breaking the journey.</li>
            <li>The control center remains available as a secondary live overview.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default EntitySmokeJourney
