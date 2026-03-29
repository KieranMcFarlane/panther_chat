import Link from 'next/link';
import { ArrowRight, Brain, Radar, Sparkles, Workflow } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import ContinuousSystemPanel from './ContinuousSystemPanel';
import ScoutLanePanel from './ScoutLanePanel';
import EnrichmentLanePanel from './EnrichmentLanePanel';
import {
  dossierLifecyclePreview,
  pipelineSteps,
  quickLinks,
  workspaceBadges,
  workspacePrinciples,
} from './discovery-workspace-content';

export default function DiscoveryWorkspace() {
  return (
    <div className="space-y-10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(217,70,239,0.12),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_55%,_#0f172a_100%)] px-6 py-8 text-white">
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {workspaceBadges.map((badge) => (
            <Badge
              key={badge}
              className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
            >
              {badge}
            </Badge>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.45em] text-slate-400">Yellow Panther control center</p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Find opportunity, enrich it, validate it, and keep the graph current.
            </h1>
            <p className="max-w-3xl text-lg text-slate-300">
              The workspace is organized around the discovery pipeline rather than a static dashboard:
              Manus scouts the wider sports universe, BrightData gathers evidence, OpenCode enriches candidates with LeadIQ,
              GLM scores fit, Ralph gates the write, and Graphiti / FalkorDB remembers the result.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link href="/scout">
                  Open Scout Lane
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link href="/enrichment">
                  Open Enrichment Lane
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link href="/pipeline">
                  View Pipeline
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Brain className="h-5 w-5 text-amber-300" />
                  Continuous dossiers
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Phase 0-5 is visible on every dossier surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <p>Global progress, per-dossier state, and live updates stay on screen together.</p>
                <div className="flex items-center gap-2 text-cyan-200">
                  <Sparkles className="h-4 w-4" />
                  <span>Streamed updates, not refresh-only status.</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Workflow className="h-5 w-5 text-violet-300" />
                  Dossier phases
                </CardTitle>
                <CardDescription className="text-slate-300">
                  The lifecycle is explicit, consistent, and visible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dossierLifecyclePreview.map((phase) => (
                  <div key={phase.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="font-medium text-white">{phase.label}</div>
                    <div className="text-sm text-slate-300">{phase.description}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <ContinuousSystemPanel />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ScoutLanePanel />
        <EnrichmentLanePanel />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="border border-white/10 bg-slate-950/70 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/15 p-3">
                <Brain className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <CardTitle className="text-xl text-white">Pipeline</CardTitle>
                <CardDescription className="text-slate-300">
                  Keep the pipeline visible so each stage can be inspected, budgeted, and revisited.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pipelineSteps.map((step, index) => (
              <div key={step.name} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className={`mt-0.5 rounded-full border border-white/10 px-3 py-1 text-sm font-medium ${step.color}`}>
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-white">{step.name}</div>
                  <p className="text-sm text-slate-300">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {quickLinks.map((link) => (
            <Card key={link.href} className="border border-white/10 bg-white/5 backdrop-blur-md">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="rounded-xl bg-white/10 p-3">
                  <link.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{link.label}</div>
                  <p className="text-sm text-slate-300">{link.description}</p>
                  <Button asChild variant="link" className="h-auto px-0 text-cyan-300">
                    <Link href={link.href}>Open {link.label}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-3">
            <Radar className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <div className="text-xl font-semibold text-white">Operating model</div>
            <div className="text-sm text-slate-300">One front door, three lanes, one memory graph.</div>
          </div>
        </div>
        <div className="space-y-2 text-sm leading-6 text-slate-300">
          {workspacePrinciples.map((principle) => (
            <p key={principle}>{principle}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
