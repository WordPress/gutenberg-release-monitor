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

  // PR counts by category
  totalPRs: number;
  featurePRs: number;
  bugPRs: number;
  a11yPRs: number;
  performancePRs: number;

  // Contributors
  contributors: number;
  newContributors: number;
  contributorsList: string[];
  newContributorsList: string[];

  // Raw category data for debugging
  categories: Record<string, number>;
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
