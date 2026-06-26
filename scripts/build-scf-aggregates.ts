/**
 * Builds scf-by-major.json and scf-summary.json from scf-releases.json.
 * Groups SCF releases by minor version and computes aggregate statistics.
 *
 * Usage:
 *   npm run build:scf
 *
 * @module scripts/build-scf-aggregates
 */

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { NormalizedRelease, SourceSummary } from '../src/data/normalized.js';
import { loadCategoryConfig, getAggregatedPRs } from './utils/category-utils.js';
import { writeJsonIfChanged } from './utils/file-utils.js';
import {
  loadReleases as loadReleasesFromFile,
  compareVersions,
  getMinorVersion,
} from './utils/release-utils.js';
import type { Release } from './types.js';

const RELEASES_PATH = 'public/data/scf/scf-releases.json';
const OUTPUT_DIR = 'public/data/scf';

function sumBreakdownValues(breakdown: Record<string, number> | undefined): number {
  return Object.values(breakdown || {}).reduce((sum, count) => sum + count, 0);
}

function hasValidContributorAggregates(release: NormalizedRelease): boolean {
  const aggregates = release.contributorAggregates;
  if (!aggregates) {
    return false;
  }

  return (
    sumBreakdownValues(aggregates.sponsorBreakdown) === release.contributors &&
    sumBreakdownValues(aggregates.countryBreakdown) === release.contributors
  );
}

/**
 * Load SCF releases from the JSON file.
 */
function loadReleases(): Release[] {
  if (!existsSync(RELEASES_PATH)) {
    console.error(`Error: ${RELEASES_PATH} not found. Run build-scf-milestones.ts first.`);
    process.exit(1);
  }
  return loadReleasesFromFile(RELEASES_PATH);
}

/**
 * Generate per-minor-version aggregated statistics.
 * Groups patch releases (6.7.0, 6.7.1, 6.7.2) into minor versions (6.7).
 */
export function generateMinorVersionStats(releases: Release[]): NormalizedRelease[] {
  const categoryConfig = loadCategoryConfig();
  const byMinorVersion = new Map<string, Release[]>();

  // Group releases by minor version
  for (const release of releases) {
    const minorVersion = getMinorVersion(release.gbVersion);
    const existing = byMinorVersion.get(minorVersion) || [];
    existing.push(release);
    byMinorVersion.set(minorVersion, existing);
  }

  // Calculate stats for each minor version
  const stats: NormalizedRelease[] = [];
  for (const [minorVersion, minorReleases] of byMinorVersion) {
    const totalPRs = minorReleases.reduce((sum, r) => sum + r.totalPRs, 0);
    const releaseCount = minorReleases.length;

    // Deduplicate contributors across all releases in this minor version
    const allContributors = new Set<string>();
    const allNewContributors = new Set<string>();
    for (const release of minorReleases) {
      for (const c of release.contributorsList || []) allContributors.add(c);
      for (const c of release.newContributorsList || []) allNewContributors.add(c);
    }
    const totalContributors = allContributors.size;
    const totalNewContributors = allNewContributors.size;

    // Compute category totals dynamically from config
    const categoryTotals: Record<string, number> = {};
    for (const agg of categoryConfig.aggregations) {
      categoryTotals[agg.id] = minorReleases.reduce(
        (sum, r) => sum + getAggregatedPRs(r, agg.id),
        0
      );
    }

    // Aggregate rawCategories from all releases (for UI compatibility)
    const rawCategories: Record<string, number> = {};
    for (const release of minorReleases) {
      for (const [category, count] of Object.entries(release.categories || {})) {
        rawCategories[category] = (rawCategories[category] || 0) + count;
      }
    }

    // Get the latest date from all releases in this minor version
    const latestDate = minorReleases
      .map((r) => r.date)
      .filter((d) => d)
      .sort()
      .pop() || '';

    const versions = minorReleases
      .map((release) => release.gbVersion)
      .sort((a, b) => compareVersions(a, b));

    stats.push({
      id: minorVersion,
      version: minorVersion,
      displayLabel: `SCF ${minorVersion}`,
      isAggregated: true,
      totalPRs,
      contributors: totalContributors,
      newContributors: totalNewContributors,
      hasContributorData: totalContributors > 0,
      avgPRs: Math.round(totalPRs / releaseCount),
      avgContributors: Math.round(
        minorReleases.reduce((sum, r) => sum + r.contributors, 0) / releaseCount
      ),
      avgNewContributors: Math.round(
        minorReleases.reduce((sum, r) => sum + r.newContributors, 0) / releaseCount
      ),
      rawCategories,
      categoryTotals,
      date: latestDate,
      groupedCount: releaseCount,
      groupedRange: `${versions[0]}-${versions[versions.length - 1]}`,
    });
  }

  // Sort by version (newest first)
  return stats.sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Load existing aggregated cycles if they exist (to preserve contributorAggregates).
 */
function loadExistingCycles(): NormalizedRelease[] {
  const cyclesPath = `${OUTPUT_DIR}/scf-by-major.json`;
  if (!existsSync(cyclesPath)) {
    return [];
  }
  try {
    const content = readFileSync(cyclesPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Load existing summary if it exists.
 */
function loadExistingSummary(): SourceSummary | null {
  const summaryPath = `${OUTPUT_DIR}/scf-summary.json`;
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
 * Generate summary statistics for SCF.
 */
function generateSummary(
  releases: Release[],
  aggregatedStats: NormalizedRelease[],
  existingSummary: SourceSummary | null
): SourceSummary {
  const sortedReleases = [...releases].sort((a, b) =>
    compareVersions(b.gbVersion, a.gbVersion)
  );

  const totalReleases = aggregatedStats.length; // Count minor versions
  const totalPatchReleases = releases.length;
  const latestRelease = getMinorVersion(sortedReleases[0]?.gbVersion ?? '');
  const oldestRelease = getMinorVersion(
    sortedReleases[sortedReleases.length - 1]?.gbVersion ?? ''
  );

  // Calculate totals
  const totalPRs = releases.reduce((sum, r) => sum + r.totalPRs, 0);
  const avgPRsTotal = Math.round(totalPRs / totalReleases);

  // Deduplicate contributors across all releases
  const allContributors = new Set<string>();
  for (const release of releases) {
    for (const c of release.contributorsList || []) allContributors.add(c);
  }
  const uniqueContributors = allContributors.size;

  // Calculate averages
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

  // SCF-specific summary (some fields not applicable)
  return {
    currentPeriod: latestRelease, // Current minor version
    lastCutoffVersion: '', // Not applicable for SCF
    releasesSinceCutoff: totalPatchReleases,
    avgPRsSinceCutoff: avgPRsTotal,
    avgContributorsSinceCutoff: avgContributorsTotal,
    avgNewContributorsSinceCutoff: avgNewContributorsTotal,
    totalPRsSinceCutoff: totalPRs,
    uniqueContributorsSinceCutoff: uniqueContributors,
    uniqueNewContributorsSinceCutoff: 0,
    avgPRsTotal,
    avgContributorsTotal,
    avgNewContributorsTotal,
    latestRelease,
    oldestRelease,
    totalReleases,
    lastUpdated: dataChanged ? new Date().toISOString() : existingSummary?.lastUpdated ?? new Date().toISOString(),
  };
}

async function main() {
  console.log('SCF Release Aggregator');
  console.log('======================');

  // Load data
  console.log('\nLoading releases...');
  const releases = loadReleases();
  console.log(`  Found ${releases.length} individual releases`);

  // Generate aggregated stats
  console.log('\nGenerating aggregated statistics...');

  // Load existing cycles to preserve contributorAggregates
  const existingCycles = loadExistingCycles();
  const existingAggregatesMap = new Map(
    existingCycles
      .filter(hasValidContributorAggregates)
      .map((c) => [c.version, c.contributorAggregates])
  );

  const minorVersionStats = generateMinorVersionStats(releases);

  // Merge existing contributorAggregates into new stats where missing
  for (const stat of minorVersionStats) {
    if (!stat.contributorAggregates && existingAggregatesMap.has(stat.version)) {
      stat.contributorAggregates = existingAggregatesMap.get(stat.version);
    }
  }

  const cyclesWritten = writeJsonIfChanged(
    `${OUTPUT_DIR}/scf-by-major.json`,
    minorVersionStats
  );
  const preservedCount = minorVersionStats.filter((s) => s.contributorAggregates).length;
  console.log(
    cyclesWritten
      ? `  Generated scf-by-major.json (${minorVersionStats.length} minor versions, ${preservedCount} with contributor data)`
      : `  No changes to scf-by-major.json (${minorVersionStats.length} minor versions)`
  );

  const existingSummary = loadExistingSummary();
  const summary = generateSummary(releases, minorVersionStats, existingSummary);
  const summaryWritten = writeJsonIfChanged(`${OUTPUT_DIR}/scf-summary.json`, summary);
  console.log(summaryWritten ? `  Generated scf-summary.json` : `  No changes to scf-summary.json`);

  console.log('\nAggregation complete!');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
