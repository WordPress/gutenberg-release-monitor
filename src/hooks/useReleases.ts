/**
 * Data fetching hooks for release statistics.
 * Uses React Query for caching and automatic refetching.
 * Paths are read from config/project.json for decoupled configuration.
 * @module hooks/useReleases
 */

import { useQuery } from '@tanstack/react-query';
import { useConfig, useTabConfig } from '../config';
import type { NormalizedRelease, SourceSummary } from '../data/normalized';

/**
 * Generic data fetcher for JSON endpoints.
 * @param path - Relative path from data/ directory
 * @param errorMessage - Error message if fetch fails
 */
async function fetchData<T>(path: string, errorMessage: string): Promise<T> {
  // Use relative path - resolves correctly from current page location
  const response = await fetch(`data/${path}`);
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * Fetches and caches data for a specific tab.
 * Returns NormalizedRelease[] ready for UI consumption.
 * @param tabId - The tab identifier from config
 * @returns Query result with normalized release data
 */
export function useTabData(tabId: string) {
  const tabConfig = useTabConfig(tabId);
  const dataEndpoint = tabConfig?.dataEndpoint ?? '';

  return useQuery({
    queryKey: ['tabData', tabId],
    queryFn: () => fetchData<NormalizedRelease[]>(
      dataEndpoint,
      `Failed to fetch data for tab: ${tabId}`
    ),
    enabled: !!dataEndpoint && !!tabConfig,
  });
}

/**
 * Fetches and caches summary statistics.
 * Path is read from dataSources.summary in config.
 * @returns Query result with SourceSummary data
 */
export function useSummary() {
  const config = useConfig();
  const summaryPath = config.dataSources.summary;

  return useQuery({
    queryKey: ['summary'],
    queryFn: () => fetchData<SourceSummary>(summaryPath, 'Failed to fetch summary'),
  });
}
