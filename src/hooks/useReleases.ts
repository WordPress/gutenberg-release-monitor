/**
 * Data fetching hooks for release statistics.
 * Uses React Query for caching and automatic refetching.
 * Paths are read from config/project.json for decoupled configuration.
 * @module hooks/useReleases
 */

import { useQuery } from '@tanstack/react-query';
import { useConfig, useTabConfig } from '../config';
import type { NormalizedRelease, SourceSummary } from '../data/normalized';
import type { ProjectConfig } from '../config/types';

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
 * Resolve the summary endpoint for a tab, falling back to the global summary path.
 */
export function resolveSummaryEndpoint(config: ProjectConfig, tabId: string): string {
  const tabConfig = config.tabs.find((tab) => tab.id === tabId);
  return tabConfig?.summaryEndpoint ?? config.dataSources.summary;
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
 * Path is read from the active tab's summaryEndpoint, falling back to dataSources.summary.
 * @param tabId - The active tab identifier from config
 * @returns Query result with SourceSummary data
 */
export function useSummary(tabId: string) {
  const config = useConfig();
  const summaryPath = resolveSummaryEndpoint(config, tabId);

  return useQuery({
    queryKey: ['summary', summaryPath],
    queryFn: () => fetchData<SourceSummary>(summaryPath, 'Failed to fetch summary'),
  });
}
