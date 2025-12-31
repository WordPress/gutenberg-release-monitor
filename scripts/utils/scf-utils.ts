/**
 * Utility functions for SCF (Secure Custom Fields) data processing.
 *
 * @module scripts/utils/scf-utils
 */

import type { GitHubIssue } from './types.js';

/**
 * Label to category mapping for SCF PRs.
 * Maps GitHub labels to human-readable category names.
 */
export const LABEL_CATEGORY_MAP: Record<string, string> = {
  '[Type] Bug': 'Bug Fixes',
  '[Type] Enhancement': 'Enhancements',
  '[Type] Code Quality': 'Code Quality',
  'documentation': 'Documentation',
};

/**
 * Extract category from PR labels.
 * Returns the first matching category from labels, or 'Other' if no match.
 */
export function getCategoryFromLabels(labels: GitHubIssue['labels']): string {
  for (const label of labels) {
    if (LABEL_CATEGORY_MAP[label.name]) {
      return LABEL_CATEGORY_MAP[label.name];
    }
  }
  return 'Other';
}

/**
 * Check if a milestone title is a valid semver version number.
 * Matches patterns like "6.7", "6.7.0", "6.7.1".
 */
export function isValidVersion(title: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(title);
}

/**
 * Group releases by minor version.
 * E.g., 6.7.0, 6.7.1, 6.7.2 → 6.7
 */
export function groupByMinorVersion<T extends { version: string }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const parts = item.version.split('.');
    const minorVersion = parts.slice(0, 2).join('.');
    const existing = groups.get(minorVersion) || [];
    existing.push(item);
    groups.set(minorVersion, existing);
  }

  return groups;
}

/**
 * Aggregate raw categories from multiple sources.
 * Sums up category counts across all inputs.
 */
export function aggregateRawCategories(
  sources: Array<Record<string, number>>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const source of sources) {
    for (const [category, count] of Object.entries(source)) {
      result[category] = (result[category] || 0) + count;
    }
  }

  return result;
}

/**
 * Aggregate breakdown data (sponsors or countries).
 * Sums up counts and sorts by value descending.
 */
export function aggregateBreakdown(
  sources: Array<Record<string, number>>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const source of sources) {
    for (const [key, count] of Object.entries(source)) {
      result[key] = (result[key] || 0) + count;
    }
  }

  // Sort by value descending
  return Object.fromEntries(
    Object.entries(result).sort((a, b) => b[1] - a[1])
  );
}

/**
 * Get the latest date from a list of date strings.
 * Returns empty string if no valid dates.
 */
export function getLatestDate(dates: string[]): string {
  const validDates = dates.filter((d) => d && d.length > 0);
  if (validDates.length === 0) return '';
  return validDates.sort().pop() || '';
}

/**
 * Deduplicate contributors across multiple lists.
 * Returns unique contributors (case-insensitive comparison).
 */
export function deduplicateContributors(lists: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const list of lists) {
    for (const contributor of list) {
      const lower = contributor.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(contributor);
      }
    }
  }

  return result;
}
