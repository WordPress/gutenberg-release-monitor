import { useQuery } from '@tanstack/react-query';
import type { Release, Summary, WPVersionStats } from '../data/types';

const BASE_URL = import.meta.env.BASE_URL;

async function fetchReleases(): Promise<Release[]> {
  const response = await fetch(`${BASE_URL}data/releases.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch releases');
  }
  return response.json();
}

async function fetchSummary(): Promise<Summary> {
  const response = await fetch(`${BASE_URL}data/aggregated/summary.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch summary');
  }
  return response.json();
}

async function fetchWPVersionStats(): Promise<WPVersionStats[]> {
  const response = await fetch(`${BASE_URL}data/aggregated/by-wp-version.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch WP version stats');
  }
  return response.json();
}

export function useReleases() {
  return useQuery({
    queryKey: ['releases'],
    queryFn: fetchReleases,
  });
}

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
  });
}

export function useWPVersionStats() {
  return useQuery({
    queryKey: ['wpVersionStats'],
    queryFn: fetchWPVersionStats,
  });
}
