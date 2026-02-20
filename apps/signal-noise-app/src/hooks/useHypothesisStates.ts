/**
 * useHypothesisStates Hook
 *
 * Fetches hypothesis states from the scoring API.
 *
 * Part of Temporal Sports Procurement Prediction Engine MVP.
 */

import useSWR from 'swr';

export interface HypothesisState {
  entity_id: string;
  category: string;
  maturity_score: number;
  activity_score: number;
  state: 'MONITOR' | 'WARM' | 'ENGAGE' | 'LIVE';
  last_updated?: string;
}

export interface HypothesisStatesResponse {
  entity_id: string;
  states: Record<string, Omit<HypothesisState, 'entity_id'>>; // category -> state data
  timestamp?: string;
}

const fetcher = async (url: string): Promise<HypothesisStatesResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch hypothesis states: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Hook to fetch all hypothesis states for an entity
 *
 * @param entityId - Entity ID (e.g., 'arsenal-fc')
 * @param options - Optional configuration
 * @returns SWR response with hypothesis states
 *
 * @example
 * const { data, error, isLoading } = useHypothesisStates('arsenal-fc');
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error loading states</div>;
 *
 * const states = data ? formatHypothesisStates(data) : [];
 */
export function useHypothesisStates(
  entityId: string,
  options?: {
    refreshInterval?: number;
    revalidateOnFocus?: boolean;
  }
) {
  const url = `/api/scoring/${encodeURIComponent(entityId)}`;

  const { data, error, isLoading, mutate } = useSWR<HypothesisStatesResponse>(
    entityId ? url : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval || 60000, // Default: refresh every minute
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

/**
 * Hook to fetch a single hypothesis state for an entity and category
 *
 * @param entityId - Entity ID (e.g., 'arsenal-fc')
 * @param category - Category (e.g., 'CRM_UPGRADE')
 * @returns SWR response with single hypothesis state
 *
 * @example
 * const { data, error, isLoading } = useHypothesisState('arsenal-fc', 'CRM_UPGRADE');
 */
export function useHypothesisState(
  entityId: string,
  category: string,
  options?: {
    refreshInterval?: number;
    revalidateOnFocus?: boolean;
  }
) {
  const url = `/api/scoring/${encodeURIComponent(entityId)}?category=${encodeURIComponent(category)}`;

  const { data, error, isLoading, mutate } = useSWR<HypothesisStatesResponse>(
    entityId && category ? url : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval || 60000,
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
    }
  );

  // Extract the specific category from the response
  const state = data?.states?.[category];

  return {
    data: state ? { ...state, entity_id: entityId, category } : null,
    error,
    isLoading,
    mutate,
  };
}

/**
 * Format hypothesis states response for use with ScoreCardGrid
 *
 * @param response - API response
 * @returns Array of HypothesisState objects
 *
 * @example
 * const { data } = useHypothesisStates('arsenal-fc');
 * const states = data ? formatHypothesisStates(data) : [];
 */
export function formatHypothesisStates(
  response: HypothesisStatesResponse | undefined
): HypothesisState[] {
  if (!response?.states) {
    return [];
  }

  return Object.entries(response.states).map(([category, state]) => ({
    entity_id: response.entity_id,
    category,
    ...state,
  }));
}

/**
 * Recalculate hypothesis states for an entity
 *
 * @param entityId - Entity ID
 * @returns Promise with recalculated states
 */
export async function recalculateHypothesisStates(
  entityId: string
): Promise<HypothesisStatesResponse> {
  const response = await fetch(
    `/api/scoring/${encodeURIComponent(entityId)}/recalculate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to recalculate: ${response.statusText}`);
  }

  return response.json();
}
