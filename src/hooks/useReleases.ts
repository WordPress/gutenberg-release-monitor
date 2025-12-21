/**
 * Data fetching hooks for release statistics.
 * Uses React Query for caching and automatic refetching.
 * Paths are read from project-config.json for decoupled configuration.
 * @module hooks/useReleases
 */

import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../config';
import type { Release, Summary, WPVersionStats } from '../data/types';

const BASE_URL = import.meta.env.BASE_URL;

/**
 * Generic data fetcher for JSON endpoints.
 * @param path - Relative path from data/ directory
 * @param errorMessage - Error message if fetch fails
 */
async function fetchData<T>(path: string, errorMessage: string): Promise<T> {
  const response = await fetch(`${BASE_URL}data/${path}`);
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * Fetches and caches data for a specific tab.
 * Path is read from tab configuration.
 * @param tabId - The tab identifier from config
 * @returns Query result with tab-specific data
 */
export function useTabData<T>(tabId: string) {
  const config = useConfig();
  const tabConfig = config.tabs.find((tab) => tab.id === tabId);
  const dataEndpoint = tabConfig?.dataEndpoint ?? '';

  return useQuery({
    queryKey: ['tabData', tabId],
    queryFn: () => fetchData<T>(dataEndpoint, `Failed to fetch data for tab: ${tabId}`),
    enabled: !!dataEndpoint,
  });
}

/**
 * Fetches and caches individual release items.
 * Finds the non-aggregated tab from config to get the data endpoint.
 * @returns Query result with Release[] data
 */
export function useReleases() {
  const config = useConfig();
  const tabConfig = config.tabs.find((tab) => !tab.isAggregated);
  const dataEndpoint = tabConfig?.dataEndpoint ?? '';

  return useQuery({
    queryKey: ['releases'],
    queryFn: () => fetchData<Release[]>(dataEndpoint, 'Failed to fetch releases'),
  });
}

/**
 * Fetches and caches summary statistics.
 * Path is read from dataSources.summary in config.
 * @returns Query result with Summary data
 */
export function useSummary() {
  const config = useConfig();
  const summaryPath = config.dataSources.summary;

  return useQuery({
    queryKey: ['summary'],
    queryFn: () => fetchData<Summary>(summaryPath, 'Failed to fetch summary'),
  });
}

/**
 * Fetches and caches aggregated version statistics.
 * Finds the aggregated tab from config to get the data endpoint.
 * @returns Query result with aggregated stats data
 */
export function useAggregatedStats() {
  const config = useConfig();
  const tabConfig = config.tabs.find((tab) => tab.isAggregated);
  const dataEndpoint = tabConfig?.dataEndpoint ?? '';

  return useQuery({
    queryKey: ['aggregatedStats'],
    queryFn: () => fetchData<WPVersionStats[]>(dataEndpoint, 'Failed to fetch aggregated stats'),
  });
}
