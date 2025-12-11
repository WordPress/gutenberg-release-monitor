import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  fetchAllReleases,
  fetchReleaseByTag,
  filterReleasesByVersion,
  getMinorVersion,
  isPatchRelease,
} from './utils/github-api.js';
import { parseRelease, parseContributors } from './utils/changelog-parser.js';
import type { ParseArgs } from './utils/types.js';
import type { Release } from '../src/data/types.js';

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
      output: { type: 'string', short: 'o', default: 'public/data/releases.json' },
      verbose: { type: 'boolean', default: false },
    },
  });

  return values as ParseArgs;
}

/**
 * Convert parsed changelog to Release format.
 */
function toRelease(parsed: ReturnType<typeof parseRelease>): Release {
  const total = parsed.totalPRs || 1; // Avoid division by zero

  return {
    gbVersion: parsed.version,
    wpVersion: null, // Will be set by aggregation step
    date: parsed.date,
    isLastBeforeWPBeta: false, // Will be set by aggregation step
    totalPRs: parsed.totalPRs,
    featurePRs: parsed.featurePRs,
    bugPRs: parsed.bugPRs,
    a11yPRs: parsed.a11yPRs,
    performancePRs: parsed.performancePRs,
    contributors: parsed.contributors,
    newContributors: parsed.newContributors,
    contributorsList: parsed.contributorsList,
    newContributorsList: parsed.newContributorsList,
    enhancementPercent: Math.round((parsed.featurePRs / total) * 100),
    bugfixPercent: Math.round((parsed.bugPRs / total) * 100),
    changelogUrl: parsed.changelogUrl,
    parsedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
  };
}

/**
 * Aggregate patch releases into their minor version.
 * e.g., 20.1.0, 20.1.1, 20.1.2 -> single 20.1.0 with combined PRs
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
      aggregated.push(baseRelease);
      continue;
    }

    // Find patch releases to add
    const patchReleases = group.filter((r) => isPatchRelease(r.gbVersion));

    if (patchReleases.length === 0) {
      aggregated.push(baseRelease);
      continue;
    }

    // Aggregate PR counts from patch releases into the base
    const totalPRs = baseRelease.totalPRs + patchReleases.reduce((sum, r) => sum + r.totalPRs, 0);
    const featurePRs = baseRelease.featurePRs + patchReleases.reduce((sum, r) => sum + r.featurePRs, 0);
    const bugPRs = baseRelease.bugPRs + patchReleases.reduce((sum, r) => sum + r.bugPRs, 0);
    const a11yPRs = baseRelease.a11yPRs + patchReleases.reduce((sum, r) => sum + r.a11yPRs, 0);
    const performancePRs = baseRelease.performancePRs + patchReleases.reduce((sum, r) => sum + r.performancePRs, 0);

    // Combine contributor lists and deduplicate
    const allContributors = new Set<string>(baseRelease.contributorsList || []);
    const allNewContributors = new Set<string>(baseRelease.newContributorsList || []);
    for (const patch of patchReleases) {
      for (const c of patch.contributorsList || []) allContributors.add(c);
      for (const c of patch.newContributorsList || []) allNewContributors.add(c);
    }
    const contributorsList = Array.from(allContributors);
    const newContributorsList = Array.from(allNewContributors);

    const total = totalPRs || 1;

    aggregated.push({
      ...baseRelease,
      gbVersion: `${minorVersion}.0`, // Normalize to x.y.0
      totalPRs,
      featurePRs,
      bugPRs,
      a11yPRs,
      performancePRs,
      contributors: contributorsList.length,
      newContributors: newContributorsList.length,
      contributorsList,
      newContributorsList,
      enhancementPercent: Math.round((featurePRs / total) * 100),
      bugfixPercent: Math.round((bugPRs / total) * 100),
    });

    console.log(`    Aggregated ${patchReleases.length} patch release(s) into ${minorVersion}.0`);
  }

  return aggregated;
}

/**
 * Load existing releases from JSON file.
 */
function loadExistingReleases(outputPath: string): Release[] {
  if (!existsSync(outputPath)) {
    return [];
  }

  try {
    const content = readFileSync(outputPath, 'utf-8');
    return JSON.parse(content);
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

  // Add existing releases
  for (const release of existing) {
    releaseMap.set(release.gbVersion, release);
  }

  // Override with new releases
  for (const release of newReleases) {
    releaseMap.set(release.gbVersion, release);
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
  const outputPath = args.output ?? 'data/releases.json';

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
          console.log(` ${releaseData.totalPRs} PRs (${releaseData.featurePRs} features, ${releaseData.bugPRs} bugs)`);
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

    // Write output
    writeFileSync(outputPath, JSON.stringify(mergedReleases, null, 2));
    console.log(`\nWrote ${mergedReleases.length} releases to ${outputPath}`);

    // Calculate unique contributors across all fetched releases
    console.log('\nCalculating unique contributors...');
    const allContributors = new Set<string>();
    for (const ghRelease of releases) {
      const { contributorsList, newContributorsList } = parseContributors(ghRelease.body || '');
      for (const c of contributorsList) allContributors.add(c);
      for (const c of newContributorsList) allContributors.add(c);
    }

    // Write unique contributors count to a separate file
    const contributorsData = {
      uniqueCount: allContributors.size,
      calculatedAt: new Date().toISOString(),
    };
    const contributorsPath = dirname(outputPath) + '/contributors-meta.json';
    writeFileSync(contributorsPath, JSON.stringify(contributorsData, null, 2));
    console.log(`  Found ${allContributors.size} unique contributors`);

    // Summary
    const totalPRs = aggregatedReleases.reduce((sum, r) => sum + r.totalPRs, 0);
    console.log(`\nSummary of parsed releases:`);
    console.log(`  Minor versions: ${aggregatedReleases.length}`);
    console.log(`  Total PRs: ${totalPRs}`);
    console.log(`  Features: ${aggregatedReleases.reduce((sum, r) => sum + r.featurePRs, 0)}`);
    console.log(`  Bug fixes: ${aggregatedReleases.reduce((sum, r) => sum + r.bugPRs, 0)}`);
    console.log(`  Accessibility: ${aggregatedReleases.reduce((sum, r) => sum + r.a11yPRs, 0)}`);
    console.log(`  Performance: ${aggregatedReleases.reduce((sum, r) => sum + r.performancePRs, 0)}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
