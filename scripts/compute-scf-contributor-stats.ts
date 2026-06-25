/**
 * Computes contributor sponsor/country statistics for SCF releases.
 *
 * Fetches WP.org profiles on-the-fly, computes aggregates, and stores them
 * in scf-releases.json and scf-by-major.json. Only aggregate counts are stored
 * (privacy-first): e.g. "15 Automattic, 3 Google" not individual usernames.
 *
 * Usage:
 *   npm run compute-scf-aggregates                    # All SCF releases
 *   npm run compute-scf-aggregates -- --version 6.8  # Single version
 *   npm run compute-scf-aggregates -- --force        # Recompute all
 *
 * @module scripts/compute-scf-contributor-stats
 */

import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { writeJsonIfChanged } from './utils/file-utils.js';
import { extractCountry, batchGeocodeLocations } from './utils/geocoding.js';
import { SponsorNormalizer } from './utils/sponsor-normalization.js';
import {
  loadUsernameMapping,
  fetchContributorProfiles,
  type ContributorData,
} from './utils/contributor-data.js';
import { toNormalizedRelease, type NormalizedReleaseWithContributors } from './utils/release-utils.js';
import type { Release, ReleaseContributorAggregates } from './types.js';
import type { NormalizedRelease } from '../src/data/normalized.js';

const SCF_RELEASES_PATH = 'public/data/scf/scf-releases.json';
const SCF_BY_MAJOR_PATH = 'public/data/scf/scf-by-major.json';

interface ComputeArgs {
  version?: string;
  delay: number;
  force: boolean;
  dryRun: boolean;
  verbose: boolean;
}

function getArgs(): ComputeArgs {
  const { values } = parseArgs({
    options: {
      version: { type: 'string', short: 'v' },
      delay: { type: 'string', short: 'd', default: '500' },
      force: { type: 'boolean', short: 'f', default: false },
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
    },
  });

  return {
    version: values.version as string | undefined,
    delay: parseInt(values.delay as string, 10),
    force: values.force as boolean,
    dryRun: values['dry-run'] as boolean,
    verbose: values.verbose as boolean,
  };
}

/**
 * Load SCF releases from JSON file as Release[] (internal format).
 */
function loadSCFReleases(path: string): Release[] {
  if (!existsSync(path)) {
    return [];
  }

  const normalized: NormalizedReleaseWithContributors[] = JSON.parse(readFileSync(path, 'utf-8'));

  // Convert NormalizedRelease back to Release format for processing
  return normalized.map((n) => ({
    gbVersion: n.version, // SCF uses version field mapped to gbVersion
    wpVersion: null,
    date: n.date || '',
    isLastBeforeWPBeta: false,
    totalPRs: n.totalPRs,
    categories: n.rawCategories || n.categoryTotals || {}, // Preserve rawCategories from scf-releases.json
    contributors: n.contributors,
    newContributors: n.newContributors,
    contributorsList: n.contributorsList || [],
    newContributorsList: n.newContributorsList || [],
    contributorAggregates: n.contributorAggregates
      ? {
          stats: { total: n.contributors, newContributors: n.newContributors },
          sponsorBreakdown: n.contributorAggregates.sponsorBreakdown,
          countryBreakdown: n.contributorAggregates.countryBreakdown,
          aggregatedAt: new Date().toISOString(),
        }
      : undefined,
    changelogUrl: n.changelogUrl || '',
    parsedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }));
}

/**
 * Compute aggregates for a single release.
 */
function computeAggregates(
  contributorDataMap: Map<string, ContributorData>,
  release: Release,
  sponsorNormalizer: SponsorNormalizer
): ReleaseContributorAggregates {
  const stats = {
    total: release.contributorsList.length,
    newContributors: release.newContributorsList.length,
  };

  const sponsorBreakdown: Record<string, number> = {};
  const countryBreakdown: Record<string, number> = {};

  for (const username of release.contributorsList) {
    const data = contributorDataMap.get(username.toLowerCase());

    // Sponsor: normalize and deduplicate variations
    const sponsor = sponsorNormalizer.normalize(data?.sponsor || null);
    sponsorBreakdown[sponsor] = (sponsorBreakdown[sponsor] || 0) + 1;

    // Country: resolved or "Unknown"
    let country = 'Unknown';
    if (data?.location) {
      const geo = extractCountry(data.location);
      if (geo.country) {
        country = geo.country;
      }
    }
    countryBreakdown[country] = (countryBreakdown[country] || 0) + 1;
  }

  return {
    stats,
    sponsorBreakdown: sortByValue(sponsorBreakdown),
    countryBreakdown: sortByValue(countryBreakdown),
    aggregatedAt: new Date().toISOString(),
  };
}

/**
 * Compute aggregates for a major version from unique contributors across patch releases.
 */
function computeMajorVersionAggregates(
  patchReleases: Release[],
  contributorDataMap: Map<string, ContributorData>,
  sponsorNormalizer: SponsorNormalizer
): ReleaseContributorAggregates {
  // Collect unique contributors across all patch releases
  const uniqueContributors = new Set<string>();
  const uniqueNewContributors = new Set<string>();

  for (const release of patchReleases) {
    for (const username of release.contributorsList) {
      uniqueContributors.add(username.toLowerCase());
    }
    for (const username of release.newContributorsList) {
      uniqueNewContributors.add(username.toLowerCase());
    }
  }

  const stats = {
    total: uniqueContributors.size,
    newContributors: uniqueNewContributors.size,
  };

  // Compute breakdown from unique contributors
  const sponsorBreakdown: Record<string, number> = {};
  const countryBreakdown: Record<string, number> = {};

  for (const username of uniqueContributors) {
    const data = contributorDataMap.get(username);

    const sponsor = sponsorNormalizer.normalize(data?.sponsor || null);
    sponsorBreakdown[sponsor] = (sponsorBreakdown[sponsor] || 0) + 1;

    let country = 'Unknown';
    if (data?.location) {
      const geo = extractCountry(data.location);
      if (geo.country) {
        country = geo.country;
      }
    }
    countryBreakdown[country] = (countryBreakdown[country] || 0) + 1;
  }

  return {
    stats,
    sponsorBreakdown: sortByValue(sponsorBreakdown),
    countryBreakdown: sortByValue(countryBreakdown),
    aggregatedAt: new Date().toISOString(),
  };
}

/**
 * Sort breakdown by value (descending), but keep "Unknown" at end.
 */
function sortByValue(obj: Record<string, number>): Record<string, number> {
  const entries = Object.entries(obj);
  const unknown = entries.find(([k]) => k === 'Unknown');
  const others = entries
    .filter(([k]) => k !== 'Unknown')
    .sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(unknown ? [...others, unknown] : others);
}

/**
 * Get major version from a full version string (6.8.1 -> 6.8).
 */
function getMajorVersion(version: string): string {
  const parts = version.split('.');
  return parts.slice(0, 2).join('.');
}

async function main(): Promise<void> {
  const args = getArgs();

  console.log('SCF Contributor Stats');
  console.log('=====================');

  // Load SCF releases
  if (!existsSync(SCF_RELEASES_PATH)) {
    console.error(`\n❌ SCF releases file not found: ${SCF_RELEASES_PATH}`);
    console.error('   Run "npm run build:scf" first to generate release data.');
    process.exit(1);
  }

  const releases: Release[] = loadSCFReleases(SCF_RELEASES_PATH);
  console.log(`\n📂 Loaded ${releases.length} SCF releases`);

  // Load username mapping
  const mapping = loadUsernameMapping();
  if (mapping) {
    console.log(`📂 Loaded username mapping (${Object.keys(mapping.githubToWporg).length} entries)`);
  }

  // Filter to target releases
  let targetReleases = releases;
  if (args.version) {
    targetReleases = releases.filter(
      (r) => r.gbVersion === args.version || getMajorVersion(r.gbVersion) === args.version
    );
    console.log(`🔍 Filtering to version ${args.version}: ${targetReleases.length} releases`);
  }

  // Find releases needing aggregation
  const needsAggregation = args.force
    ? targetReleases
    : targetReleases.filter((r) => !r.contributorAggregates);

  // Collect all unique contributors
  const allContributors = new Set<string>();
  for (const release of targetReleases) {
    for (const username of release.contributorsList) {
      allContributors.add(username.toLowerCase());
    }
  }

  if (allContributors.size === 0) {
    console.log('\n✅ No contributors to fetch!');
    if (needsAggregation.length === 0) {
      console.log('   All releases already have aggregates. Use --force to recompute.');
    }
    return;
  }

  console.log(`\n📊 Computing Aggregates`);
  console.log('=======================');
  console.log(`Releases to aggregate: ${needsAggregation.length}`);
  console.log(`Unique contributors: ${allContributors.size}`);
  console.log(`Rate limit: ${args.delay}ms between requests`);

  const estimatedMinutes = Math.ceil((allContributors.size * args.delay) / 1000 / 60);
  console.log(`Estimated time: ~${estimatedMinutes} minute(s)\n`);

  // Fetch contributor profiles
  console.log('📥 Fetching contributor profiles...');
  const contributorDataMap = await fetchContributorProfiles(
    [...allContributors],
    mapping,
    {
      delayMs: args.delay,
      verbose: args.verbose,
      onProgress: (done, total) => {
        const pct = ((done / total) * 100).toFixed(0);
        process.stdout.write(`\r   Progress: ${done}/${total} (${pct}%)`);
      },
    }
  );

  console.log('\n');

  // Batch geocode locations
  const allLocations = [...contributorDataMap.values()]
    .map((d) => d.location)
    .filter((loc): loc is string => Boolean(loc));

  if (allLocations.length > 0) {
    console.log(`🌍 Geocoding ${allLocations.length} locations...`);
    await batchGeocodeLocations(allLocations, {
      delayMs: 1100, // Nominatim rate limit
      writeCache: !args.dryRun,
      onProgress: (done, total) => {
        const pct = ((done / total) * 100).toFixed(0);
        process.stdout.write(`\r   Progress: ${done}/${total} (${pct}%)`);
      },
    });
    console.log('\n');
  }

  // Compute aggregates for individual releases
  const sponsorNormalizer = new SponsorNormalizer();
  let processed = 0;

  if (needsAggregation.length > 0) {
    console.log('🔄 Computing release aggregates...');

    for (const release of releases) {
      if (!needsAggregation.includes(release)) {
        continue;
      }

      release.contributorAggregates = computeAggregates(
        contributorDataMap,
        release,
        sponsorNormalizer
      );
      processed++;

      const pct = ((processed / needsAggregation.length) * 100).toFixed(0);
      process.stdout.write(`\r   Processed: ${processed}/${needsAggregation.length} (${pct}%)`);
    }

    console.log('\n');
  }

  // Compute aggregates for major versions
  let majorVersionData: NormalizedRelease[] = [];
  if (existsSync(SCF_BY_MAJOR_PATH)) {
    majorVersionData = JSON.parse(readFileSync(SCF_BY_MAJOR_PATH, 'utf-8'));
  }

  if (majorVersionData.length > 0) {
    console.log('🔄 Computing major version aggregates...');

    // Group releases by major version
    const releasesByMajor = new Map<string, Release[]>();
    for (const release of releases) {
      const major = getMajorVersion(release.gbVersion);
      if (!releasesByMajor.has(major)) {
        releasesByMajor.set(major, []);
      }
      releasesByMajor.get(major)!.push(release);
    }

    // Update each major version entry
    for (const majorEntry of majorVersionData) {
      const patchReleases = releasesByMajor.get(majorEntry.version);
      if (!patchReleases || patchReleases.length === 0) {
        continue;
      }

      const aggregates = computeMajorVersionAggregates(
        patchReleases,
        contributorDataMap,
        sponsorNormalizer
      );

      majorEntry.contributorAggregates = {
        sponsorBreakdown: aggregates.sponsorBreakdown,
        countryBreakdown: aggregates.countryBreakdown,
      };

      console.log(
        `   SCF ${majorEntry.version}: ${aggregates.stats.total} unique contributors`
      );
    }

    console.log('');
  }

  // Print sample
  const sample = needsAggregation[needsAggregation.length - 1];
  if (sample?.contributorAggregates) {
    console.log(`📋 Sample: SCF ${sample.gbVersion}`);
    console.log(`   Contributors: ${sample.contributorAggregates.stats.total}`);

    const topSponsors = Object.entries(sample.contributorAggregates.sponsorBreakdown)
      .filter(([k]) => k !== 'Unknown')
      .slice(0, 5);
    if (topSponsors.length > 0) {
      console.log(
        `   Top sponsors: ${topSponsors.map(([s, c]) => `${s} (${c})`).join(', ')}`
      );
    }
  }

  // Write output
  if (args.dryRun) {
    console.log('\n🔍 Dry run - no changes written');
  } else {
    // Write scf-releases.json in normalized format
    if (processed > 0) {
      const normalizedReleases = releases.map((r) => {
        const normalized = toNormalizedRelease(r, 'scf/scf-releases.json');
        // Preserve SCF-specific fields
        normalized.id = r.gbVersion;
        normalized.version = r.gbVersion;
        normalized.displayLabel = `SCF ${r.gbVersion}`;
        return normalized;
      });
      const written = writeJsonIfChanged(SCF_RELEASES_PATH, normalizedReleases);
      console.log(written ? `\n✅ Updated ${SCF_RELEASES_PATH}` : `\n✅ No changes to ${SCF_RELEASES_PATH}`);
    }

    // Write scf-by-major.json
    if (majorVersionData.length > 0) {
      const written = writeJsonIfChanged(SCF_BY_MAJOR_PATH, majorVersionData);
      console.log(written ? `✅ Updated ${SCF_BY_MAJOR_PATH}` : `✅ No changes to ${SCF_BY_MAJOR_PATH}`);
    }
  }

  // Summary
  console.log('\n📊 Summary');
  console.log('==========');
  console.log(`Contributors fetched: ${contributorDataMap.size}`);
  console.log(`Releases aggregated: ${processed}`);
  console.log(`Major versions aggregated: ${majorVersionData.length}`);
  console.log(`Unique sponsors: ${sponsorNormalizer.getStats().uniqueSponsors}`);
}

main().catch((error) => {
  console.error('\nError:', error);
  process.exit(1);
});
