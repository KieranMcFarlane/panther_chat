import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ContinuousSystemPanel from '@/components/discovery/ContinuousSystemPanel';

export const metadata = {
  title: 'Pipeline | Signal Noise App',
  description: 'Yellow Panther discovery pipeline overview.',
};

const pipelineSummary = [
  { label: 'Scout', value: 'Manus' },
  { label: 'Evidence', value: 'BrightData' },
  { label: 'Enrichment', value: 'OpenCode + LeadIQ' },
  { label: 'Reasoning', value: 'GLM' },
  { label: 'Validation', value: 'Ralph' },
];

export default function PipelinePage() {
  return (
    <div className="space-y-6 bg-slate-950 px-6 py-8 text-white">
      <Card className="border border-white/10 bg-slate-950/70 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Pipeline Summary</CardTitle>
          <CardDescription className="text-slate-300">
            The continuous loop from scout to graph memory stays visible as a dedicated monitor.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {pipelineSummary.map((item) => (
            <Badge key={item.label} className="border-white/10 bg-white/5 text-white">
              {item.label}: {item.value}
            </Badge>
          ))}
        </CardContent>
      </Card>
      <ContinuousSystemPanel />
    </div>
  );
}
