import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import type { Release, WPRelease, WPVersionStats, Summary } from '../src/data/types.js';
import { loadCategoryConfig, getAggregatedPRs } from './utils/category-utils.js';
import { writeJsonIfChanged } from './utils/file-utils.js';

const RELEASES_PATH = 'public/data/releases.json';
const WP_SCHEDULE_PATH = 'public/data/wp-schedule.json';
const AGGREGATED_DIR = 'public/data/aggregated';

/**
 * Load releases from JSON file.
 */
function loadReleases(): Release[] {
  const content = readFileSync(RELEASES_PATH, 'utf-8');
  return JSON.parse(content);
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
 * Find which WP version a GB release belongs to.
 */
function findWPVersion(gbVersion: string, wpSchedule: WPRelease[]): string | null {
  // Parse GB version range from each WP release
  for (const wpRelease of wpSchedule) {
    const [startVersion, endVersion] = wpRelease.gbVersionRange.split('-');

    // Check if gbVersion falls within this range
    if (
      compareVersions(gbVersion, startVersion) >= 0 &&
      compareVersions(gbVersion, endVersion) <= 0
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
  const enriched = releases.map((release) => {
    const wpVersion = findWPVersion(release.gbVersion, wpSchedule);

    // Check if this is the last GB version before WP beta
    const matchingWP = wpSchedule.find((wp) => wp.lastGBVersion === release.gbVersion.replace('.0', ''));
    const isLastBeforeWPBeta = !!matchingWP;

    return {
      ...release,
      wpVersion,
      isLastBeforeWPBeta,
    };
  });

  return enriched;
}

/**
 * Generate per-WP-version aggregated statistics.
 */
function generateWPVersionStats(releases: Release[]): WPVersionStats[] {
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
  const stats: WPVersionStats[] = [];
  for (const [wpVersion, wpReleases] of byWPVersion) {
    const versions = wpReleases.map((r) => r.gbVersion).sort((a, b) => compareVersions(a, b));
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
      wpVersion,
      gbVersionRange,
      releaseCount,
      totalPRs,
      totalContributors,
      totalNewContributors,
      categoryTotals,
      avgPRsPerRelease: Math.round(totalPRs / releaseCount),
      avgContributorsPerRelease,
      avgNewContributorsPerRelease,
    });
  }

  // Sort by WP version (newest first)
  return stats.sort((a, b) => compareVersions(b.wpVersion, a.wpVersion));
}

/**
 * Load existing summary if it exists.
 */
function loadExistingSummary(): Summary | null {
  const summaryPath = `${AGGREGATED_DIR}/summary.json`;
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
  // Find the WP release where this cutoff belongs
  const cutoffWP = wpSchedule.find((wp) => wp.lastGBVersion === cutoffVersion.replace('.0', ''));
  if (!cutoffWP) return '';

  // The current cycle is the next WP version after the cutoff
  const sortedSchedule = [...wpSchedule].sort((a, b) => compareVersions(b.wpVersion, a.wpVersion));
  const cutoffIndex = sortedSchedule.findIndex((wp) => wp.wpVersion === cutoffWP.wpVersion);

  // Return the WP version before the cutoff in the sorted list (which is the next/current cycle)
  return cutoffIndex > 0 ? sortedSchedule[cutoffIndex - 1].wpVersion : '';
}

/**
 * Generate summary statistics.
 * Only updates timestamp if data actually changed.
 */
function generateSummary(releases: Release[], wpSchedule: WPRelease[], existingSummary: Summary | null): Summary {
  const sortedReleases = [...releases].sort((a, b) => compareVersions(b.gbVersion, a.gbVersion));

  const totalReleases = releases.length;
  const latestRelease = sortedReleases[0]?.gbVersion ?? '';

  // Find the last cutoff release (most recent isLastBeforeWPBeta)
  const lastCutoffIndex = sortedReleases.findIndex((r) => r.isLastBeforeWPBeta);
  const lastCutoffRelease = lastCutoffIndex >= 0 ? sortedReleases[lastCutoffIndex] : null;
  const lastCutoffVersion = lastCutoffRelease?.gbVersion ?? '';

  // Find current WP cycle
  const currentWPCycle = findCurrentWPCycle(lastCutoffVersion, wpSchedule);

  // Releases since cutoff (excluding the cutoff itself)
  const releasesSinceCutoff = lastCutoffIndex >= 0 ? lastCutoffIndex : 0;
  const sinceCutoffReleases = sortedReleases.slice(0, releasesSinceCutoff);

  // Calculate totals since cutoff
  const totalPRsSinceCutoff = sinceCutoffReleases.reduce((sum, r) => sum + r.totalPRs, 0);
  const totalFeaturesSinceCutoff = sinceCutoffReleases.reduce((sum, r) => sum + getAggregatedPRs(r, 'features'), 0);
  const totalBugsSinceCutoff = sinceCutoffReleases.reduce((sum, r) => sum + getAggregatedPRs(r, 'bugs'), 0);
  const totalA11ySinceCutoff = sinceCutoffReleases.reduce((sum, r) => sum + getAggregatedPRs(r, 'a11y'), 0);
  const totalPerfSinceCutoff = sinceCutoffReleases.reduce((sum, r) => sum + getAggregatedPRs(r, 'performance'), 0);

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
  const avgFeaturesSinceCutoff = Math.round(totalFeaturesSinceCutoff / sinceCutoffCount);
  const avgBugsSinceCutoff = Math.round(totalBugsSinceCutoff / sinceCutoffCount);
  const avgA11ySinceCutoff = Math.round(totalA11ySinceCutoff / sinceCutoffCount);
  const avgPerfSinceCutoff = Math.round(totalPerfSinceCutoff / sinceCutoffCount);
  const avgContributorsSinceCutoff = Math.round(
    sinceCutoffReleases.reduce((sum, r) => sum + r.contributors, 0) / sinceCutoffCount
  );
  const avgNewContributorsSinceCutoff = Math.round(
    sinceCutoffReleases.reduce((sum, r) => sum + r.newContributors, 0) / sinceCutoffCount
  );

  // Calculate total averages (all-time) - only from releases that have the data
  const avgPRsTotal = Math.round(releases.reduce((sum, r) => sum + r.totalPRs, 0) / totalReleases);
  const avgFeaturesTotal = Math.round(releases.reduce((sum, r) => sum + getAggregatedPRs(r, 'features'), 0) / totalReleases);
  const avgBugsTotal = Math.round(releases.reduce((sum, r) => sum + getAggregatedPRs(r, 'bugs'), 0) / totalReleases);

  // Code Quality data only exists in newer releases
  const releasesWithCodeQuality = releases.filter((r) => getAggregatedPRs(r, 'codeQuality') > 0);
  const codeQualityCount = releasesWithCodeQuality.length || 1;
  const avgCodeQualityTotal = Math.round(
    releasesWithCodeQuality.reduce((sum, r) => sum + getAggregatedPRs(r, 'codeQuality'), 0) / codeQualityCount
  );

  // A11y and performance data only exists in newer releases
  const releasesWithA11y = releases.filter((r) => getAggregatedPRs(r, 'a11y') > 0);
  const a11yCount = releasesWithA11y.length || 1;
  const avgA11yTotal = Math.round(
    releasesWithA11y.reduce((sum, r) => sum + getAggregatedPRs(r, 'a11y'), 0) / a11yCount
  );

  const releasesWithPerf = releases.filter((r) => getAggregatedPRs(r, 'performance') > 0);
  const perfCount = releasesWithPerf.length || 1;
  const avgPerfTotal = Math.round(
    releasesWithPerf.reduce((sum, r) => sum + getAggregatedPRs(r, 'performance'), 0) / perfCount
  );

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
    currentWPCycle,
    lastCutoffVersion,
    releasesSinceCutoff,
    avgPRsSinceCutoff,
    avgFeaturesSinceCutoff,
    avgBugsSinceCutoff,
    avgA11ySinceCutoff,
    avgPerfSinceCutoff,
    avgContributorsSinceCutoff,
    avgNewContributorsSinceCutoff,
    totalPRsSinceCutoff,
    totalFeaturesSinceCutoff,
    totalBugsSinceCutoff,
    totalA11ySinceCutoff,
    totalPerfSinceCutoff,
    uniqueContributorsSinceCutoff,
    uniqueNewContributorsSinceCutoff,
    avgPRsTotal,
    avgFeaturesTotal,
    avgBugsTotal,
    avgCodeQualityTotal,
    avgA11yTotal,
    avgPerfTotal,
    avgContributorsTotal,
    avgNewContributorsTotal,
    latestRelease,
    oldestRelease: sortedReleases[sortedReleases.length - 1]?.gbVersion ?? '',
    totalReleases,
    lastUpdated: dataChanged ? new Date().toISOString() : existingSummary.lastUpdated,
  };
}

async function main() {
  console.log('Gutenberg Release Aggregator');
  console.log('============================');

  // Ensure output directory exists
  if (!existsSync(AGGREGATED_DIR)) {
    mkdirSync(AGGREGATED_DIR, { recursive: true });
  }

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

  // Update releases.json with enriched data (only if changed)
  const releasesWritten = writeJsonIfChanged(RELEASES_PATH, enrichedReleases);
  console.log(releasesWritten ? `  Updated ${RELEASES_PATH}` : `  No changes to ${RELEASES_PATH}`);

  // Generate aggregated stats
  console.log('\nGenerating aggregated statistics...');

  const wpVersionStats = generateWPVersionStats(enrichedReleases);
  const wpVersionWritten = writeJsonIfChanged(`${AGGREGATED_DIR}/by-wp-version.json`, wpVersionStats);
  console.log(
    wpVersionWritten
      ? `  Generated by-wp-version.json (${wpVersionStats.length} WP versions)`
      : `  No changes to by-wp-version.json (${wpVersionStats.length} WP versions)`
  );

  const existingSummary = loadExistingSummary();
  const summary = generateSummary(enrichedReleases, wpSchedule, existingSummary);
  const summaryWritten = writeJsonIfChanged(`${AGGREGATED_DIR}/summary.json`, summary);
  console.log(summaryWritten ? `  Generated summary.json` : `  No changes to summary.json`);

  // Generate time series data (just the releases sorted by date)
  const categoryConfig = loadCategoryConfig();
  const timeSeries = enrichedReleases
    .map((r) => {
      const categoryPRs: Record<string, number> = {};
      for (const agg of categoryConfig.aggregations) {
        categoryPRs[agg.id] = getAggregatedPRs(r, agg.id);
      }
      return {
        gbVersion: r.gbVersion,
        date: r.date,
        totalPRs: r.totalPRs,
        categoryPRs,
        isLastBeforeWPBeta: r.isLastBeforeWPBeta,
        wpVersion: r.wpVersion,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const timeSeriesWritten = writeJsonIfChanged(`${AGGREGATED_DIR}/time-series.json`, timeSeries);
  console.log(
    timeSeriesWritten
      ? `  Generated time-series.json (${timeSeries.length} data points)`
      : `  No changes to time-series.json (${timeSeries.length} data points)`
  );

  console.log('\nAggregation complete!');
}

main();
