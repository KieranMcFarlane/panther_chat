/**
 * Dossier Error Component
 *
 * Displays error state when dossier generation fails
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface DossierErrorProps {
  entityId: string;
  error?: string;
  onRetry?: () => void;
}

export function DossierError({ entityId, error, onRetry }: DossierErrorProps) {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Dossier Generation Failed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Unable to load dossier for <strong>{entityId}</strong>
        </p>

        {error && (
          <div className="bg-destructive/10 p-3 rounded-md">
            <p className="text-xs text-destructive font-mono">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
          >
            Refresh Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
