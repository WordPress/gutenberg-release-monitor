import type { GitHubRelease, ParsedChangelog } from './types.js';

/**
 * Category mappings for PR classification.
 * Maps various changelog header variations to our standard categories.
 */
const CATEGORY_MAPPINGS: Record<string, keyof Pick<ParsedChangelog, 'featurePRs' | 'bugPRs' | 'a11yPRs' | 'performancePRs'>> = {
  // Feature/Enhancement categories
  enhancements: 'featurePRs',
  features: 'featurePRs',
  'new features': 'featurePRs',

  // Bug fix categories
  'bug fixes': 'bugPRs',
  bugfixes: 'bugPRs',
  fixes: 'bugPRs',

  // Accessibility categories
  accessibility: 'a11yPRs',
  'accessibility improvements': 'a11yPRs',
  a11y: 'a11yPRs',

  // Performance categories
  performance: 'performancePRs',
  'performance improvements': 'performancePRs',
};

/**
 * Regex to match PR links in changelog entries.
 * Matches patterns like: ([12345](https://github.com/...))
 */
const PR_LINK_REGEX = /\(\[(\d+)\]\([^)]+\)\)/g;

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
 */
function countPRs(text: string): number {
  const matches = text.match(PR_LINK_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Parse the modern changelog format (v12+).
 * Uses ### Category and #### Subcategory headers.
 */
export function parseModernChangelog(body: string): {
  categories: Record<string, number>;
  featurePRs: number;
  bugPRs: number;
  a11yPRs: number;
  performancePRs: number;
  totalPRs: number;
} {
  // Normalize line endings (GitHub API returns \r\n)
  const normalizedBody = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedBody.split('\n');
  const categories: Record<string, number> = {};

  let currentCategory = '';
  let currentCategoryContent = '';
  let inChangelog = false;

  // Track our standard PR counts
  let featurePRs = 0;
  let bugPRs = 0;
  let a11yPRs = 0;
  let performancePRs = 0;

  for (const line of lines) {
    // Check for changelog section start
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
        const mapping = CATEGORY_MAPPINGS[currentCategory.toLowerCase()];
        if (mapping === 'featurePRs') featurePRs += count;
        else if (mapping === 'bugPRs') bugPRs += count;
        else if (mapping === 'a11yPRs') a11yPRs += count;
        else if (mapping === 'performancePRs') performancePRs += count;
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
        const mapping = CATEGORY_MAPPINGS[currentCategory.toLowerCase()];
        if (mapping === 'featurePRs') featurePRs += count;
        else if (mapping === 'bugPRs') bugPRs += count;
        else if (mapping === 'a11yPRs') a11yPRs += count;
        else if (mapping === 'performancePRs') performancePRs += count;
      }

      currentCategory = categoryMatch[1].trim();
      currentCategoryContent = '';
      continue;
    }

    // Skip subcategory headers but keep tracking content
    if (SUBCATEGORY_HEADER_REGEX.test(line)) {
      continue;
    }

    // Accumulate content for current category
    if (currentCategory) {
      currentCategoryContent += line + '\n';
    }
  }

  // Handle last category if we didn't hit contributors section
  if (currentCategory && currentCategoryContent) {
    const count = countPRs(currentCategoryContent);
    if (!categories[currentCategory]) {
      categories[currentCategory] = count;
      const mapping = CATEGORY_MAPPINGS[currentCategory.toLowerCase()];
      if (mapping === 'featurePRs') featurePRs += count;
      else if (mapping === 'bugPRs') bugPRs += count;
      else if (mapping === 'a11yPRs') a11yPRs += count;
      else if (mapping === 'performancePRs') performancePRs += count;
    }
  }

  const totalPRs = Object.values(categories).reduce((sum, count) => sum + count, 0);

  return {
    categories,
    featurePRs,
    bugPRs,
    a11yPRs,
    performancePRs,
    totalPRs,
  };
}

/**
 * Parse contributors from changelog.
 */
export function parseContributors(body: string): {
  contributors: number;
  newContributors: number;
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

  // Count @mentions as contributors
  const contributorMatches = contributorsList.match(/@[\w-]+/g);
  const firstTimeMatches = firstTimeList.match(/@[\w-]+/g);

  return {
    contributors: contributorMatches ? contributorMatches.length : 0,
    newContributors: firstTimeMatches ? firstTimeMatches.length : 0,
  };
}

/**
 * Parse a GitHub release into structured changelog data.
 */
export function parseRelease(release: GitHubRelease): ParsedChangelog {
  const version = release.tag_name.replace(/^v/, '');
  const date = release.published_at.split('T')[0];
  const body = release.body || '';

  // Parse categories and PR counts
  const { categories, featurePRs, bugPRs, a11yPRs, performancePRs, totalPRs } =
    parseModernChangelog(body);

  // Parse contributors
  const { contributors, newContributors } = parseContributors(body);

  return {
    version,
    date,
    changelogUrl: release.html_url,
    totalPRs,
    featurePRs,
    bugPRs,
    a11yPRs,
    performancePRs,
    contributors,
    newContributors,
    categories,
  };
}
