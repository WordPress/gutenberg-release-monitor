/**
 * Gutenberg Release data provider.
 * Converts Gutenberg Release data to NormalizedRelease.
 */

import type { Release } from '../types';
import type { NormalizedRelease } from '../normalized';

/**
 * Format version string for display.
 * Converts X.Y.Z to X.Y format (strips patch version if present).
 */
function formatVersionForDisplay(version: string): string {
  const parts = version.split('.');
  if (parts.length === 3) {
    return `${parts[0]}.${parts[1]}`;
  }
  return version;
}

/**
 * Converts Gutenberg Release array to NormalizedRelease array.
 * Each item represents a single Gutenberg release.
 */
export function normalizeGBReleases(
  data: Release[],
  displayPrefix: string
): NormalizedRelease[] {
  return data.map((item): NormalizedRelease => {
    const version = item.gbVersion;
    const displayVersion = formatVersionForDisplay(version);

    const totalPRs = item.totalPRs ?? 0;
    const contributors = item.contributors ?? 0;
    const newContributors = item.newContributors ?? 0;

    return {
      id: version,
      version,
      displayVersion,
      displayLabel: `${displayPrefix} ${displayVersion}`,
      isAggregated: false,
      totalPRs,
      contributors,
      newContributors,
      hasContributorData: contributors > 0,
      // For individual items, avg = totals (no grouping to average over)
      avgPRs: totalPRs,
      avgContributors: contributors,
      avgNewContributors: newContributors,
      rawCategories: item.categories,
      contributorAggregates: item.contributorAggregates,
      date: item.date,
      memberOf: item.wpVersion ?? undefined,
      isSpecialMarker: item.isLastBeforeWPBeta,
      changelogUrl: item.changelogUrl,
    };
  });
}
