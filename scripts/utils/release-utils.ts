/**
 * Shared release utilities for scripts.
 * Consolidates common functions used across parse-changelog, aggregate-data, and compute-release-aggregates.
 * @module scripts/utils/release-utils
 */

import { readFileSync, existsSync } from 'node:fs';
import type { Release, WPRelease } from '../types.js';
import type { NormalizedRelease } from '../../src/data/normalized.js';
import { getVersionPrefixForEndpoint } from './config-utils.js';

const WP_SCHEDULE_PATH = 'scripts/data/wp-schedule.json';

/**
 * Extended NormalizedRelease with contributor lists for internal script use.
 * These fields are preserved during processing but not part of the public output.
 */
export type NormalizedReleaseWithContributors = NormalizedRelease & {
  contributorsList?: string[];
  newContributorsList?: string[];
};

/**
 * Compare two semver version strings.
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Extract minor version from a version string (e.g., "20.1.0" -> "20.1").
 */
export function getMinorVersion(version: string): string {
  const parts = version.split('.');
  return `${parts[0]}.${parts[1] || '0'}`;
}

/**
 * Load releases from JSON file.
 * Handles both normalized format (version, memberOf) and internal format (gbVersion, wpVersion).
 * This provides backward compatibility during the transition period.
 *
 * @param releasesPath - Path to the releases JSON file
 * @returns Array of Release objects in internal format
 */
export function loadReleases(releasesPath: string): Release[] {
  if (!existsSync(releasesPath)) {
    console.warn(`⚠️  Releases file not found: ${releasesPath}`);
    return [];
  }

  const content = readFileSync(releasesPath, 'utf-8');
  const data = JSON.parse(content);

  // Handle both normalized format (version field) and internal format (gbVersion field)
  return data.map((r: Record<string, unknown>) => ({
    gbVersion: (r.version as string) || (r.gbVersion as string),
    wpVersion: (r.memberOf as string) || (r.wpVersion as string) || null,
    date: r.date as string,
    isLastBeforeWPBeta: (r.isSpecialMarker as boolean) || (r.isLastBeforeWPBeta as boolean) || false,
    totalPRs: r.totalPRs as number,
    categories: (r.rawCategories as Record<string, number>) || (r.categories as Record<string, number>) || {},
    contributors: r.contributors as number,
    newContributors: r.newContributors as number,
    contributorsList: (r.contributorsList as string[]) || [],
    newContributorsList: (r.newContributorsList as string[]) || [],
    contributorAggregates: r.contributorAggregates as Release['contributorAggregates'],
    changelogUrl: r.changelogUrl as string,
    parsedAt: (r.parsedAt as string) || '',
    parserVersion: (r.parserVersion as string) || '',
  }));
}

/**
 * Load WP release schedule from JSON file.
 *
 * @param schedulePath - Optional custom path (defaults to scripts/data/wp-schedule.json)
 * @returns Array of WPRelease objects
 */
export function loadWPSchedule(schedulePath: string = WP_SCHEDULE_PATH): WPRelease[] {
  if (!existsSync(schedulePath)) {
    console.warn('⚠️  WP schedule file not found');
    return [];
  }

  const content = readFileSync(schedulePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Convert internal Release to NormalizedRelease format for JSON output.
 * Uses config-driven labels based on the target data endpoint.
 *
 * @param release - Internal Release object
 * @param dataEndpoint - Target endpoint for label lookup (e.g., 'gb-releases.json')
 * @returns NormalizedRelease with contributor lists for internal use
 */
export function toNormalizedRelease(
  release: Release,
  dataEndpoint: string = 'gb-releases.json'
): NormalizedReleaseWithContributors {
  const version = getMinorVersion(release.gbVersion);
  const labelPrefix = getVersionPrefixForEndpoint(dataEndpoint);

  return {
    id: version,
    version,
    displayLabel: `${labelPrefix} ${version}`,
    isAggregated: false,
    totalPRs: release.totalPRs,
    contributors: release.contributors,
    newContributors: release.newContributors,
    hasContributorData: release.contributors > 0,
    avgPRs: release.totalPRs,
    avgContributors: release.contributors,
    avgNewContributors: release.newContributors,
    rawCategories: release.categories,
    contributorAggregates: release.contributorAggregates
      ? {
          sponsorBreakdown: release.contributorAggregates.sponsorBreakdown,
          countryBreakdown: release.contributorAggregates.countryBreakdown,
        }
      : undefined,
    date: release.date,
    memberOf: release.wpVersion || undefined,
    isSpecialMarker: release.isLastBeforeWPBeta || undefined,
    changelogUrl: release.changelogUrl,
    // Include for internal script use
    contributorsList: release.contributorsList,
    newContributorsList: release.newContributorsList,
  };
}
