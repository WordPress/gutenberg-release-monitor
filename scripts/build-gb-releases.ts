/**
 * Builds gb-releases.json from GitHub release changelogs.
 * Fetches releases from GitHub API, parses changelogs, and outputs normalized release data.
 *
 * Usage:
 *   npm run data-sync:gb-releases                    # Parse all releases
 *   npm run data-sync:gb-releases -- --version 20.0  # Parse specific version
 *   npm run data-sync:gb-releases -- --from 19.0 --to 20.0  # Parse range
 *
 * @module scripts/build-gb-releases
 */

import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { writeJsonIfChanged } from './utils/file-utils.js';
import {
  fetchAllReleases,
  fetchReleaseByTag,
  filterReleasesByVersion,
} from './utils/github-api.js';
import { parseRelease } from './utils/changelog-parser.js';
import {
  toNormalizedRelease,
  loadReleases,
  getMinorVersion,
  aggregatePatchReleases,
} from './utils/release-utils.js';
import type { ParseArgs } from './utils/types.js';
import type { Release } from './types.js';

const PARSER_VERSION = '1.0.0';

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
 * Load existing releases from JSON file.
 * Handles both normalized format and legacy format.
 */
function loadExistingReleases(outputPath: string): Release[] {
  if (!existsSync(outputPath)) {
    return [];
  }

  try {
    return loadReleases(outputPath);
  } catch {
    console.warn(`Warning: Could not parse existing ${outputPath}, starting fresh`);
    return [];
  }
}

/**
 * Merge new releases with existing ones.
 * New data takes precedence, but preserves contributorAggregates from existing.
 */
function mergeReleases(existing: Release[], newReleases: Release[]): Release[] {
  const releaseMap = new Map<string, Release>();

  // Add existing releases (keyed by minor version)
  for (const release of existing) {
    const minorVersion = getMinorVersion(release.gbVersion);
    releaseMap.set(minorVersion, release);
  }

  // Override with new releases, preserving contributorAggregates from existing
  for (const release of newReleases) {
    const minorVersion = getMinorVersion(release.gbVersion);
    const existingRelease = releaseMap.get(minorVersion);

    // Preserve contributorAggregates from existing release if new doesn't have it
    if (existingRelease?.contributorAggregates && !release.contributorAggregates) {
      releaseMap.set(minorVersion, {
        ...release,
        contributorAggregates: existingRelease.contributorAggregates,
      });
    } else {
      releaseMap.set(minorVersion, release);
    }
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

  // Check if --version is a minor version (e.g., "20.0") or patch version (e.g., "20.0.1")
  const isMinorVersion = args.version && args.version.split('.').length === 2;

  if (args.version) {
    if (isMinorVersion) {
      console.log(`Parsing minor version: ${args.version} (all patch releases)`);
    } else {
      console.log(`Parsing single version: ${args.version}`);
    }
  } else if (args.from || args.to) {
    console.log(`Parsing version range: ${args.from ?? 'earliest'} to ${args.to ?? 'latest'}`);
  } else {
    console.log('Parsing all versions');
  }

  console.log('Note: Release candidates are excluded, patch releases are aggregated into minor versions');

  try {
    // Fetch releases
    let releases;
    if (args.version && !isMinorVersion) {
      // Exact patch version lookup (e.g., "20.0.1")
      const release = await fetchReleaseByTag(args.version);
      releases = release ? [release] : [];
      if (releases.length === 0) {
        console.error(`Release not found: ${args.version}`);
        process.exit(1);
      }
    } else if (args.version && isMinorVersion) {
      // Minor version: fetch all and filter by matching minor version
      const allReleases = await fetchAllReleases();
      releases = allReleases.filter((r) => {
        const releaseVersion = r.tag_name.replace(/^v/, '');
        // Skip release candidates
        if (releaseVersion.includes('-rc') || releaseVersion.includes('-RC')) {
          return false;
        }
        // Match by minor version (e.g., "20.0" matches "20.0.0", "20.0.1", etc.)
        return getMinorVersion(releaseVersion) === args.version;
      });
      if (releases.length === 0) {
        console.error(`No releases found for minor version: ${args.version}`);
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
    const dataEndpoint = basename(outputPath);
    const normalizedReleases = mergedReleases.map((r) => toNormalizedRelease(r, dataEndpoint));
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
