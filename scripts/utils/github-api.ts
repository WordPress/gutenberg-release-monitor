/**
 * GitHub API utilities for fetching releases and user profiles.
 * Handles pagination, rate limiting, and authentication.
 * @module scripts/utils/github-api
 */

import type {
  GitHubRelease,
  GitHubUserProfile,
  GitHubMilestone,
  GitHubIssue,
  RepoIdentifier,
} from './types.js';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'WordPress';
const REPO_NAME = 'gutenberg';

/**
 * Get authorization headers if GITHUB_TOKEN is available.
 */
export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'gutenberg-release-monitor',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/** A merged PR as returned by the Search API (issues search). */
export interface SearchedPR {
  number: number;
  title: string;
  html_url: string;
  user: { login: string } | null;
  merged_at: string | null;
  closed_at: string | null;
}

/**
 * Search merged PRs in the Gutenberg repo matching a query fragment.
 * The repo, `is:pr`, and `is:merged` qualifiers are added automatically.
 *
 * Note: the Search API caps results at 1000 and uses a stricter rate limit
 * (30 req/min). Honor the rate-limit headers as the REST helpers do.
 */
export async function searchMergedPRs(queryFragment: string): Promise<SearchedPR[]> {
  const results: SearchedPR[] = [];
  let page = 1;
  const perPage = 100;
  const query = `repo:${REPO_OWNER}/${REPO_NAME} is:pr is:merged ${queryFragment}`;

  while (true) {
    const url = `${GITHUB_API_BASE}/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (response.status === 403 && remaining === '0') {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const resetDate = resetTime
          ? new Date(parseInt(resetTime) * 1000)
          : null;
        throw new Error(
          `GitHub Search API rate limit exceeded. Resets at ${resetDate?.toISOString() ?? 'unknown'}`
        );
      }
      throw new Error(`GitHub Search API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      total_count: number;
      items: Array<{
        number: number;
        title: string;
        html_url: string;
        user: { login: string } | null;
        closed_at: string | null;
        pull_request?: { merged_at: string | null };
      }>;
    };

    const items = data.items ?? [];
    for (const item of items) {
      results.push({
        number: item.number,
        title: item.title,
        html_url: item.html_url,
        user: item.user ? { login: item.user.login } : null,
        merged_at: item.pull_request?.merged_at ?? null,
        closed_at: item.closed_at,
      });
    }

    if (items.length < perPage) break;
    if (page * perPage >= Math.min(data.total_count, 1000)) break;
    page++;
  }

  return results;
}

/**
 * Fetch all releases from the Gutenberg repository.
 * Handles pagination automatically.
 */
export async function fetchAllReleases(): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  let page = 1;
  const perPage = 100;

  console.log('Fetching releases from GitHub...');

  while (true) {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (response.status === 403 && remaining === '0') {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const resetDate = resetTime
          ? new Date(parseInt(resetTime) * 1000)
          : null;
        throw new Error(
          `GitHub API rate limit exceeded. Resets at ${resetDate?.toISOString() ?? 'unknown'}`
        );
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubRelease[];

    if (data.length === 0) {
      break;
    }

    releases.push(...data);
    console.log(`  Fetched page ${page} (${data.length} releases)`);

    if (data.length < perPage) {
      break;
    }

    page++;
  }

  console.log(`Total releases fetched: ${releases.length}`);
  return releases;
}

/**
 * Fetch a specific release by tag name.
 */
export async function fetchReleaseByTag(tag: string): Promise<GitHubRelease | null> {
  // Ensure tag has 'v' prefix
  const normalizedTag = tag.startsWith('v') ? tag : `v${tag}`;

  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${normalizedTag}`;
  const response = await fetch(url, { headers: getHeaders() });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GitHubRelease;
}

/**
 * Check if a version is a release candidate.
 */
export function isReleaseCandidate(version: string): boolean {
  return version.includes('-rc') || version.includes('-RC');
}

/**
 * Get the minor version from a full version string.
 * e.g., "20.1.2" -> "20.1", "20.0.0" -> "20.0"
 */
export function getMinorVersion(version: string): string {
  const cleanVersion = version.replace(/^v/, '');
  const parts = cleanVersion.split('.');
  return `${parts[0]}.${parts[1] ?? '0'}`;
}

/**
 * Check if a version is a patch release (not x.y.0).
 */
export function isPatchRelease(version: string): boolean {
  const cleanVersion = version.replace(/^v/, '');
  const parts = cleanVersion.split('.');
  const patch = parseInt(parts[2] ?? '0', 10);
  return patch > 0;
}

/**
 * Filter releases by version range.
 * By default, excludes release candidates.
 */
export function filterReleasesByVersion(
  releases: GitHubRelease[],
  options: { from?: string; to?: string; version?: string; includeRC?: boolean }
): GitHubRelease[] {
  const { from, to, version, includeRC = false } = options;

  if (version) {
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    return releases.filter((r) => r.tag_name === normalizedVersion);
  }

  return releases.filter((release) => {
    const releaseVersion = release.tag_name.replace(/^v/, '');

    // Filter out release candidates unless explicitly included
    if (!includeRC && isReleaseCandidate(releaseVersion)) {
      return false;
    }

    if (from && compareVersions(releaseVersion, from) < 0) {
      return false;
    }

    if (to && compareVersions(releaseVersion, to) > 0) {
      return false;
    }

    return true;
  });
}

/**
 * Compare two semver version strings.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
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
 * Fetch a GitHub user profile by username.
 */
export async function fetchGitHubUserProfile(
  username: string
): Promise<GitHubUserProfile | null> {
  const url = `${GITHUB_API_BASE}/users/${username}`;
  const response = await fetch(url, { headers: getHeaders() });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (response.status === 403 && remaining === '0') {
      const resetTime = response.headers.get('x-ratelimit-reset');
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
      throw new Error(
        `GitHub API rate limit exceeded. Resets at ${resetDate?.toISOString() ?? 'unknown'}`
      );
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    login: string;
    name: string | null;
    company: string | null;
    location: string | null;
    bio: string | null;
  };
  return {
    login: data.login,
    name: data.name || null,
    company: data.company || null,
    location: data.location || null,
    bio: data.bio || null,
  };
}

/**
 * Default repository (Gutenberg) for backward compatibility.
 */
export const DEFAULT_REPO: RepoIdentifier = {
  owner: REPO_OWNER,
  name: REPO_NAME,
};

/**
 * Fetch all milestones from a repository.
 * Includes both open and closed milestones.
 */
export async function fetchMilestones(
  repo: RepoIdentifier = DEFAULT_REPO
): Promise<GitHubMilestone[]> {
  const milestones: GitHubMilestone[] = [];
  let page = 1;
  const perPage = 100;

  console.log(`Fetching milestones from ${repo.owner}/${repo.name}...`);

  while (true) {
    const url = `${GITHUB_API_BASE}/repos/${repo.owner}/${repo.name}/milestones?state=all&page=${page}&per_page=${perPage}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (response.status === 403 && remaining === '0') {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
        throw new Error(
          `GitHub API rate limit exceeded. Resets at ${resetDate?.toISOString() ?? 'unknown'}`
        );
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubMilestone[];

    if (data.length === 0) {
      break;
    }

    milestones.push(...data);
    console.log(`  Fetched page ${page} (${data.length} milestones)`);

    if (data.length < perPage) {
      break;
    }

    page++;
  }

  console.log(`Total milestones fetched: ${milestones.length}`);
  return milestones;
}

/**
 * Fetch all issues/PRs for a specific milestone.
 * Returns only closed items (issues and PRs).
 */
export async function fetchMilestoneIssues(
  repo: RepoIdentifier,
  milestoneNumber: number
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${GITHUB_API_BASE}/repos/${repo.owner}/${repo.name}/issues?milestone=${milestoneNumber}&state=closed&page=${page}&per_page=${perPage}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (response.status === 403 && remaining === '0') {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
        throw new Error(
          `GitHub API rate limit exceeded. Resets at ${resetDate?.toISOString() ?? 'unknown'}`
        );
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubIssue[];

    if (data.length === 0) {
      break;
    }

    issues.push(...data);

    if (data.length < perPage) {
      break;
    }

    page++;
  }

  return issues;
}

/**
 * Filter issues to get only merged PRs.
 */
export function filterMergedPRs(issues: GitHubIssue[]): GitHubIssue[] {
  return issues.filter(
    (issue) => issue.pull_request && issue.pull_request.merged_at !== null
  );
}
