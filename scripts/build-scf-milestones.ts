/**
 * Builds scf-releases.json from GitHub milestones.
 * Fetches milestones and merged PRs, extracts contributors and categories.
 *
 * Usage:
 *   npm run build:scf
 *
 * @module scripts/build-scf-milestones
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { writeJsonIfChanged } from './utils/file-utils.js';
import {
  fetchMilestones,
  fetchMilestoneIssues,
  filterMergedPRs,
} from './utils/github-api.js';
import { toNormalizedRelease, compareVersions } from './utils/release-utils.js';
import { parseWPOrgReleaseDate } from './utils/scf-utils.js';
import type { GitHubMilestone, GitHubIssue, RepoIdentifier } from './utils/types.js';
import type { Release } from './types.js';

const PARSER_VERSION = '1.0.0';
const OUTPUT_PATH = 'public/data/scf/scf-releases.json';

const SCF_REPO: RepoIdentifier = {
  owner: 'WordPress',
  name: 'secure-custom-fields',
};

/**
 * Label to category mapping for SCF.
 */
const LABEL_CATEGORY_MAP: Record<string, string> = {
  '[Type] Bug': 'Bug Fixes',
  '[Type] Enhancement': 'Enhancements',
  '[Type] Code Quality': 'Code Quality',
  'documentation': 'Documentation',
};

/**
 * Fetch release dates from WordPress.org plugin API.
 */
async function fetchWPOrgReleaseDates(): Promise<Record<string, string>> {
  const url =
    'https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&slug=secure-custom-fields';

  console.log('Fetching release dates from WordPress.org...');

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`Warning: Could not fetch wp.org data: ${response.status}`);
    return {};
  }

  const data = (await response.json()) as {
    versions?: Record<string, string>;
    sections?: { changelog?: string };
  };

  // Parse dates from changelog section
  const dates: Record<string, string> = {};

  if (data.sections?.changelog) {
    // Changelog format:
    // <h4>6.8.0</h4>
    // <p><em>Release Date 30 Dec 2025</em></p>
    const changelog = data.sections.changelog;

    // Find version headers and their following release dates
    const versionPattern = /<h4>(\d+\.\d+\.\d+)<\/h4>/g;
    const datePattern = /<p><em>Release Date\s+(\d+\s+\w+\s+\d{4})<\/em><\/p>/g;

    let versionMatch;
    while ((versionMatch = versionPattern.exec(changelog)) !== null) {
      const version = versionMatch[1];
      const versionEndPos = versionMatch.index + versionMatch[0].length;

      // Find the release date that belongs to this version heading.
      datePattern.lastIndex = versionEndPos;
      const dateMatch = datePattern.exec(changelog);

      if (dateMatch && dateMatch.index < versionEndPos + 200) {
        const dateStr = dateMatch[1];
        const date = parseWPOrgReleaseDate(dateStr);
        if (date) {
          dates[version] = date;
        }
      }
    }
  }

  console.log(`  Found ${Object.keys(dates).length} release dates`);
  return dates;
}

/**
 * Extract category from PR labels.
 */
function getCategoryFromLabels(labels: GitHubIssue['labels']): string {
  for (const label of labels) {
    if (LABEL_CATEGORY_MAP[label.name]) {
      return LABEL_CATEGORY_MAP[label.name];
    }
  }
  return 'Other';
}

/**
 * Check if a milestone title is a valid version number.
 */
function isValidVersion(title: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(title);
}

/**
 * Process a single milestone into release data.
 */
async function processMilestone(
  milestone: GitHubMilestone,
  releaseDates: Record<string, string>
): Promise<Release | null> {
  const version = milestone.title;

  // Skip non-version milestones
  if (!isValidVersion(version)) {
    console.log(`  Skipping non-version milestone: ${version}`);
    return null;
  }

  // Fetch all closed issues/PRs for this milestone
  const issues = await fetchMilestoneIssues(SCF_REPO, milestone.number);

  // Filter to only merged PRs
  const mergedPRs = filterMergedPRs(issues);

  if (mergedPRs.length === 0) {
    console.log(`  Skipping ${version}: no merged PRs`);
    return null;
  }

  // Extract contributors from merged PRs
  const contributorSet = new Set<string>();
  const categories: Record<string, number> = {};

  for (const pr of mergedPRs) {
    // Add contributor
    if (pr.user?.login) {
      contributorSet.add(pr.user.login);
    }

    // Count category
    const category = getCategoryFromLabels(pr.labels);
    categories[category] = (categories[category] || 0) + 1;
  }

  const contributors = Array.from(contributorSet);

  // Get release date from wp.org or fallback to milestone data
  const date =
    releaseDates[version] ||
    (milestone.closed_at ? milestone.closed_at.split('T')[0] : new Date().toISOString().split('T')[0]);

  console.log(`  ${version}: ${mergedPRs.length} PRs, ${contributors.length} contributors`);

  return {
    gbVersion: version, // Using gbVersion field for compatibility
    wpVersion: null,
    date,
    isLastBeforeWPBeta: false,
    totalPRs: mergedPRs.length,
    categories,
    contributors: contributors.length,
    newContributors: 0, // Will be computed in aggregation step
    contributorsList: contributors,
    newContributorsList: [],
    changelogUrl: `https://github.com/${SCF_REPO.owner}/${SCF_REPO.name}/milestone/${milestone.number}`,
    parsedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
  };
}

async function main() {
  console.log('SCF Milestone Builder');
  console.log('=====================');

  try {
    // Fetch release dates from wp.org
    const releaseDates = await fetchWPOrgReleaseDates();

    // Fetch all milestones
    const milestones = await fetchMilestones(SCF_REPO);

    console.log(`\nProcessing ${milestones.length} milestones...`);

    // Process each milestone
    const releases: Release[] = [];
    for (const milestone of milestones) {
      const release = await processMilestone(milestone, releaseDates);
      if (release) {
        releases.push(release);
      }
    }

    console.log(`\nFound ${releases.length} releases with merged PRs`);

    // Sort by version (newest first) - no aggregation for individual releases
    releases.sort((a, b) => compareVersions(b.gbVersion, a.gbVersion));

    // Ensure output directory exists
    const dir = dirname(OUTPUT_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Convert to normalized format and write output
    const dataEndpoint = basename(OUTPUT_PATH);
    const normalizedReleases = releases.map((r) => {
      const normalized = toNormalizedRelease(r, dataEndpoint);
      // Use full version for individual releases (e.g., "6.7.1" not "6.7")
      normalized.id = r.gbVersion;
      normalized.version = r.gbVersion;
      normalized.displayLabel = `SCF ${r.gbVersion}`;
      return normalized;
    });

    const written = writeJsonIfChanged(OUTPUT_PATH, normalizedReleases);
    console.log(
      written
        ? `\nWrote ${normalizedReleases.length} releases to ${OUTPUT_PATH}`
        : `\nNo changes to ${OUTPUT_PATH} (${normalizedReleases.length} releases)`
    );

    // Summary
    const totalPRs = releases.reduce((sum, r) => sum + r.totalPRs, 0);
    const totalContributors = new Set(
      releases.flatMap((r) => r.contributorsList || [])
    ).size;

    console.log(`\nSummary:`);
    console.log(`  Individual releases: ${releases.length}`);
    console.log(`  Total PRs: ${totalPRs}`);
    console.log(`  Unique contributors: ${totalContributors}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
