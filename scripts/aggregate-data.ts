/**
 * Data aggregation script for Gutenberg release statistics.
 * Computes per-WP-version aggregates and overall summary from releases.json.
 *
 * Outputs NormalizedRelease format for UI consumption.
 *
 * Usage:
 *   npm run aggregate  # Regenerate summary.json and by-wp-version.json
 *
 * @module scripts/aggregate-data
 */

import { readFileSync, existsSync } from 'node:fs';
import type { Release, WPRelease } from './types.js';
import type { NormalizedRelease, SourceSummary } from '../src/data/normalized.js';
import { loadCategoryConfig, getAggregatedPRs } from './utils/category-utils.js';
import { writeJsonIfChanged } from './utils/file-utils.js';

const RELEASES_PATH = 'public/data/releases.json';
const WP_SCHEDULE_PATH = 'scripts/data/wp-schedule.json';
const OUTPUT_DIR = 'public/data';

/**
 * Extended NormalizedRelease with contributor lists for internal script use.
 */
type NormalizedReleaseWithContributors = NormalizedRelease & {
  contributorsList?: string[];
  newContributorsList?: string[];
};

/**
 * Load releases from JSON file (can be either internal or normalized format).
 */
function loadReleases(): Release[] {
  const content = readFileSync(RELEASES_PATH, 'utf-8');
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
    contributorsList: r.contributorsList as string[] || [],
    newContributorsList: r.newContributorsList as string[] || [],
    contributorAggregates: r.contributorAggregates as Release['contributorAggregates'],
    changelogUrl: r.changelogUrl as string,
    parsedAt: r.parsedAt as string || '',
    parserVersion: r.parserVersion as string || '',
  }));
}

/**
 * Load WP release schedule.
 */
function loadWPSchedule(): WPRelease[] {
  const content = readFileSync(WP_SCHEDULE_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Compare two semver version strings.
 */
function compareVersions(a: string, b: string): number {
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
function getMinorVersion(version: string): string {
  const parts = version.split('.');
  return `${parts[0]}.${parts[1] || '0'}`;
}

/**
 * Find which WP version a GB release belongs to.
 */
function findWPVersion(gbVersion: string, wpSchedule: WPRelease[]): string | null {
  const minorVersion = getMinorVersion(gbVersion);

  for (const wpRelease of wpSchedule) {
    const [startVersion, endVersion] = wpRelease.gbVersionRange.split('-');

    if (
      compareVersions(minorVersion, startVersion) >= 0 &&
      compareVersions(minorVersion, endVersion) <= 0
    ) {
      return wpRelease.wpVersion;
    }
  }
  return null;
}

/**
 * Map GB releases to WP versions and mark beta cutoffs.
 */
function enrichReleases(releases: Release[], wpSchedule: WPRelease[]): Release[] {
  return releases.map((release) => {
    const minorVersion = getMinorVersion(release.gbVersion);
    const wpVersion = findWPVersion(release.gbVersion, wpSchedule);
    const matchingWP = wpSchedule.find((wp) => wp.lastGBVersion === minorVersion);
    const isLastBeforeWPBeta = !!matchingWP;

    return {
      ...release,
      wpVersion,
      isLastBeforeWPBeta,
    };
  });
}

/**
 * Convert internal Release to NormalizedRelease format.
 */
function toNormalizedRelease(release: Release): NormalizedReleaseWithContributors {
  const version = getMinorVersion(release.gbVersion);

  return {
    id: version,
    version,
    displayLabel: `Gutenberg ${version}`,
    isAggregated: false,
    totalPRs: release.totalPRs,
    contributors: release.contributors,
    newContributors: release.newContributors,
    hasContributorData: release.contributors > 0,
    avgPRs: release.totalPRs,
    avgContributors: release.contributors,
    avgNewContributors: release.newContributors,
    rawCategories: release.categories,
    contributorAggregates: release.contributorAggregates ? {
      sponsorBreakdown: release.contributorAggregates.sponsorBreakdown,
      countryBreakdown: release.contributorAggregates.countryBreakdown,
    } : undefined,
    date: release.date,
    memberOf: release.wpVersion || undefined,
    isSpecialMarker: release.isLastBeforeWPBeta || undefined,
    changelogUrl: release.changelogUrl,
    // Include for script use
    contributorsList: release.contributorsList,
    newContributorsList: release.newContributorsList,
  };
}

/**
 * Generate per-WP-version aggregated statistics in NormalizedRelease format.
 */
function generateWPVersionStats(releases: Release[]): NormalizedRelease[] {
  const categoryConfig = loadCategoryConfig();
  const byWPVersion = new Map<string, Release[]>();

  // Group releases by WP version
  for (const release of releases) {
    if (release.wpVersion) {
      const existing = byWPVersion.get(release.wpVersion) || [];
      existing.push(release);
      byWPVersion.set(release.wpVersion, existing);
    }
  }

  // Calculate stats for each WP version
  const stats: NormalizedRelease[] = [];
  for (const [wpVersion, wpReleases] of byWPVersion) {
    const versions = wpReleases.map((r) => getMinorVersion(r.gbVersion)).sort((a, b) => compareVersions(a, b));
    const gbVersionRange = `${versions[0]}-${versions[versions.length - 1]}`;

    const totalPRs = wpReleases.reduce((sum, r) => sum + r.totalPRs, 0);

    // Deduplicate contributors across all releases in this WP version
    const allContributors = new Set<string>();
    const allNewContributors = new Set<string>();
    for (const release of wpReleases) {
      for (const c of release.contributorsList || []) allContributors.add(c);
      for (const c of release.newContributorsList || []) allNewContributors.add(c);
    }
    const totalContributors = allContributors.size;
    const totalNewContributors = allNewContributors.size;

    // Compute category totals dynamically from config
    const categoryTotals: Record<string, number> = {};
    for (const agg of categoryConfig.aggregations) {
      categoryTotals[agg.id] = wpReleases.reduce(
        (sum, r) => sum + getAggregatedPRs(r, agg.id),
        0
      );
    }

    const releaseCount = wpReleases.length;

    // Calculate average contributors per release (sum-based, not deduplicated)
    const avgContributorsPerRelease = Math.round(
      wpReleases.reduce((sum, r) => sum + r.contributors, 0) / releaseCount
    );
    const avgNewContributorsPerRelease = Math.round(
      wpReleases.reduce((sum, r) => sum + r.newContributors, 0) / releaseCount
    );

    // Aggregate sponsor and country breakdowns from all releases
    const sponsorBreakdown: Record<string, number> = {};
    const countryBreakdown: Record<string, number> = {};
    let hasAggregates = false;

    for (const release of wpReleases) {
      if (release.contributorAggregates) {
        hasAggregates = true;
        for (const [sponsor, count] of Object.entries(release.contributorAggregates.sponsorBreakdown || {})) {
          sponsorBreakdown[sponsor] = (sponsorBreakdown[sponsor] || 0) + count;
        }
        for (const [country, count] of Object.entries(release.contributorAggregates.countryBreakdown || {})) {
          countryBreakdown[country] = (countryBreakdown[country] || 0) + count;
        }
      }
    }

    // Sort breakdowns by count (descending)
    const sortByValue = (obj: Record<string, number>) =>
      Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));

    stats.push({
      id: wpVersion,
      version: wpVersion,
      displayLabel: `WordPress ${wpVersion}`,
      isAggregated: true,
      totalPRs,
      contributors: totalContributors,
      newContributors: totalNewContributors,
      hasContributorData: totalContributors > 0,
      avgPRs: Math.round(totalPRs / releaseCount),
      avgContributors: avgContributorsPerRelease,
      avgNewContributors: avgNewContributorsPerRelease,
      categoryTotals,
      contributorAggregates: hasAggregates ? {
        sponsorBreakdown: sortByValue(sponsorBreakdown),
        countryBreakdown: sortByValue(countryBreakdown),
      } : undefined,
      groupedCount: releaseCount,
      groupedRange: gbVersionRange,
    });
  }

  // Sort by WP version (newest first)
  return stats.sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Load existing summary if it exists.
 */
function loadExistingSummary(): SourceSummary | null {
  const summaryPath = `${OUTPUT_DIR}/summary.json`;
  if (!existsSync(summaryPath)) {
    return null;
  }
  try {
    const content = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Find the current WP cycle based on the cutoff version.
 */
function findCurrentWPCycle(cutoffVersion: string, wpSchedule: WPRelease[]): string {
  const minorVersion = getMinorVersion(cutoffVersion);
  const cutoffWP = wpSchedule.find((wp) => wp.lastGBVersion === minorVersion);
  if (!cutoffWP) return '';

  const sortedSchedule = [...wpSchedule].sort((a, b) => compareVersions(b.wpVersion, a.wpVersion));
  const cutoffIndex = sortedSchedule.findIndex((wp) => wp.wpVersion === cutoffWP.wpVersion);

  return cutoffIndex > 0 ? sortedSchedule[cutoffIndex - 1].wpVersion : '';
}

/**
 * Generate summary statistics in SourceSummary format.
 */
function generateSummary(
  releases: Release[],
  wpSchedule: WPRelease[],
  existingSummary: SourceSummary | null
): SourceSummary {
  const sortedReleases = [...releases].sort((a, b) => compareVersions(b.gbVersion, a.gbVersion));

  const totalReleases = releases.length;
  const latestRelease = getMinorVersion(sortedReleases[0]?.gbVersion ?? '');

  // Find the last cutoff release (most recent isLastBeforeWPBeta)
  const lastCutoffIndex = sortedReleases.findIndex((r) => r.isLastBeforeWPBeta);
  const lastCutoffRelease = lastCutoffIndex >= 0 ? sortedReleases[lastCutoffIndex] : null;
  const lastCutoffVersion = lastCutoffRelease ? getMinorVersion(lastCutoffRelease.gbVersion) : '';

  // Find current WP cycle
  const currentWPCycle = findCurrentWPCycle(lastCutoffVersion, wpSchedule);

  // Releases since cutoff (excluding the cutoff itself)
  const releasesSinceCutoff = lastCutoffIndex >= 0 ? lastCutoffIndex : 0;
  const sinceCutoffReleases = sortedReleases.slice(0, releasesSinceCutoff);

  // Calculate totals since cutoff
  const totalPRsSinceCutoff = sinceCutoffReleases.reduce((sum, r) => sum + r.totalPRs, 0);

  // Calculate unique contributors across all releases in cycle (deduplicated)
  const allContributors = new Set<string>();
  const allNewContributors = new Set<string>();
  for (const release of sinceCutoffReleases) {
    for (const c of release.contributorsList || []) allContributors.add(c);
    for (const c of release.newContributorsList || []) allNewContributors.add(c);
  }
  const uniqueContributorsSinceCutoff = allContributors.size;
  const uniqueNewContributorsSinceCutoff = allNewContributors.size;

  // Calculate averages since cutoff
  const sinceCutoffCount = sinceCutoffReleases.length || 1;
  const avgPRsSinceCutoff = Math.round(totalPRsSinceCutoff / sinceCutoffCount);
  const avgContributorsSinceCutoff = Math.round(
    sinceCutoffReleases.reduce((sum, r) => sum + r.contributors, 0) / sinceCutoffCount
  );
  const avgNewContributorsSinceCutoff = Math.round(
    sinceCutoffReleases.reduce((sum, r) => sum + r.newContributors, 0) / sinceCutoffCount
  );

  // Calculate total averages (all-time)
  const avgPRsTotal = Math.round(releases.reduce((sum, r) => sum + r.totalPRs, 0) / totalReleases);

  // Contributors data only exists in newer releases
  const releasesWithContributors = releases.filter((r) => r.contributors > 0);
  const contributorCount = releasesWithContributors.length || 1;
  const avgContributorsTotal = Math.round(
    releasesWithContributors.reduce((sum, r) => sum + r.contributors, 0) / contributorCount
  );
  const avgNewContributorsTotal = Math.round(
    releasesWithContributors.reduce((sum, r) => sum + r.newContributors, 0) / contributorCount
  );

  // Check if data actually changed
  const dataChanged =
    !existingSummary ||
    existingSummary.totalReleases !== totalReleases ||
    existingSummary.latestRelease !== latestRelease;

  return {
    currentPeriod: currentWPCycle,
    lastCutoffVersion,
    releasesSinceCutoff,
    avgPRsSinceCutoff,
    avgContributorsSinceCutoff,
    avgNewContributorsSinceCutoff,
    totalPRsSinceCutoff,
    uniqueContributorsSinceCutoff,
    uniqueNewContributorsSinceCutoff,
    avgPRsTotal,
    avgContributorsTotal,
    avgNewContributorsTotal,
    latestRelease,
    oldestRelease: getMinorVersion(sortedReleases[sortedReleases.length - 1]?.gbVersion ?? ''),
    totalReleases,
    lastUpdated: dataChanged ? new Date().toISOString() : existingSummary.lastUpdated,
  };
}

async function main() {
  console.log('Gutenberg Release Aggregator');
  console.log('============================');

  // Load data
  console.log('\nLoading releases...');
  const releases = loadReleases();
  console.log(`  Found ${releases.length} releases`);

  console.log('Loading WP schedule...');
  const wpSchedule = loadWPSchedule();
  console.log(`  Found ${wpSchedule.length} WP versions`);

  // Enrich releases with WP version info
  console.log('\nMapping GB versions to WP versions...');
  const enrichedReleases = enrichReleases(releases, wpSchedule);
  const mappedCount = enrichedReleases.filter((r) => r.wpVersion).length;
  const betaCutoffs = enrichedReleases.filter((r) => r.isLastBeforeWPBeta).length;
  console.log(`  Mapped ${mappedCount}/${enrichedReleases.length} releases to WP versions`);
  console.log(`  Marked ${betaCutoffs} beta cutoff releases`);

  // Convert to NormalizedRelease format and write releases.json
  const normalizedReleases = enrichedReleases.map(toNormalizedRelease);
  const releasesWritten = writeJsonIfChanged(RELEASES_PATH, normalizedReleases);
  console.log(releasesWritten ? `  Updated ${RELEASES_PATH}` : `  No changes to ${RELEASES_PATH}`);

  // Generate aggregated stats
  console.log('\nGenerating aggregated statistics...');

  const wpVersionStats = generateWPVersionStats(enrichedReleases);
  const wpVersionWritten = writeJsonIfChanged(`${OUTPUT_DIR}/by-wp-version.json`, wpVersionStats);
  console.log(
    wpVersionWritten
      ? `  Generated by-wp-version.json (${wpVersionStats.length} WP versions)`
      : `  No changes to by-wp-version.json (${wpVersionStats.length} WP versions)`
  );

  const existingSummary = loadExistingSummary();
  const summary = generateSummary(enrichedReleases, wpSchedule, existingSummary);
  const summaryWritten = writeJsonIfChanged(`${OUTPUT_DIR}/summary.json`, summary);
  console.log(summaryWritten ? `  Generated summary.json` : `  No changes to summary.json`);

  // Generate time series data
  const categoryConfig = loadCategoryConfig();
  const timeSeries = enrichedReleases
    .map((r) => {
      const categoryPRs: Record<string, number> = {};
      for (const agg of categoryConfig.aggregations) {
        categoryPRs[agg.id] = getAggregatedPRs(r, agg.id);
      }
      return {
        gbVersion: getMinorVersion(r.gbVersion),
        date: r.date,
        totalPRs: r.totalPRs,
        categoryPRs,
        isLastBeforeWPBeta: r.isLastBeforeWPBeta,
        wpVersion: r.wpVersion,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const timeSeriesWritten = writeJsonIfChanged(`${OUTPUT_DIR}/time-series.json`, timeSeries);
  console.log(
    timeSeriesWritten
      ? `  Generated time-series.json (${timeSeries.length} data points)`
      : `  No changes to time-series.json (${timeSeries.length} data points)`
  );

  console.log('\nAggregation complete!');
}

main();
