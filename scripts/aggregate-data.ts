import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { Release, WPRelease, WPVersionStats, Summary } from '../src/data/types.js';

const RELEASES_PATH = 'data/releases.json';
const WP_SCHEDULE_PATH = 'data/wp-schedule.json';
const AGGREGATED_DIR = 'data/aggregated';

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
    const totalFeaturePRs = wpReleases.reduce((sum, r) => sum + r.featurePRs, 0);
    const totalBugPRs = wpReleases.reduce((sum, r) => sum + r.bugPRs, 0);
    const totalA11yPRs = wpReleases.reduce((sum, r) => sum + r.a11yPRs, 0);
    const totalPerformancePRs = wpReleases.reduce((sum, r) => sum + r.performancePRs, 0);
    const totalContributors = wpReleases.reduce((sum, r) => sum + r.contributors, 0);
    const totalNewContributors = wpReleases.reduce((sum, r) => sum + r.newContributors, 0);

    const releaseCount = wpReleases.length;

    stats.push({
      wpVersion,
      gbVersionRange,
      releaseCount,
      totalPRs,
      totalFeaturePRs,
      totalBugPRs,
      totalA11yPRs,
      totalPerformancePRs,
      totalContributors,
      totalNewContributors,
      avgPRsPerRelease: Math.round(totalPRs / releaseCount),
      avgFeaturePRsPerRelease: Math.round(totalFeaturePRs / releaseCount),
      avgBugPRsPerRelease: Math.round(totalBugPRs / releaseCount),
      avgEnhancementPercent: Math.round((totalFeaturePRs / (totalPRs || 1)) * 100),
      avgBugfixPercent: Math.round((totalBugPRs / (totalPRs || 1)) * 100),
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
 * Generate summary statistics.
 * Only updates timestamp if data actually changed.
 */
function generateSummary(releases: Release[], existingSummary: Summary | null): Summary {
  const sortedReleases = [...releases].sort((a, b) => compareVersions(b.gbVersion, a.gbVersion));

  const totalReleases = releases.length;
  const totalPRs = releases.reduce((sum, r) => sum + r.totalPRs, 0);
  const latestRelease = sortedReleases[0]?.gbVersion ?? '';

  // Check if data actually changed
  const dataChanged =
    !existingSummary ||
    existingSummary.totalReleases !== totalReleases ||
    existingSummary.totalPRs !== totalPRs ||
    existingSummary.latestRelease !== latestRelease;

  return {
    totalReleases,
    totalPRs,
    totalContributors: releases.reduce((sum, r) => sum + r.contributors, 0),
    avgPRsPerRelease: Math.round(totalPRs / releases.length),
    latestRelease,
    oldestRelease: sortedReleases[sortedReleases.length - 1]?.gbVersion ?? '',
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

  // Update releases.json with enriched data
  writeFileSync(RELEASES_PATH, JSON.stringify(enrichedReleases, null, 2));
  console.log(`  Updated ${RELEASES_PATH}`);

  // Generate aggregated stats
  console.log('\nGenerating aggregated statistics...');

  const wpVersionStats = generateWPVersionStats(enrichedReleases);
  writeFileSync(
    `${AGGREGATED_DIR}/by-wp-version.json`,
    JSON.stringify(wpVersionStats, null, 2)
  );
  console.log(`  Generated by-wp-version.json (${wpVersionStats.length} WP versions)`);

  const existingSummary = loadExistingSummary();
  const summary = generateSummary(enrichedReleases, existingSummary);
  writeFileSync(`${AGGREGATED_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`  Generated summary.json`);

  // Generate time series data (just the releases sorted by date)
  const timeSeries = enrichedReleases
    .map((r) => ({
      gbVersion: r.gbVersion,
      date: r.date,
      totalPRs: r.totalPRs,
      featurePRs: r.featurePRs,
      bugPRs: r.bugPRs,
      a11yPRs: r.a11yPRs,
      performancePRs: r.performancePRs,
      isLastBeforeWPBeta: r.isLastBeforeWPBeta,
      wpVersion: r.wpVersion,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(`${AGGREGATED_DIR}/time-series.json`, JSON.stringify(timeSeries, null, 2));
  console.log(`  Generated time-series.json (${timeSeries.length} data points)`);

  console.log('\nAggregation complete!');
}

main();
