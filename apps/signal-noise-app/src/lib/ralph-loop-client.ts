/**
 * 🔄 Ralph Loop Client
 *
 * Frontend client for submitting raw signals to Ralph Loop validation
 *
 * Usage:
 *   import { validateSignalsViaRalphLoop } from '@/lib/ralph-loop-client';
 *
 *   const rawSignals = [
 *     {
 *       entity_id: "ac-milan",
 *       signal_type: "RFP_DETECTED",
 *       confidence: 0.8,
 *       evidence: [...],
 *       metadata: {...}
 *     }
 *   ];
 *
 *   const result = await validateSignalsViaRalphLoop(rawSignals);
 *   console.log(`Validated: ${result.validated_signals}, Rejected: ${result.rejected_signals}`);
 */

export interface RawEvidence {
  source: string;
  date: string;
  url?: string;
  extracted_text?: string;
  credibility_score?: number;
  metadata?: Record<string, any>;
}

export interface RawSignal {
  entity_id: string;
  signal_type: string;
  confidence: number;
  evidence: RawEvidence[];
  metadata?: Record<string, any>;
  first_seen?: string;
}

export interface ValidatedSignal {
  id: string;
  type: string;
  confidence: number;
  first_seen: string;
  entity_id: string;
  validated: boolean;
  validation_pass: number;
  metadata?: Record<string, any>;
}

export interface RalphLoopResponse {
  validated_signals: number;
  rejected_signals: number;
  signals: ValidatedSignal[];
  validation_time_seconds: number;
}

/**
 * Validate raw signals through Ralph Loop
 *
 * @param rawSignals Array of raw signals from scrapers
 * @returns Ralph Loop validation response
 */
export async function validateSignalsViaRalphLoop(
  rawSignals: RawSignal[]
): Promise<RalphLoopResponse> {
  const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';

  try {
    console.log(`🔄 Submitting ${rawSignals.length} raw signals to Ralph Loop...`);

    const response = await fetch(`${FASTAPI_URL}/api/signals/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rawSignals),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ralph Loop validation failed: ${response.status} ${errorText}`);
    }

    const result: RalphLoopResponse = await response.json();

    console.log(`✅ Ralph Loop complete:`, {
      validated: result.validated_signals,
      rejected: result.rejected_signals,
      time: `${result.validation_time_seconds.toFixed(2)}s`
    });

    return result;

  } catch (error) {
    console.error('❌ Ralph Loop client error:', error);
    throw error;
  }
}

/**
 * Submit a single signal for validation
 *
 * Convenience wrapper for validateSignalsViaRalphLoop
 */
export async function validateSingleSignal(
  signal: RawSignal
): Promise<RalphLoopResponse> {
  return validateSignalsViaRalphLoop([signal]);
}

/**
 * Validate signals from scraper output
 *
 * Helper function to convert scraper output to Ralph Loop format
 *
 * @param entityId Entity ID
 * @param signalType Signal type (e.g., "RFP_DETECTED")
 * @param evidence Array of evidence items
 * @param metadata Optional metadata
 */
export async function submitScraperSignals(
  entityId: string,
  signalType: string,
  evidence: RawEvidence[],
  metadata?: Record<string, any>
): Promise<RalphLoopResponse> {
  const rawSignal: RawSignal = {
    entity_id: entityId,
    signal_type: signalType,
    confidence: 0.7, // Default confidence
    evidence,
    metadata: {
      ...metadata,
      first_seen: new Date().toISOString()
    }
  };

  return validateSingleSignal(rawSignal);
}

/**
 * Batch validation with progress tracking
 *
 * For large batches, validates in chunks and reports progress
 */
export async function validateSignalsWithProgress(
  rawSignals: RawSignal[],
  chunkSize: number = 10,
  onProgress?: (progress: {
    completed: number;
    total: number;
    validated: number;
    rejected: number;
  }) => void
): Promise<RalphLoopResponse> {
  const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';

  const totalSignals = rawSignals.length;
  let completedSignals = 0;
  let totalValidated = 0;
  let totalRejected = 0;
  const allValidatedSignals: ValidatedSignal[] = [];

  // Process in chunks
  for (let i = 0; i < rawSignals.length; i += chunkSize) {
    const chunk = rawSignals.slice(i, i + chunkSize);

    const result = await fetch(`${FASTAPI_URL}/api/signals/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });

    if (!result.ok) {
      const errorText = await result.text();
      throw new Error(`Chunk validation failed: ${result.status} ${errorText}`);
    }

    const chunkResult: RalphLoopResponse = await result.json();

    totalValidated += chunkResult.validated_signals;
    totalRejected += chunkResult.rejected_signals;
    allValidatedSignals.push(...chunkResult.signals);
    completedSignals += chunk.length;

    // Report progress
    if (onProgress) {
      onProgress({
        completed: completedSignals,
        total: totalSignals,
        validated: totalValidated,
        rejected: totalRejected,
      });
    }
  }

  return {
    validated_signals: totalValidated,
    rejected_signals: totalRejected,
    signals: allValidatedSignals,
    validation_time_seconds: 0, // Not tracked for chunked processing
  };
}
