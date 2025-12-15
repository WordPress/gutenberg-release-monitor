/**
 * Changelog parsing utilities for Gutenberg releases.
 * Supports multiple changelog formats: modern (v8+), mid-era (v6-v7), and legacy (v5-).
 * @module scripts/utils/changelog-parser
 */

import type { GitHubRelease, ParsedChangelog } from './types.js';

/**
 * Regex to match PR links in changelog entries.
 * Matches patterns like: ([12345](https://github.com/...))
 */
const PR_LINK_REGEX = /\(\[(\d+)\]\([^)]+\)\)/g;

/**
 * Regex to match inline GitHub PR links (v6-v7 format).
 * Matches patterns like: [description](https://github.com/WordPress/gutenberg/pull/12345)
 */
const INLINE_PR_LINK_REGEX = /\[[^\]]+\]\(https:\/\/github\.com\/[^)]*\/pull\/\d+[^)]*\)/g;

/**
 * Regex to match bullet points for old changelog format (v5 and earlier).
 * Matches lines starting with * or - followed by content.
 */
const BULLET_POINT_REGEX = /^[\*\-]\s+.+/;

/**
 * Regex to match a category header (### Category).
 */
const CATEGORY_HEADER_REGEX = /^###\s+(.+)$/;

/**
 * Regex to match a subcategory header (#### Subcategory).
 */
const SUBCATEGORY_HEADER_REGEX = /^####\s+(.+)$/;

/**
 * Regex to match contributors section.
 */
const CONTRIBUTORS_SECTION_REGEX = /^##\s+Contributors/i;

/**
 * Regex to match first-time contributors section.
 */
const FIRST_TIME_CONTRIBUTORS_REGEX = /^##\s+First[- ]time\s+[Cc]ontributors/i;

/**
 * Count PR references in a text block.
 * Supports multiple changelog formats:
 * - Modern (v8+): ([12345](url)) at end of line
 * - Mid-era (v6-v7): [description](url) inline links
 * - Legacy (v5-): Just bullet points with no PR links
 */
function countPRs(text: string): number {
  // Try modern format first: ([12345](url))
  const modernMatches = text.match(PR_LINK_REGEX);
  if (modernMatches && modernMatches.length > 0) {
    return modernMatches.length;
  }

  // Try inline PR links: [text](github.com/.../pull/123)
  const inlineMatches = text.match(INLINE_PR_LINK_REGEX);
  if (inlineMatches && inlineMatches.length > 0) {
    return inlineMatches.length;
  }

  // Fall back to counting bullet points for old format
  const lines = text.split('\n');
  let bulletCount = 0;
  for (const line of lines) {
    if (BULLET_POINT_REGEX.test(line.trim())) {
      bulletCount++;
    }
  }
  return bulletCount;
}

/**
 * Parse changelog format (supports both modern v12+ and legacy formats).
 * Uses ### Category and #### Subcategory headers.
 * Returns raw categories as the source of truth - no computed fields.
 */
export function parseModernChangelog(body: string): {
  categories: Record<string, number>;
  totalPRs: number;
} {
  // Normalize line endings (GitHub API returns \r\n)
  const normalizedBody = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedBody.split('\n');
  const categories: Record<string, number> = {};

  let currentCategory = '';
  let currentCategoryContent = '';
  let uncategorizedContent = ''; // For changelogs without category headers

  // Check if there's a "## Changelog" header - if not, assume whole body is changelog (legacy format)
  const hasChangelogHeader = normalizedBody.includes('## Changelog');
  let inChangelog = !hasChangelogHeader; // Start in changelog mode for legacy format

  // Check if there are any ### category headers
  const hasCategoryHeaders = normalizedBody.match(CATEGORY_HEADER_REGEX);

  for (const line of lines) {
    // Check for changelog section start (modern format)
    if (line.match(/^##\s+Changelog/i)) {
      inChangelog = true;
      continue;
    }

    // Stop at contributors section
    if (CONTRIBUTORS_SECTION_REGEX.test(line) || FIRST_TIME_CONTRIBUTORS_REGEX.test(line)) {
      // Save last category before exiting
      if (currentCategory && currentCategoryContent) {
        const count = countPRs(currentCategoryContent);
        categories[currentCategory] = count;
      }
      break;
    }

    if (!inChangelog) continue;

    // Check for category header (### Category)
    const categoryMatch = line.match(CATEGORY_HEADER_REGEX);
    if (categoryMatch) {
      // Save previous category
      if (currentCategory && currentCategoryContent) {
        const count = countPRs(currentCategoryContent);
        categories[currentCategory] = count;
      }

      currentCategory = categoryMatch[1].trim();
      currentCategoryContent = '';
      continue;
    }

    // Skip subcategory headers but keep tracking content
    if (SUBCATEGORY_HEADER_REGEX.test(line)) {
      continue;
    }

    // Accumulate content for current category or uncategorized
    if (currentCategory) {
      currentCategoryContent += line + '\n';
    } else if (inChangelog && !hasCategoryHeaders) {
      // For changelogs without category headers, accumulate all content
      uncategorizedContent += line + '\n';
    }
  }

  // Handle last category if we didn't hit contributors section
  if (currentCategory && currentCategoryContent) {
    const count = countPRs(currentCategoryContent);
    if (!categories[currentCategory]) {
      categories[currentCategory] = count;
    }
  }

  // Handle changelogs without category headers (very old format)
  if (uncategorizedContent) {
    const uncategorizedPRs = countPRs(uncategorizedContent);
    if (uncategorizedPRs > 0) {
      categories['Uncategorized'] = uncategorizedPRs;
    }
  }

  const totalPRs = Object.values(categories).reduce((sum, count) => sum + count, 0);

  return {
    categories,
    totalPRs,
  };
}

/**
 * Parse contributors from changelog.
 */
export function parseContributors(body: string): {
  contributors: number;
  newContributors: number;
  contributorsList: string[];
  newContributorsList: string[];
} {
  // Normalize line endings (GitHub API returns \r\n)
  const normalizedBody = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedBody.split('\n');
  let inContributors = false;
  let inFirstTime = false;
  let contributorsList = '';
  let firstTimeList = '';

  for (const line of lines) {
    if (FIRST_TIME_CONTRIBUTORS_REGEX.test(line)) {
      inContributors = false;
      inFirstTime = true;
      continue;
    }

    if (CONTRIBUTORS_SECTION_REGEX.test(line)) {
      inContributors = true;
      inFirstTime = false;
      continue;
    }

    // Stop at next major section
    if (line.startsWith('## ') && !CONTRIBUTORS_SECTION_REGEX.test(line) && !FIRST_TIME_CONTRIBUTORS_REGEX.test(line)) {
      if (inContributors || inFirstTime) break;
    }

    if (inContributors) {
      contributorsList += line + '\n';
    }
    if (inFirstTime) {
      firstTimeList += line + '\n';
    }
  }

  // Extract @mentions as contributors (normalize to lowercase for deduplication)
  const contributorMatches = contributorsList.match(/@[\w-]+/g) || [];
  const firstTimeMatches = firstTimeList.match(/@[\w-]+/g) || [];

  // Normalize mentions (remove @ and lowercase)
  const normalizedContributors = contributorMatches.map((m) => m.slice(1).toLowerCase());
  const normalizedNewContributors = firstTimeMatches.map((m) => m.slice(1).toLowerCase());

  return {
    contributors: normalizedContributors.length,
    newContributors: normalizedNewContributors.length,
    contributorsList: normalizedContributors,
    newContributorsList: normalizedNewContributors,
  };
}

/**
 * Parse a GitHub release into structured changelog data.
 */
export function parseRelease(release: GitHubRelease): ParsedChangelog {
  const version = release.tag_name.replace(/^v/, '');
  const date = release.published_at.split('T')[0];
  const body = release.body || '';

  // Parse categories - this is the source of truth
  const { categories, totalPRs } = parseModernChangelog(body);

  // Parse contributors
  const { contributors, newContributors, contributorsList, newContributorsList } =
    parseContributors(body);

  return {
    version,
    date,
    changelogUrl: release.html_url,
    totalPRs,
    categories,
    contributors,
    newContributors,
    contributorsList,
    newContributorsList,
  };
}
