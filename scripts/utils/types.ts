/**
 * Type definitions for the data pipeline scripts.
 * Covers GitHub API responses, parsed changelogs, and contributor profiles.
 * @module scripts/utils/types
 */

/**
 * Raw GitHub release data from the API.
 */
export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

/**
 * Parsed changelog data before being converted to Release type.
 */
export interface ParsedChangelog {
  version: string;
  date: string;
  changelogUrl: string;

  /** Total PRs in this release */
  totalPRs: number;

  /**
   * Raw category breakdown from changelog - the source of truth.
   * e.g. { "Enhancements": 32, "Bug Fixes": 49, "Documentation": 12 }
   */
  categories: Record<string, number>;

  // Contributors
  contributors: number;
  newContributors: number;
  contributorsList: string[];
  newContributorsList: string[];
}

/**
 * CLI arguments for the parser.
 */
export interface ParseArgs {
  /** Parse only this specific version */
  version?: string;

  /** Parse versions starting from this one */
  from?: string;

  /** Parse versions up to this one */
  to?: string;

  /** Output file path */
  output?: string;

  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * WordPress.org profile data for a contributor.
 */
export interface ContributorProfile {
  username: string;
  wpProfileExists: boolean;

  // WP.org profile data (null if not found/not filled)
  employer: string | null;
  location: string | null;
  memberSince: string | null;
  badges: string[];

  // GitHub username linked from WP.org profile (may differ from WP.org username)
  wporgLinkedGitHubUsername: string | null;

  // GitHub fallback data
  githubCompany: string | null;
  githubLocation: string | null;

  // Track data source
  employerSource: 'wporg' | 'github' | null;

  fetchedAt: string;
}

/**
 * Container for all contributor profile data.
 */
export interface ContributorsData {
  contributors: Record<string, ContributorProfile>;
  summary: {
    total: number;
    profilesFound: number;
    withEmployer: number;
    withLocation: number;
    withBadges: number;
  };
  fetchedAt: string;
}

/**
 * GitHub user profile data (subset of fields we care about).
 */
export interface GitHubUserProfile {
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
}

/**
 * GitHub milestone data from the API.
 */
export interface GitHubMilestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  open_issues: number;
  closed_issues: number;
  created_at: string;
  updated_at: string;
  due_on: string | null;
  closed_at: string | null;
}

/**
 * GitHub issue/PR data from the API (subset of fields we care about).
 */
export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: {
    login: string;
  } | null;
  labels: Array<{
    name: string;
  }>;
  pull_request?: {
    merged_at: string | null;
  };
  created_at: string;
  closed_at: string | null;
}

/**
 * Repository identifier for multi-repo support.
 */
export interface RepoIdentifier {
  owner: string;
  name: string;
}
