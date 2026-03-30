"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveEntityUuid } from "@/lib/entity-public-id"

type SmokeJourneyItem = {
  entityId: string
  name: string
  type: string
  purpose: string
  smokeNote: string
}

const smokeJourneyItems: SmokeJourneyItem[] = [
  {
    entityId: "dca9d675-1d91-4a19-8ae6-04ed0df624cd",
    name: "Arsenal Football Club",
    type: "Club",
    purpose: "Happy-path club dossier",
    smokeNote: "Use this to prove the dossier page, persistence, and phase rail on a strong entity."
  },
  {
    entityId: "b62b1f00-dd3a-4a22-82cb-4a6a573f5a09",
    name: "Coventry City",
    type: "Club",
    purpose: "Repeat club run",
    smokeNote: "Use this to confirm the browser-to-dossier journey is repeatable across clubs."
  },
  {
    entityId: "d500cecb-8392-4bba-9cb2-4ed2bb7f9253",
    name: "Zimbabwe Cricket",
    type: "Cricket Board",
    purpose: "Persisted question-first dossier",
    smokeNote: "Use this to verify the persisted dossier is visible immediately on the page."
  },
  {
    entityId: "0c6caa0a-8475-455f-8f9b-5ce61295bcd1",
    name: "Major League Cricket",
    type: "League",
    purpose: "Procurement signal check",
    smokeNote: "Use this to exercise the question pack and show sparse/no-signal handling without breaking UX."
  },
  {
    entityId: "f6f83596-9b70-41e9-996b-a53b82168cd7",
    name: "Zimbabwe Handball Federation",
    type: "Federation",
    purpose: "Federation dossier path",
    smokeNote: "Use this to confirm the federation dossier path and phase progression."
  }
]

export function EntitySmokeJourney() {
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
          {smokeJourneyItems.map((item, index) => (
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

              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" className="gap-1.5 px-3 py-1.5 text-xs">
                  <Link href={`/entity-browser/${resolveEntityUuid({ id: item.entityId, neo4j_id: item.entityId, supabase_id: item.entityId })}/dossier?from=1`}>
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
