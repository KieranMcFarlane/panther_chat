import Link from 'next/link';
import { ArrowRight, Building2, Users, Layers3, MessageSquarePlus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const enrichmentCapabilities = [
  'Company search',
  'People search',
  'Grouped advanced search',
  'Flat advanced search',
  'Feedback for bad records',
];

const enrichmentOutputs = [
  'Named decision makers',
  'Roles and titles',
  'Company size and context',
  'Technologies and funding signals',
];

export default function EnrichmentLanePanel() {
  return (
    <Card className="border border-fuchsia-500/30 bg-slate-950/70 backdrop-blur-md shadow-2xl shadow-fuchsia-500/10">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-fuchsia-500/15 p-3">
            <Building2 className="h-5 w-5 text-fuchsia-300" />
          </div>
          <div>
            <CardTitle className="text-xl text-white">Lane 2. Enrichment</CardTitle>
            <CardDescription className="text-slate-300">
              OpenCode consumes scout output and enriches it with LeadIQ and structured source context.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {enrichmentCapabilities.map((capability) => (
            <div key={capability} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              {capability}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.3em] text-fuchsia-200/70">Enrichment outputs</div>
          <div className="flex flex-wrap gap-2">
            {enrichmentOutputs.map((output) => (
              <Badge key={output} variant="secondary" className="border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100">
                {output}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 text-fuchsia-300" />
            <div>
              <div className="font-medium text-white">People graph</div>
              <p className="text-sm text-slate-300">Decision makers, assistants, and adjacent operators.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Layers3 className="mt-0.5 h-5 w-5 text-fuchsia-300" />
            <div>
              <div className="font-medium text-white">Company context</div>
              <p className="text-sm text-slate-300">Industry, employee count, technologies, and funding history.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 sm:col-span-2">
            <MessageSquarePlus className="mt-0.5 h-5 w-5 text-fuchsia-300" />
            <div>
              <div className="font-medium text-white">Feedback loop</div>
              <p className="text-sm text-slate-300">
                Bad contact records are pushed back as feedback so the lane improves over time.
              </p>
            </div>
          </div>
        </div>

        <Button asChild className="w-full bg-fuchsia-500 text-white hover:bg-fuchsia-400">
          <Link href="/enrichment">
            Open Enrichment Lane
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
