import Link from 'next/link';
import { ArrowRight, Search, ShieldAlert, Sparkles } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const scoutSignals = [
  'Broad sports universe search',
  'Non-official entities and shadow leads',
  'Candidate opportunity objects only',
  'Accepted / rejected / stale / revisit states',
];

const scoutSources = ['Google SERP', 'LinkedIn', 'official site', 'press release', 'news'];

export default function ScoutLanePanel() {
  return (
    <Card className="border border-cyan-500/30 bg-slate-950/70 backdrop-blur-md shadow-2xl shadow-cyan-500/10">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/15 p-3">
            <Search className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <CardTitle className="text-xl text-white">Lane 1. Scout</CardTitle>
            <CardDescription className="text-slate-300">
              Manus scans the wider sports universe for RFPs, tenders, and adjacent opportunity signals.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {scoutSignals.map((signal) => (
            <div key={signal} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              {signal}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Priority sources</div>
          <div className="flex flex-wrap gap-2">
            {scoutSources.map((source) => (
              <Badge key={source} variant="secondary" className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
                {source}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-cyan-300" />
            <div className="space-y-2">
              <div className="font-medium text-white">Output contract</div>
              <p className="text-sm text-slate-300">
                Scout returns candidate leads with source URLs, freshness, confidence, and a follow-up query.
                It does not write directly to the graph.
              </p>
            </div>
          </div>
        </div>

        <Button asChild className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
          <Link href="/scout">
            Open Scout Lane
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
