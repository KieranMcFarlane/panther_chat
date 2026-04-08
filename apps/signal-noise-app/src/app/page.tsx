import Link from 'next/link'
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Database,
  FileSearch,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TopOpportunities } from '@/components/home/FeaturedOpportunities'
import { requirePageSession } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const systemRules = [
  {
    icon: FileSearch,
    title: 'Canonical dossiers only',
    description: 'Entity review should come from question-first dossier artifacts, not legacy fallback summaries or heuristic tabs.',
  },
  {
    icon: Briefcase,
    title: 'Promoted opportunities only',
    description: 'Commercial surfaces stay empty until source-backed rows are promoted by the final system.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest empty states',
    description: 'If a dossier or opportunity is not ready, the app should say that directly instead of filling space with placeholders.',
  },
]

const clientPath = [
  {
    step: '1',
    title: 'Entities',
    description: 'Browse canonical entities and open UUID-backed dossier routes.',
    href: '/entity-browser',
    cta: 'Open Entities',
  },
  {
    step: '2',
    title: 'Dossiers',
    description: 'Review only question-first dossier output. If a dossier is not ready yet, it should stay visibly not ready.',
    href: '/entity-browser',
    cta: 'Review Dossiers',
  },
  {
    step: '3',
    title: 'Opportunities',
    description: 'Work from promoted, non-expired, source-backed opportunities that survived the stricter gate.',
    href: '/opportunities',
    cta: 'Open Opportunities',
  },
]

export default async function Home() {
  await requirePageSession('/')

  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(247,192,53,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_28%),linear-gradient(180deg,_rgba(4,8,20,1),_rgba(7,17,31,1))]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-amber-400/10">
              <Database className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Signal Noise</div>
              <div className="text-sm text-slate-200">Canonical question-first workspace</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10">
              Main system only
            </Badge>
            <Badge className="border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/10">
              Canonical dossiers
            </Badge>
            <Badge className="border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/10">
              Promoted opportunities
            </Badge>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="space-y-6">
            <Badge className="w-fit border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
              Client path locked to the final system
            </Badge>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Work only from canonical dossiers and promoted opportunities.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                This surface is intentionally narrow. Entities lead to question-first dossier artifacts. Opportunities only appear after they survive source checks, expiry checks, and promotion into the final system.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/entity-browser">
                <Button size="lg" className="bg-amber-400 text-black hover:bg-amber-300">
                  Open Entities
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/opportunities">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  Open Opportunities
                </Button>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {systemRules.map((rule) => (
                <Card key={rule.title} className="border-white/10 bg-white/[0.04] backdrop-blur-sm">
                  <CardContent className="p-5">
                    <rule.icon className="mb-4 h-5 w-5 text-amber-300" />
                    <div className="mb-2 text-sm font-semibold text-white">{rule.title}</div>
                    <div className="text-sm leading-6 text-slate-300">{rule.description}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="border-white/10 bg-white/[0.05] backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white">Client path</CardTitle>
              <p className="text-sm text-slate-400">
                Everything else is ops tooling or raw intake and should stay out of the client review path.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientPath.map((item) => (
                <div key={item.step} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-sm font-semibold text-amber-200">
                      {item.step}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-300">{item.description}</div>
                      <Link href={item.href} className="mt-3 inline-flex items-center text-sm font-medium text-amber-300 hover:text-amber-200">
                        {item.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-sky-400/15 bg-sky-500/10 p-4 text-sm leading-6 text-sky-50/90">
                Raw intake, enrichment lanes, pipeline runners, and import tools still exist for operators. They are not the product truth and should not drive client review.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <TopOpportunities />
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardContent className="p-5">
              <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-300" />
              <div className="mb-1 text-sm font-semibold text-white">Canonical source of truth</div>
              <p className="text-sm leading-6 text-slate-300">
                `question_first_run_v1` and the canonical dossier output are the only sources that should shape the client-visible entity narrative.
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <CardContent className="p-5">
              <Database className="mb-3 h-5 w-5 text-sky-300" />
              <div className="mb-1 text-sm font-semibold text-white">Entity browser first</div>
              <p className="text-sm leading-6 text-slate-300">
                The browser should lead into UUID-backed dossiers, not into queued legacy pages or neutral placeholder summaries.
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <CardContent className="p-5">
              <Briefcase className="mb-3 h-5 w-5 text-amber-300" />
              <div className="mb-1 text-sm font-semibold text-white">Commercial discipline</div>
              <p className="text-sm leading-6 text-slate-300">
                If an opportunity has not been promoted and source-checked, it should not appear in the client-facing path at all.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
