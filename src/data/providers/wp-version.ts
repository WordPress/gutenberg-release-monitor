/**
 * WP Version Stats data provider.
 * Converts WPVersionStats (aggregated by WP version) to NormalizedRelease.
 */

import type { WPVersionStats } from '../types';
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
 * Converts WPVersionStats array to NormalizedRelease array.
 * This is an aggregated data provider - items group multiple releases.
 */
export function normalizeWPVersionStats(
  data: WPVersionStats[],
  displayPrefix: string
): NormalizedRelease[] {
  return data.map((item): NormalizedRelease => {
    const version = item.wpVersion;
    const displayVersion = formatVersionForDisplay(version);

    // Totals
    const totalPRs = item.totalPRs ?? 0;
    const contributors = item.totalContributors ?? 0;
    const newContributors = item.totalNewContributors ?? 0;

    // Pre-computed averages
    const avgPRs = item.avgPRsPerRelease ?? 0;
    const avgContributors = item.avgContributorsPerRelease ?? 0;
    const avgNewContributors = item.avgNewContributorsPerRelease ?? 0;

    return {
      id: version,
      version,
      displayVersion,
      displayLabel: `${displayPrefix} ${displayVersion}`,
      isAggregated: true,
      totalPRs,
      contributors,
      newContributors,
      hasContributorData: contributors > 0,
      avgPRs,
      avgContributors,
      avgNewContributors,
      categoryTotals: item.categoryTotals,
      contributorAggregates: item.contributorAggregates,
      groupedCount: item.releaseCount,
      groupedRange: item.gbVersionRange,
    };
  });
}
