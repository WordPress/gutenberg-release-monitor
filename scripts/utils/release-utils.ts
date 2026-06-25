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
 * Check if a version is a patch release (not x.y.0).
 * e.g., "21.1.1" -> true, "21.1.0" -> false, "21.1" -> false
 */
export function isPatchRelease(version: string): boolean {
  const cleanVersion = version.replace(/^v/, '');
  const parts = cleanVersion.split('.');
  const patch = parseInt(parts[2] ?? '0', 10);
  return patch > 0;
}

/**
 * Merge AI breakdowns from several releases, summing per-tool, nonAgent, and
 * agent counts. Returns undefined when none of the releases carry AI data.
 */
function mergeAIBreakdowns(releases: Release[]): Release['aiBreakdown'] {
  const byTool: Record<string, number> = {};
  let nonAgent = 0;
  let agent = 0;
  let found = false;
  for (const release of releases) {
    const breakdown = release.aiBreakdown;
    if (!breakdown) continue;
    found = true;
    for (const [tool, count] of Object.entries(breakdown.byTool)) {
      byTool[tool] = (byTool[tool] || 0) + count;
    }
    nonAgent += breakdown.nonAgent;
    agent += breakdown.agent;
  }
  return found ? { byTool, nonAgent, agent } : undefined;
}

/**
 * Aggregate patch releases into their minor version.
 * e.g., 20.1.0, 20.1.1, 20.1.2 -> single 20.1 with combined PRs and contributors
 *
 * @param releases - Array of Release objects (may include patch versions)
 * @returns Array with patch releases merged into their base minor version
 */
export function aggregatePatchReleases(releases: Release[]): Release[] {
  const minorVersionMap = new Map<string, Release[]>();

  // Group releases by minor version
  for (const release of releases) {
    const minorVersion = getMinorVersion(release.gbVersion);
    const existing = minorVersionMap.get(minorVersion) || [];
    existing.push(release);
    minorVersionMap.set(minorVersion, existing);
  }

  // Aggregate each group
  const aggregated: Release[] = [];
  for (const [minorVersion, group] of minorVersionMap) {
    // Find the base release (x.y.0) or use the first one
    const baseRelease = group.find((r) => !isPatchRelease(r.gbVersion)) || group[0];

    // If there's only one release and it's the base, no aggregation needed
    if (group.length === 1) {
      // Normalize version to x.y format
      aggregated.push({
        ...baseRelease,
        gbVersion: minorVersion,
      });
      continue;
    }

    // Find patch releases to add (excluding the base release to avoid double counting)
    const patchReleases = group.filter((r) => r !== baseRelease && isPatchRelease(r.gbVersion));

    if (patchReleases.length === 0) {
      aggregated.push({
        ...baseRelease,
        gbVersion: minorVersion,
      });
      continue;
    }

    // Aggregate PR counts from patch releases into the base
    const totalPRs = baseRelease.totalPRs + patchReleases.reduce((sum, r) => sum + r.totalPRs, 0);

    // Merge categories from all releases
    const categories: Record<string, number> = { ...(baseRelease.categories || {}) };
    for (const patch of patchReleases) {
      for (const [cat, count] of Object.entries(patch.categories || {})) {
        categories[cat] = (categories[cat] || 0) + count;
      }
    }

    // Combine contributor lists and deduplicate
    const allContributors = new Set<string>(baseRelease.contributorsList || []);
    const allNewContributors = new Set<string>(baseRelease.newContributorsList || []);
    for (const patch of patchReleases) {
      for (const c of patch.contributorsList || []) allContributors.add(c);
      for (const c of patch.newContributorsList || []) allNewContributors.add(c);
    }
    const contributorsList = Array.from(allContributors);
    const newContributorsList = Array.from(allNewContributors);

    // Aggregate AI metrics (present only once build-ai-prs has injected them)
    const aiReleases = [baseRelease, ...patchReleases];
    const aiPRs = aiReleases.some((r) => r.aiPRs !== undefined)
      ? aiReleases.reduce((sum, r) => sum + (r.aiPRs ?? 0), 0)
      : undefined;

    aggregated.push({
      ...baseRelease,
      gbVersion: minorVersion, // Normalize to x.y format
      totalPRs,
      categories,
      contributors: contributorsList.length,
      newContributors: newContributorsList.length,
      contributorsList,
      newContributorsList,
      aiPRs,
      aiBreakdown: mergeAIBreakdowns(aiReleases),
    });
  }

  return aggregated;
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
    aiPRs: r.aiPRs as number | undefined,
    aiBreakdown: r.aiBreakdown as Release['aiBreakdown'],
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
    aiPRs: release.aiPRs,
    aiBreakdown: release.aiBreakdown,
    // Include for internal script use
    contributorsList: release.contributorsList,
    newContributorsList: release.newContributorsList,
  };
}
