/**
 * Dynamic Entity Dossier Component
 *
 * Fetches dossier data from API and displays with accordion UI
 * Replaces hardcoded data with API-driven generation
 */

"use client";

import { useState, useEffect } from 'react';
import { DossierAccordion, DossierSection } from './DossierAccordion';
import { DossierSkeleton } from './DossierSkeleton';
import { DossierError } from './DossierError';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EntityDossierData {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  priority_score: number;
  tier: string;
  sections: DossierSection[];
  generated_at: string;
  total_cost_usd: number;
  generation_time_seconds: number;
  cache_status: string;
}

interface DynamicEntityDossierProps {
  entityId: string;
  forceRegenerate?: boolean;
}

export function DynamicEntityDossier({
  entityId,
  forceRegenerate = false
}: DynamicEntityDossierProps) {
  const [dossier, setDossier] = useState<EntityDossierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDossier = async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/dossier?entity_id=${encodeURIComponent(entityId)}${force ? '&force=true' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDossier(data);

    } catch (err) {
      console.error('Failed to fetch dossier:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDossier(forceRegenerate);
  }, [entityId, forceRegenerate]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDossier(true); // Force regeneration
  };

  const handleRetry = () => {
    fetchDossier(false);
  };

  // Loading state
  if (loading && !dossier) {
    return <DossierSkeleton />;
  }

  // Error state
  if (error && !dossier) {
    return <DossierError entityId={entityId} error={error} onRetry={handleRetry} />;
  }

  // No data
  if (!dossier) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No dossier data available for {entityId}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state - display dossier
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{dossier.entity_name}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{dossier.entity_type}</Badge>
                <Badge variant="secondary">{dossier.tier} Tier</Badge>
                <Badge variant="outline">Priority: {dossier.priority_score}/100</Badge>
              </div>
            </div>

            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Regenerating...' : 'Regenerate'}
            </Button>
          </div>
        </CardHeader>

        {dossier.cache_status === 'CACHED' && (
          <CardContent>
            <p className="text-xs text-muted-foreground">
              📦 Loaded from cache (generated {new Date(dossier.generated_at).toLocaleString()})
            </p>
          </CardContent>
        )}

        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Sections</p>
              <p className="font-semibold">{dossier.sections.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Generation Cost</p>
              <p className="font-semibold">${dossier.total_cost_usd.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Generation Time</p>
              <p className="font-semibold">{dossier.generation_time_seconds.toFixed(1)}s</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dossier Sections */}
      {dossier.sections.length > 0 ? (
        <DossierAccordion sections={dossier.sections} />
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No sections generated for this dossier
            </p>
          </CardContent>
        </Card>
      )}

      {/* Model Attribution */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            🤖 Generated using Claude AI model cascade: Haiku (80%), Sonnet (15%), Opus (5%)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
