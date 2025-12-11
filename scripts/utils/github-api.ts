import type { GitHubRelease } from './types.js';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'WordPress';
const REPO_NAME = 'gutenberg';

/**
 * Get authorization headers if GITHUB_TOKEN is available.
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'gutenberg-release-monitor',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
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

    const data: GitHubRelease[] = await response.json();

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

  return response.json();
}

/**
 * Filter releases by version range.
 */
export function filterReleasesByVersion(
  releases: GitHubRelease[],
  options: { from?: string; to?: string; version?: string }
): GitHubRelease[] {
  const { from, to, version } = options;

  if (version) {
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    return releases.filter((r) => r.tag_name === normalizedVersion);
  }

  return releases.filter((release) => {
    const releaseVersion = release.tag_name.replace(/^v/, '');

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
