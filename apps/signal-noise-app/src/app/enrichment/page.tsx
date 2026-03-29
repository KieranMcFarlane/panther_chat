import EnrichmentLanePanel from '@/components/discovery/EnrichmentLanePanel';

export const metadata = {
  title: 'Enrichment Lane | Signal Noise App',
  description: 'OpenCode and LeadIQ enrichment lane for sports opportunity candidates.',
};

export default function EnrichmentPage() {
  return (
    <div className="p-6">
      <EnrichmentLanePanel />
    </div>
  );
}
