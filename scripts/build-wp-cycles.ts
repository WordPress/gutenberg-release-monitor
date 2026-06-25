/**
 * Builds wp-cycles.json and summary.json from gb-releases.json.
 * Groups Gutenberg releases by WordPress version and computes aggregate statistics.
 *
 * Usage:
 *   npm run data-sync:wp-cycles  # Regenerate wp-cycles.json and summary.json
 *
 * @module scripts/build-wp-cycles
 */

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Release, WPRelease } from './types.js';
import type { NormalizedRelease, SourceSummary } from '../src/data/normalized.js';
import { loadCategoryConfig, getAggregatedPRs } from './utils/category-utils.js';
import { writeJsonIfChanged } from './utils/file-utils.js';
import {
  loadReleases as loadReleasesFromFile,
  loadWPSchedule as loadWPScheduleFromFile,
  toNormalizedRelease,
  compareVersions,
  getMinorVersion,
} from './utils/release-utils.js';
import { getVersionPrefixForEndpoint } from './utils/config-utils.js';

const RELEASES_PATH = 'public/data/gb-releases.json';
const WP_SCHEDULE_PATH = 'scripts/data/wp-schedule.json';
const OUTPUT_DIR = 'public/data';

/**
 * Load releases from the default path.
 */
function loadReleases(): Release[] {
  return loadReleasesFromFile(RELEASES_PATH);
}

/**
 * Load WP schedule from the default path.
 */
function loadWPSchedule(): WPRelease[] {
  return loadWPScheduleFromFile(WP_SCHEDULE_PATH);
}

/**
 * Find which WP version a GB release belongs to.
 */
export function findWPVersion(gbVersion: string, wpSchedule: WPRelease[]): string | null {
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
export function enrichReleases(releases: Release[], wpSchedule: WPRelease[]): Release[] {
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
 * Generate per-WP-version aggregated statistics in NormalizedRelease format.
 */
export function generateWPVersionStats(releases: Release[]): NormalizedRelease[] {
  const categoryConfig = loadCategoryConfig();
  const wpVersionPrefix = getVersionPrefixForEndpoint('wp-cycles.json');
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

    stats.push({
      id: wpVersion,
      version: wpVersion,
      displayLabel: `${wpVersionPrefix} ${wpVersion}`,
      isAggregated: true,
      totalPRs,
      contributors: totalContributors,
      newContributors: totalNewContributors,
      hasContributorData: totalContributors > 0,
      avgPRs: Math.round(totalPRs / releaseCount),
      avgContributors: avgContributorsPerRelease,
      avgNewContributors: avgNewContributorsPerRelease,
      categoryTotals,
      contributorAggregates: undefined,
      groupedCount: releaseCount,
      groupedRange: gbVersionRange,
      aiPRs: undefined,
      aiBreakdown: undefined,
    });
  }

  // Sort by WP version (newest first)
  return stats.sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Load existing WP cycles if they exist.
 */
function loadExistingWPCycles(): NormalizedRelease[] {
  const wpCyclesPath = `${OUTPUT_DIR}/wp-cycles.json`;
  if (!existsSync(wpCyclesPath)) {
    return [];
  }
  try {
    const content = readFileSync(wpCyclesPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export function preserveContributorAggregates(
  wpVersionStats: NormalizedRelease[],
  existingWPCycles: NormalizedRelease[]
): NormalizedRelease[] {
  const existingCyclesMap = new Map(existingWPCycles.map((cycle) => [cycle.version, cycle]));

  return wpVersionStats.map((stat) => {
    const existingCycle = existingCyclesMap.get(stat.version);
    return {
      ...stat,
      contributorAggregates: existingCycle?.contributorAggregates,
      aiPRs: existingCycle?.aiPRs,
      aiBreakdown: existingCycle?.aiBreakdown,
    };
  });
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

  const summaryValues = {
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
  };

  // Check if any summary value changed, including schedule-driven cutoff changes.
  const dataChanged =
    !existingSummary ||
    Object.entries(summaryValues).some(
      ([key, value]) => existingSummary[key as keyof typeof summaryValues] !== value
    );

  return {
    ...summaryValues,
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

  // Convert to NormalizedRelease format and write gb-releases.json
  const normalizedReleases = enrichedReleases.map((r) => toNormalizedRelease(r, 'gb-releases.json'));
  const releasesWritten = writeJsonIfChanged(RELEASES_PATH, normalizedReleases);
  console.log(releasesWritten ? `  Updated ${RELEASES_PATH}` : `  No changes to ${RELEASES_PATH}`);

  // Generate aggregated stats
  console.log('\nGenerating aggregated statistics...');

  const existingWPCycles = loadExistingWPCycles();
  const wpVersionStats = preserveContributorAggregates(
    generateWPVersionStats(enrichedReleases),
    existingWPCycles
  );

  const wpVersionWritten = writeJsonIfChanged(`${OUTPUT_DIR}/wp-cycles.json`, wpVersionStats);
  const preservedCount = wpVersionStats.filter((s) => s.contributorAggregates).length;
  console.log(
    wpVersionWritten
      ? `  Generated wp-cycles.json (${wpVersionStats.length} WP versions, ${preservedCount} with contributor data)`
      : `  No changes to wp-cycles.json (${wpVersionStats.length} WP versions, ${preservedCount} with contributor data)`
  );

  const existingSummary = loadExistingSummary();
  const summary = generateSummary(enrichedReleases, wpSchedule, existingSummary);
  const summaryWritten = writeJsonIfChanged(`${OUTPUT_DIR}/summary.json`, summary);
  console.log(summaryWritten ? `  Generated summary.json` : `  No changes to summary.json`);

  console.log('\nAggregation complete!');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
