/**
 * Changelog parser script for Gutenberg releases.
 * Fetches releases from GitHub API, parses changelogs, and outputs gb-releases.json.
 *
 * Outputs NormalizedRelease format for UI consumption.
 *
 * Usage:
 *   npm run parse                    # Parse all releases
 *   npm run parse -- --version 20.0  # Parse specific version
 *   npm run parse -- --from 19.0 --to 20.0  # Parse range
 *
 * @module scripts/parse-changelog
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { writeJsonIfChanged } from './utils/file-utils.js';
import {
  fetchAllReleases,
  fetchReleaseByTag,
  filterReleasesByVersion,
  getMinorVersion,
  isPatchRelease,
} from './utils/github-api.js';
import { parseRelease } from './utils/changelog-parser.js';
import type { ParseArgs } from './utils/types.js';
import type { Release } from './types.js';
import type { NormalizedRelease } from '../src/data/normalized.js';

const PARSER_VERSION = '1.0.0';

/**
 * Extended NormalizedRelease with contributor lists for internal script use.
 */
type NormalizedReleaseWithContributors = NormalizedRelease & {
  contributorsList?: string[];
  newContributorsList?: string[];
};

/**
 * Parse command line arguments.
 */
function getArgs(): ParseArgs {
  const { values } = parseArgs({
    options: {
      version: { type: 'string', short: 'v' },
      from: { type: 'string', short: 'f' },
      to: { type: 'string', short: 't' },
      output: { type: 'string', short: 'o', default: 'public/data/gb-releases.json' },
      verbose: { type: 'boolean', default: false },
    },
  });

  return values as ParseArgs;
}

/**
 * Convert parsed changelog to internal Release format.
 */
function toRelease(parsed: ReturnType<typeof parseRelease>): Release {
  return {
    gbVersion: parsed.version,
    wpVersion: null, // Will be set by aggregation step
    date: parsed.date,
    isLastBeforeWPBeta: false, // Will be set by aggregation step
    totalPRs: parsed.totalPRs,
    categories: parsed.categories,
    contributors: parsed.contributors,
    newContributors: parsed.newContributors,
    contributorsList: parsed.contributorsList,
    newContributorsList: parsed.newContributorsList,
    changelogUrl: parsed.changelogUrl,
    parsedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
  };
}

/**
 * Convert internal Release to NormalizedRelease format for JSON output.
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
 * Aggregate patch releases into their minor version.
 * e.g., 20.1.0, 20.1.1, 20.1.2 -> single 20.1 with combined PRs
 */
function aggregatePatchReleases(releases: Release[]): Release[] {
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

    // Find patch releases to add
    const patchReleases = group.filter((r) => isPatchRelease(r.gbVersion));

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

    aggregated.push({
      ...baseRelease,
      gbVersion: minorVersion, // Normalize to x.y format
      totalPRs,
      categories,
      contributors: contributorsList.length,
      newContributors: newContributorsList.length,
      contributorsList,
      newContributorsList,
    });

    console.log(`    Aggregated ${patchReleases.length} patch release(s) into ${minorVersion}`);
  }

  return aggregated;
}

/**
 * Load existing releases from JSON file.
 * Handles both normalized format and legacy format.
 */
function loadExistingReleases(outputPath: string): Release[] {
  if (!existsSync(outputPath)) {
    return [];
  }

  try {
    const content = readFileSync(outputPath, 'utf-8');
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
  } catch {
    console.warn(`Warning: Could not parse existing ${outputPath}, starting fresh`);
    return [];
  }
}

/**
 * Merge new releases with existing ones.
 * New data takes precedence for versions that already exist.
 */
function mergeReleases(existing: Release[], newReleases: Release[]): Release[] {
  const releaseMap = new Map<string, Release>();

  // Add existing releases (keyed by minor version)
  for (const release of existing) {
    const minorVersion = getMinorVersion(release.gbVersion);
    releaseMap.set(minorVersion, release);
  }

  // Override with new releases
  for (const release of newReleases) {
    const minorVersion = getMinorVersion(release.gbVersion);
    releaseMap.set(minorVersion, release);
  }

  // Sort by version (newest first)
  return Array.from(releaseMap.values()).sort((a, b) => {
    const partsA = a.gbVersion.split('.').map(Number);
    const partsB = b.gbVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] ?? 0;
      const numB = partsB[i] ?? 0;
      if (numB !== numA) return numB - numA;
    }
    return 0;
  });
}

async function main() {
  const args = getArgs();
  const outputPath = args.output ?? 'data/gb-releases.json';

  console.log('Gutenberg Release Parser');
  console.log('========================');

  if (args.version) {
    console.log(`Parsing single version: ${args.version}`);
  } else if (args.from || args.to) {
    console.log(`Parsing version range: ${args.from ?? 'earliest'} to ${args.to ?? 'latest'}`);
  } else {
    console.log('Parsing all versions');
  }

  console.log('Note: Release candidates are excluded, patch releases are aggregated into minor versions');

  try {
    // Fetch releases
    let releases;
    if (args.version) {
      const release = await fetchReleaseByTag(args.version);
      releases = release ? [release] : [];
      if (releases.length === 0) {
        console.error(`Release not found: ${args.version}`);
        process.exit(1);
      }
    } else {
      const allReleases = await fetchAllReleases();
      // Filter out RCs by default
      releases = filterReleasesByVersion(allReleases, {
        from: args.from,
        to: args.to,
        includeRC: false,
      });
    }

    console.log(`\nFound ${releases.length} stable releases to parse`);

    // Parse each release
    const parsedReleases: Release[] = [];
    for (const release of releases) {
      const version = release.tag_name.replace(/^v/, '');
      process.stdout.write(`  Parsing ${version}...`);

      try {
        const parsed = parseRelease(release);
        const releaseData = toRelease(parsed);
        parsedReleases.push(releaseData);

        if (args.verbose) {
          const categories = Object.entries(releaseData.categories)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          console.log(` ${releaseData.totalPRs} PRs (${categories})`);
        } else {
          console.log(' done');
        }
      } catch (error) {
        console.log(` ERROR: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Aggregate patch releases into minor versions
    console.log('\nAggregating patch releases...');
    const aggregatedReleases = aggregatePatchReleases(parsedReleases);

    // Load existing and merge
    const existingReleases = loadExistingReleases(outputPath);
    const mergedReleases = mergeReleases(existingReleases, aggregatedReleases);

    // Ensure output directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Convert to normalized format and write output
    const normalizedReleases = mergedReleases.map(toNormalizedRelease);
    const releasesWritten = writeJsonIfChanged(outputPath, normalizedReleases);
    console.log(
      releasesWritten
        ? `\nWrote ${normalizedReleases.length} releases to ${outputPath}`
        : `\nNo changes to ${outputPath} (${normalizedReleases.length} releases)`
    );

    // Summary - compute from categories
    const totalPRs = aggregatedReleases.reduce((sum, r) => sum + r.totalPRs, 0);

    // Helper to sum specific categories across all releases
    const sumCategories = (categoryNames: string[]) =>
      aggregatedReleases.reduce((sum, r) => {
        return (
          sum +
          categoryNames.reduce((catSum, name) => catSum + (r.categories[name] || 0), 0)
        );
      }, 0);

    // Use exact category names from Gutenberg changelogs
    const featureCategories = ['Enhancements'];
    const bugCategories = ['Bug Fixes'];
    const a11yCategories = ['Accessibility'];
    const perfCategories = ['Performance'];

    console.log(`\nSummary of parsed releases:`);
    console.log(`  Minor versions: ${aggregatedReleases.length}`);
    console.log(`  Total PRs: ${totalPRs}`);
    console.log(`  Features: ${sumCategories(featureCategories)}`);
    console.log(`  Bug fixes: ${sumCategories(bugCategories)}`);
    console.log(`  Accessibility: ${sumCategories(a11yCategories)}`);
    console.log(`  Performance: ${sumCategories(perfCategories)}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
