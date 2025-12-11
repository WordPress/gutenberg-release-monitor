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
