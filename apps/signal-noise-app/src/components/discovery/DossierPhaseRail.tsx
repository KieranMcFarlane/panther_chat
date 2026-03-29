'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import {
  deriveDossierPhaseSnapshot,
  dossierLifecyclePhases,
  type DossierPhaseStatus,
} from './discovery-phase-model';

interface DossierPhaseRailProps {
  title?: string;
  entityName?: string;
  dossier?: Record<string, any> | null;
  currentPhaseIndex?: number;
  progressPercent?: number;
  nextAction?: string;
  compact?: boolean;
}

const phaseStatusStyles: Record<DossierPhaseStatus, string> = {
  complete: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  active: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
  pending: 'border-white/10 bg-white/5 text-slate-300',
  blocked: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  stale: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
};

export default function DossierPhaseRail({
  title = 'Phase 0-5 dossier lifecycle',
  entityName,
  dossier,
  currentPhaseIndex,
  progressPercent,
  nextAction,
  compact = false,
}: DossierPhaseRailProps) {
  const snapshot = deriveDossierPhaseSnapshot(dossier, {
    currentPhaseIndex,
    progressPercent,
    nextAction,
  });

  return (
    <Card className="border border-white/10 bg-slate-950/70 backdrop-blur-md">
      <CardHeader className={compact ? 'pb-3' : 'space-y-3'}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl text-white">{title}</CardTitle>
            <CardDescription className="text-slate-300">
              {entityName
                ? `${entityName} is moving through the dossier lifecycle in real time.`
                : 'Track where the dossier is, what is complete, and what comes next.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
              Phase {snapshot.currentPhaseIndex}/5
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-100">
              {snapshot.evidenceCount} evidence items
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-100">
              {snapshot.freshness}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-400">
            <span>Lifecycle progress</span>
            <span>{snapshot.completionPercent}%</span>
          </div>
          <Progress value={snapshot.completionPercent} className="h-2 bg-white/5" />
        </div>

        <div className="grid gap-3 xl:grid-cols-6">
          {snapshot.phaseStatuses.map((phase) => (
            <div
              key={phase.key}
              className={`rounded-2xl border p-4 transition-colors ${phaseStatusStyles[phase.status]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{phase.label}</div>
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    phase.status === 'complete'
                      ? 'bg-emerald-300'
                      : phase.status === 'active'
                        ? 'bg-cyan-300'
                        : phase.status === 'blocked'
                          ? 'bg-amber-300'
                          : 'bg-slate-500'
                  }`}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-current/80">{phase.description}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Current phase</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {dossierLifecyclePhases[snapshot.currentPhaseIndex]?.label}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Confidence</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {snapshot.confidence === null ? 'n/a' : `${Math.round(snapshot.confidence * 100)}%`}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Next action</div>
            <div className="mt-2 text-sm leading-6 text-slate-200">{snapshot.nextAction}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

