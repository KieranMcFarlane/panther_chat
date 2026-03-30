import EntityEnrichmentDashboard from '@/components/entity-enrichment/EntityEnrichmentDashboard';

export default function EntityEnrichmentPage() {
  return <EntityEnrichmentDashboard />;
}

export const metadata = {
  title: 'Entity Enrichment Lane | Signal Noise App',
  description: 'OpenCode enrichment lane for sports entities using BrightData MCP evidence and LeadIQ expansion.',
};
