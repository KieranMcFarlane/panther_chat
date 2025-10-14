import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  return res.json();
};

export interface League {
  id: string;
  name: string;
  original_name?: string;
  tier?: string;
  sport?: string;
  country?: string;
  website?: string;
  linkedin?: string;
  description?: string;
  digital_maturity_score?: number;
  estimated_value?: string;
  priority_score?: number;
  badge_path?: string;
  badge_s3_url?: string;
  teams?: Team[];
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  original_name?: string;
  tier?: string;
  level?: string;
  sport?: string;
  country?: string;
  founded?: number;
  headquarters?: string;
  website?: string;
  linkedin?: string;
  about?: string;
  company_size?: string;
  priority?: string;
  estimated_value?: string;
  opportunity_score?: number;
  digital_maturity_score?: number;
  website_moderness_score?: number;
  digital_transformation_score?: number;
  procurement_status?: string;
  enrichment_status?: string;
  badge_path?: string;
  badge_s3_url?: string;
  league_id?: string;
  league_name?: string;
  league_badge_path?: string;
  created_at: string;
  updated_at: string;
}

export function useLeagues(options?: {
  sport?: string;
  country?: string;
  includeTeams?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.sport) params.append('sport', options.sport);
  if (options?.country) params.append('country', options.country);
  if (options?.includeTeams) params.append('includeTeams', 'true');
  
  const url = `/api/leagues${params.toString() ? `?${params.toString()}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<League[]>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    leagues: data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useTeams(options?: {
  leagueId?: string;
  sport?: string;
  country?: string;
  limit?: number;
  offset?: number;
  letter?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (options?.leagueId) params.append('leagueId', options.leagueId);
  if (options?.sport) params.append('sport', options.sport);
  if (options?.country) params.append('country', options.country);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.letter) params.append('letter', options.letter);
  if (options?.search) params.append('search', options.search);
  
  const url = `/api/teams${params.toString() ? `?${params.toString()}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<{
    teams: Team[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
      currentPage: number;
      totalPages: number;
    };
  }>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    teams: data?.teams || [],
    pagination: data?.pagination,
    isLoading,
    error,
    mutate,
  };
}