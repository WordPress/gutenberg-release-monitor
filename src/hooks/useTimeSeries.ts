import { useQuery } from '@tanstack/react-query';
import type { TimeSeriesPoint } from '../data/types';

const BASE_URL = import.meta.env.BASE_URL;

async function fetchTimeSeries(): Promise<TimeSeriesPoint[]> {
  const response = await fetch(`${BASE_URL}data/aggregated/time-series.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch time series data');
  }
  return response.json();
}

export function useTimeSeries() {
  return useQuery({
    queryKey: ['timeSeries'],
    queryFn: fetchTimeSeries,
  });
}
