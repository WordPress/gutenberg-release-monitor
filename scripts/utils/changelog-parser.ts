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
const BULLET_POINT_REGEX = /^[*-]\s+.+/;

/**
 * Regex to match a category header (### Category or ## Category).
 * Matches both modern format (###) and mid-era format (##).
 */
const CATEGORY_HEADER_REGEX = /^##?#\s+(.+)$/;

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
 * Regex to match PR links in HTML format (pull/12345).
 */
const HTML_PR_LINK_REGEX = /pull\/(\d+)/g;

/**
 * Parse HTML-formatted changelog (v5.x releases).
 * Handles both pure HTML (<h2>) and WordPress block markup (<!-- wp:heading -->).
 */
function parseHtmlChangelog(body: string): {
  categories: Record<string, number>;
  totalPRs: number;
} {
  const categories: Record<string, number> = {};

  // Split by <h2> headers to find sections
  const sections = body.split(/<h2>/i);

  for (const section of sections) {
    // Extract category name from content before </h2>
    const headerMatch = section.match(/^([^<]+)<\/h2>/i);
    if (!headerMatch) continue;

    const category = headerMatch[1].trim();

    // Count PR links in this section (pull/12345 format)
    const prMatches = section.match(HTML_PR_LINK_REGEX) || [];
    if (prMatches.length > 0) {
      categories[category] = prMatches.length;
    }
  }

  const totalPRs = Object.values(categories).reduce((sum, n) => sum + n, 0);
  return { categories, totalPRs };
}

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

  // Detect HTML format (v5.x releases) - delegate to specialized parser
  if (normalizedBody.includes('<h2>') && normalizedBody.includes('<ul>')) {
    return parseHtmlChangelog(normalizedBody);
  }

  const lines = normalizedBody.split('\n');
  const categories: Record<string, number> = {};

  let currentCategory = '';
  let currentCategoryContent = '';
  let uncategorizedContent = ''; // For changelogs without category headers

  // Check if there's a "## Changelog" header - if not, assume whole body is changelog (legacy format)
  const hasChangelogHeader = normalizedBody.includes('## Changelog');
  let inChangelog = !hasChangelogHeader; // Start in changelog mode for legacy format

  // Check if there are any category headers (## or ###)
  const hasCategoryHeaders = normalizedBody.match(CATEGORY_HEADER_REGEX);

  for (const line of lines) {
    // Check for changelog section start (modern format)
    if (line.match(/^##\s+Changelog/i)) {
      inChangelog = true;
      continue;
    }

    // Stop at contributors section - but only if we've already parsed changelog content
    // This handles cases where Contributors appears before Changelog (e.g., 15.8.0)
    if (CONTRIBUTORS_SECTION_REGEX.test(line) || FIRST_TIME_CONTRIBUTORS_REGEX.test(line)) {
      const hasContent = Object.keys(categories).length > 0 || (currentCategory && currentCategoryContent);
      if (hasContent) {
        // Save last category before exiting
        if (currentCategory && currentCategoryContent) {
          const count = countPRs(currentCategoryContent);
          categories[currentCategory] = count;
        }
        break;
      }
      // Otherwise, Contributors is before Changelog - skip it
      continue;
    }

    if (!inChangelog) continue;

    // Check for category header (## or ### Category)
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

  // Check for RC sections (format: = X.Y.Z-rc.N =) - these contain the main changelog
  // This handles releases like 16.8.0, 17.2.0, 17.3.0 where the main changelog is in RC sections
  // Some releases have multiple RC sections (e.g., 16.8.0 has rc.2 and rc.1)
  const rcMatches = [...normalizedBody.matchAll(/^= \d+\.\d+\.\d+-rc\.\d+ =/gm)];
  for (const rcMatch of rcMatches) {
    const rcStart = rcMatch.index!;
    // Find the end of this RC section (next RC section or end of body)
    const nextRcIndex = rcMatches.find((m) => m.index! > rcStart)?.index;
    const rcBody = nextRcIndex
      ? normalizedBody.slice(rcStart, nextRcIndex)
      : normalizedBody.slice(rcStart);

    // Parse this RC section
    const rcLines = rcBody.split('\n');
    let rcInChangelog = false;
    let rcCurrentCategory = '';
    let rcCurrentCategoryContent = '';

    for (const line of rcLines) {
      if (line.match(/^##\s+Changelog/i)) {
        rcInChangelog = true;
        continue;
      }

      // Stop at contributors section in RC
      if (CONTRIBUTORS_SECTION_REGEX.test(line) || FIRST_TIME_CONTRIBUTORS_REGEX.test(line)) {
        if (rcCurrentCategory && rcCurrentCategoryContent) {
          const count = countPRs(rcCurrentCategoryContent);
          categories[rcCurrentCategory] = (categories[rcCurrentCategory] || 0) + count;
        }
        break;
      }

      if (!rcInChangelog) continue;

      const categoryMatch = line.match(CATEGORY_HEADER_REGEX);
      if (categoryMatch) {
        if (rcCurrentCategory && rcCurrentCategoryContent) {
          const count = countPRs(rcCurrentCategoryContent);
          categories[rcCurrentCategory] = (categories[rcCurrentCategory] || 0) + count;
        }
        rcCurrentCategory = categoryMatch[1].trim();
        rcCurrentCategoryContent = '';
        continue;
      }

      if (SUBCATEGORY_HEADER_REGEX.test(line)) {
        continue;
      }

      if (rcCurrentCategory) {
        rcCurrentCategoryContent += line + '\n';
      }
    }

    // Handle last category from this RC section
    if (rcCurrentCategory && rcCurrentCategoryContent) {
      const count = countPRs(rcCurrentCategoryContent);
      categories[rcCurrentCategory] = (categories[rcCurrentCategory] || 0) + count;
    }
  }

  const totalPRs = Object.values(categories).reduce((sum, count) => sum + count, 0);

  return {
    categories,
    totalPRs,
  };
}

/**
 * Parse contributors from a single section of changelog text.
 */
function parseContributorsFromSection(text: string): {
  contributorsList: string;
  firstTimeList: string;
} {
  const lines = text.split('\n');
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

    // Stop at next major section (but not Contributors/First-time sections)
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

  return { contributorsList, firstTimeList };
}

/**
 * Parse contributors from changelog.
 * Handles both top-level and RC section contributors (for releases like 16.8, 17.2, 17.3).
 */
export function parseContributors(body: string): {
  contributors: number;
  newContributors: number;
  contributorsList: string[];
  newContributorsList: string[];
} {
  // Normalize line endings (GitHub API returns \r\n)
  const normalizedBody = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Parse top-level contributors
  let { contributorsList, firstTimeList } = parseContributorsFromSection(normalizedBody);

  // Also parse contributors from RC sections (format: = X.Y.Z-rc.N =)
  // This handles releases like 16.8.0, 17.2.0, 17.3.0 where contributors are in RC sections
  const rcMatches = [...normalizedBody.matchAll(/^= \d+\.\d+\.\d+-rc\.\d+ =/gm)];
  for (const rcMatch of rcMatches) {
    const rcStart = rcMatch.index!;
    // Find the end of this RC section (next RC section or end of body)
    const nextRcIndex = rcMatches.find((m) => m.index! > rcStart)?.index;
    const rcBody = nextRcIndex
      ? normalizedBody.slice(rcStart, nextRcIndex)
      : normalizedBody.slice(rcStart);

    // Parse contributors from this RC section
    const rcContributors = parseContributorsFromSection(rcBody);
    contributorsList += rcContributors.contributorsList;
    firstTimeList += rcContributors.firstTimeList;
  }

  // Extract @mentions as contributors (normalize to lowercase for deduplication)
  const contributorMatches = contributorsList.match(/@[\w-]+/g) || [];
  const firstTimeMatches = firstTimeList.match(/@[\w-]+/g) || [];

  // Normalize mentions (remove @ and lowercase) and deduplicate
  const normalizedContributors = [...new Set(contributorMatches.map((m) => m.slice(1).toLowerCase()))];
  const normalizedNewContributors = [...new Set(firstTimeMatches.map((m) => m.slice(1).toLowerCase()))];

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
