import Link from 'next/link'
import {
  ArrowRight,
  BrainCircuit,
  Clock3,
  Database,
  Layers3,
  Network,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GraphitiInsightsFeed } from '@/components/home/GraphitiInsightsFeed'
import { requirePageSession } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const pillars = [
  {
    icon: Search,
    title: 'Find',
    description: 'Search entities, aliases, and related records across the sports intelligence stack.',
  },
  {
    icon: Network,
    title: 'Connect',
    description: 'Follow relationships between leagues, teams, federations, rights holders, and organisations.',
  },
  {
    icon: Clock3,
    title: 'Remember',
    description: 'Store temporal episodes so changes and discoveries stay attached to the graph over time.',
  },
]

const flow = [
  {
    step: '1',
    title: 'Supabase',
    description: 'cached_entities holds the browser and import surface for curated records.',
  },
  {
    step: '2',
    title: 'Graphiti on FalkorDB',
    description: 'The graph layer stores entity links, episodes, and queryable context.',
  },
  {
    step: '3',
    title: 'BrightData',
    description: 'Discovery and enrichment find the external signals that feed the graph.',
  },
]

export default async function Home() {
  await requirePageSession('/')

  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(247,192,53,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_28%),linear-gradient(180deg,_rgba(4,8,20,1),_rgba(7,17,31,1))]" />
      <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-10">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-amber-400/10">
              <BrainCircuit className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Signal Noise</div>
              <div className="text-sm text-slate-200">Graphiti + FalkorDB + Supabase</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10">
              Graphiti active
            </Badge>
            <Badge className="border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/10">
              FalkorDB backend
            </Badge>
            <Badge className="border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/10">
              Supabase cache
            </Badge>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div className="space-y-6">
            <Badge className="w-fit border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
              Temporal graph intelligence for sports entities
            </Badge>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Graphiti is the memory layer that connects every entity, relationship, and episode.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                It sits on top of FalkorDB for graph storage, uses Supabase for cached entities and UI state,
                and lets the agent pipeline remember what was found, when it was found, and how it connects.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/entity-browser">
                <Button size="lg" className="bg-amber-400 text-black hover:bg-amber-300">
                  Open Entity Browser
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/graph">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  View Graph
                </Button>
              </Link>
              <Link href="/entity-import">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-slate-200 hover:bg-white/5 hover:text-white"
                >
                  Import CSV
                </Button>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {pillars.map((pillar) => (
                <Card key={pillar.title} className="border-white/10 bg-white/[0.04] backdrop-blur-sm">
                  <CardContent className="p-5">
                    <pillar.icon className="mb-4 h-5 w-5 text-amber-300" />
                    <div className="mb-2 text-sm font-semibold text-white">{pillar.title}</div>
                    <div className="text-sm leading-6 text-slate-300">{pillar.description}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="border-white/10 bg-white/[0.05] backdrop-blur-md">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">What Graphiti does</div>
                  <div className="text-sm text-slate-400">The graph backbone behind the agent layer</div>
                </div>
                <div className="rounded-full border border-amber-400/20 bg-amber-400/10 p-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </div>
              </div>

              <div className="space-y-4">
                {flow.map((item) => (
                  <div
                    key={item.step}
                    className="flex gap-4 rounded-2xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-sm font-semibold text-amber-200">
                      {item.step}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="text-sm leading-6 text-slate-300">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-sky-400/15 bg-sky-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-100">
                  <Layers3 className="h-4 w-4" />
                  Why it matters
                </div>
                <p className="mt-2 text-sm leading-6 text-sky-50/90">
                  The agent no longer has to guess from raw text. It can query the graph first, follow edges,
                  and keep a stable memory of clubs, leagues, federations, rights holders, and the work done on them.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <GraphitiInsightsFeed />
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardContent className="p-5">
              <Database className="mb-3 h-5 w-5 text-sky-300" />
              <div className="mb-1 text-sm font-semibold text-white">Supabase</div>
              <p className="text-sm leading-6 text-slate-300">
                Stores cached entities, CSV imports, and the browser-facing records.
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <CardContent className="p-5">
              <Workflow className="mb-3 h-5 w-5 text-emerald-300" />
              <div className="mb-1 text-sm font-semibold text-white">Graphiti</div>
              <p className="text-sm leading-6 text-slate-300">
                Resolves relationships, temporal episodes, and entity search across the graph.
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <CardContent className="p-5">
              <Search className="mb-3 h-5 w-5 text-amber-300" />
              <div className="mb-1 text-sm font-semibold text-white">BrightData</div>
              <p className="text-sm leading-6 text-slate-300">
                Feeds discovery and enrichment with external signals before they enter the graph.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
