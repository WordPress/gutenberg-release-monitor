/**
 * Data fetching hooks for release statistics.
 * Uses React Query for caching and automatic refetching.
 * @module hooks/useReleases
 */

import { useQuery } from '@tanstack/react-query';
import type { Release, Summary, WPVersionStats } from '../data/types';

const BASE_URL = import.meta.env.BASE_URL;

/** Fetches all parsed Gutenberg releases from releases.json */
async function fetchReleases(): Promise<Release[]> {
  const response = await fetch(`${BASE_URL}data/releases.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch releases');
  }
  return response.json();
}

/** Fetches aggregated summary statistics from summary.json */
async function fetchSummary(): Promise<Summary> {
  const response = await fetch(`${BASE_URL}data/aggregated/summary.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch summary');
  }
  return response.json();
}

/** Fetches per-WP-version aggregated statistics from by-wp-version.json */
async function fetchWPVersionStats(): Promise<WPVersionStats[]> {
  const response = await fetch(`${BASE_URL}data/aggregated/by-wp-version.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch WP version stats');
  }
  return response.json();
}

/**
 * Fetches and caches all Gutenberg releases.
 * @returns Query result with Release[] data
 */
export function useReleases() {
  return useQuery({
    queryKey: ['releases'],
    queryFn: fetchReleases,
  });
}

/**
 * Fetches and caches summary statistics.
 * @returns Query result with Summary data
 */
export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
  });
}

/**
 * Fetches and caches per-WP-version aggregated statistics.
 * @returns Query result with WPVersionStats[] data
 */
export function useWPVersionStats() {
  return useQuery({
    queryKey: ['wpVersionStats'],
    queryFn: fetchWPVersionStats,
  });
}
