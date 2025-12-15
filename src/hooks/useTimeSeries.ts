/**
 * Time series data fetching hook for chart visualizations.
 * @module hooks/useTimeSeries
 */

import { useQuery } from '@tanstack/react-query';
import type { TimeSeriesPoint } from '../data/types';

const BASE_URL = import.meta.env.BASE_URL;

/** Fetches time series data points from time-series.json */
async function fetchTimeSeries(): Promise<TimeSeriesPoint[]> {
  const response = await fetch(`${BASE_URL}data/aggregated/time-series.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch time series data');
  }
  return response.json();
}

/**
 * Fetches and caches time series data for trend charts.
 * @returns Query result with TimeSeriesPoint[] data
 */
export function useTimeSeries() {
  return useQuery({
    queryKey: ['timeSeries'],
    queryFn: fetchTimeSeries,
  });
}
