import { BarChart3, Database, Network, Radar, Workflow } from 'lucide-react';

export const workspaceBadges = ['Scout', 'Enrichment', 'Phase 0-5', 'Live Progress'] as const;

export const dossierLifecyclePreview = [
  { label: 'Phase 0', description: 'Intake and seed capture.' },
  { label: 'Phase 1', description: 'Discovery and source hunting.' },
  { label: 'Phase 2', description: 'Validation and evidence gates.' },
  { label: 'Phase 3', description: 'Enrichment and people/company expansion.' },
  { label: 'Phase 4', description: 'Reasoning and fit scoring.' },
  { label: 'Phase 5', description: 'Publish and action.' },
] as const;

export const pipelineSteps = [
  { name: 'Manus Scout', color: 'text-cyan-300', description: 'Broad sports discovery and candidate generation.' },
  { name: 'BrightData Evidence', color: 'text-sky-300', description: 'Live web evidence and source verification.' },
  { name: 'OpenCode Enrichment', color: 'text-fuchsia-300', description: 'LeadIQ company and people expansion.' },
  { name: 'GLM Reasoning', color: 'text-amber-300', description: 'Score fit, relevance, and next action.' },
  { name: 'Ralph Validation', color: 'text-emerald-300', description: 'Gate graph writes and confidence.' },
  { name: 'Graphiti / FalkorDB', color: 'text-violet-300', description: 'Store the durable memory and timeline.' },
] as const;

export const quickLinks = [
  { href: '/opportunities', label: 'Opportunities', icon: Workflow, description: 'Ranked RFPs and procurement matches.' },
  { href: '/graph', label: 'Graph', icon: Network, description: 'Entity relationships and temporal context.' },
  { href: '/pipeline', label: 'Pipeline', icon: BarChart3, description: 'Run history and lane health.' },
  { href: '/entity-enrichment', label: 'Entity Enrichment', icon: Database, description: 'Existing enrichment operations.' },
] as const;

export const workspacePrinciples = [
  'Scout finds candidates outside the current graph.',
  'Enrichment adds company and people context without writing to the graph.',
  'GLM and Ralph determine whether evidence becomes durable memory.',
  'Graphiti / FalkorDB stores the timeline so future runs can stand on prior work.',
  'The UI should keep the pipeline visible instead of hiding it behind a single feed.',
  'Every dossier should show phase 0-5 progress, freshness, confidence, and next action.',
] as const;

export const discoveryLaneLabels = [
  { label: 'Scout', href: '/scout' },
  { label: 'Enrichment', href: '/enrichment' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Graph', href: '/graph' },
  { label: 'Opportunities', href: '/opportunities' },
] as const;

export const discoveryLaneCount = discoveryLaneLabels.length;
