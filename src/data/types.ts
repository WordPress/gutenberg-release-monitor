/**
 * Contributor aggregate statistics for a single release.
 * Privacy-preserving: only counts, no individual data.
 */
export interface ReleaseContributorAggregates {
  /** Contributor statistics */
  stats: {
    total: number;
    newContributors: number;
  };
  /** Sponsor breakdown: { "Automattic": 15, "Unknown": 42, ... } - sum = total */
  sponsorBreakdown: Record<string, number>;
  /** Country breakdown: { "United States": 20, "Unknown": 16, ... } - sum = total */
  countryBreakdown: Record<string, number>;
  /** ISO timestamp of when aggregates were computed */
  aggregatedAt: string;
}

/**
 * A single Gutenberg release with parsed changelog data.
 */
export interface Release {
  /** Gutenberg version, e.g. "22.2.0" */
  gbVersion: string;

  /** WordPress version this release is included in, e.g. "6.9", or null if not yet in WP */
  wpVersion: string | null;

  /** Release date in ISO format, e.g. "2025-01-15" */
  date: string;

  /** Whether this is the last GB version before a WP beta freeze */
  isLastBeforeWPBeta: boolean;

  /** Total PRs in this release */
  totalPRs: number;

  /**
   * Raw category breakdown from changelog.
   * This is the source of truth - all category-specific counts are computed from this.
   * e.g. { "Enhancements": 32, "Bug Fixes": 49, "Documentation": 12 }
   */
  categories: Record<string, number>;

  /** Total unique contributors in this release */
  contributors: number;
  /** Contributors appearing for the first time in this release */
  newContributors: number;
  /** List of contributor usernames */
  contributorsList: string[];
  /** List of new contributor usernames */
  newContributorsList: string[];

  /** Privacy-preserving sponsor/country aggregates (computed separately) */
  contributorAggregates?: ReleaseContributorAggregates;

  /** URL to the changelog on GitHub */
  changelogUrl: string;

  /** ISO timestamp of when this data was last parsed */
  parsedAt: string;

  /** Version of the parser used, for tracking format changes */
  parserVersion: string;
}

/**
 * WordPress release schedule entry for tracking GB version cutoffs.
 */
export interface WPRelease {
  /** WordPress version, e.g. "6.9" */
  wpVersion: string;

  /** Beta 1 release date in ISO format */
  beta1Date: string;

  /** Stable release date in ISO format */
  stableDate: string;

  /** Last Gutenberg version before WP beta freeze, e.g. "21.9" */
  lastGBVersion: string;

  /** Range of GB versions included, e.g. "20.5-21.9" */
  gbVersionRange: string;
}

/**
 * Contributor aggregate statistics for a WP version.
 * Privacy-preserving: only counts, no individual data.
 */
export interface WPVersionContributorAggregates {
  /** Contributor statistics */
  stats: {
    /** Unique contributors across all GB releases in this WP version */
    total: number;
    /** Unique new contributors across all GB releases in this WP version */
    newContributors: number;
  };
  /** Sponsor breakdown: { "Automattic": 15, "Unknown": 42, ... } - sum = total */
  sponsorBreakdown: Record<string, number>;
  /** Country breakdown: { "United States": 20, "Unknown": 16, ... } - sum = total */
  countryBreakdown: Record<string, number>;
  /** ISO timestamp of when aggregates were computed */
  aggregatedAt: string;
}

/**
 * Aggregated statistics for a WordPress version.
 */
export interface WPVersionStats {
  /** WordPress version, e.g. "6.9" */
  wpVersion: string;
  /** Range of GB versions included, e.g. "20.5-21.9" */
  gbVersionRange: string;
  /** Number of GB releases in this WP cycle */
  releaseCount: number;

  /** Total PRs across all releases in this WP version */
  totalPRs: number;
  /** Total unique contributors across all releases */
  totalContributors: number;
  /** Total new contributors across all releases */
  totalNewContributors: number;

  /** Category totals keyed by category ID from config */
  categoryTotals: Record<string, number>;

  /** Average PRs per release in this WP version */
  avgPRsPerRelease: number;
  /** Average contributors per release */
  avgContributorsPerRelease: number;
  /** Average new contributors per release */
  avgNewContributorsPerRelease: number;

  /** Privacy-preserving sponsor/country aggregates (computed separately) */
  contributorAggregates?: WPVersionContributorAggregates;
}

/**
 * Time series data point for charts.
 */
export interface TimeSeriesPoint {
  /** Gutenberg version, e.g. "22.2.0" */
  gbVersion: string;
  /** Release date in ISO format */
  date: string;
  /** Total PRs in this release */
  totalPRs: number;
  /** PR counts keyed by category ID */
  categoryPRs: Record<string, number>;
  /** Whether this is the last GB version before a WP beta freeze */
  isLastBeforeWPBeta: boolean;
  /** WordPress version this release belongs to, or null */
  wpVersion: string | null;
}

/**
 * Summary statistics across all releases.
 */
export interface Summary {
  /** Current WordPress version cycle, e.g. "7.0" */
  currentWPCycle: string;
  /** Last GB version in the previous WP cycle */
  lastCutoffVersion: string;
  /** Number of GB releases since the last WP cutoff */
  releasesSinceCutoff: number;

  /** Average PRs per release in current WP cycle */
  avgPRsSinceCutoff: number;
  /** Average feature PRs per release in current cycle */
  avgFeaturesSinceCutoff: number;
  /** Average bug fix PRs per release in current cycle */
  avgBugsSinceCutoff: number;
  /** Average accessibility PRs per release in current cycle */
  avgA11ySinceCutoff: number;
  /** Average performance PRs per release in current cycle */
  avgPerfSinceCutoff: number;
  /** Average contributors per release in current cycle */
  avgContributorsSinceCutoff: number;
  /** Average new contributors per release in current cycle */
  avgNewContributorsSinceCutoff: number;

  /** Total PRs in current WP cycle */
  totalPRsSinceCutoff: number;
  /** Total feature PRs in current cycle */
  totalFeaturesSinceCutoff: number;
  /** Total bug fix PRs in current cycle */
  totalBugsSinceCutoff: number;
  /** Total accessibility PRs in current cycle */
  totalA11ySinceCutoff: number;
  /** Total performance PRs in current cycle */
  totalPerfSinceCutoff: number;
  /** Unique contributors in current cycle */
  uniqueContributorsSinceCutoff: number;
  /** Unique new contributors in current cycle */
  uniqueNewContributorsSinceCutoff: number;

  /** All-time average PRs per release */
  avgPRsTotal: number;
  /** All-time average feature PRs per release */
  avgFeaturesTotal: number;
  /** All-time average bug fix PRs per release */
  avgBugsTotal: number;
  /** All-time average code quality PRs per release */
  avgCodeQualityTotal: number;
  /** All-time average accessibility PRs per release */
  avgA11yTotal: number;
  /** All-time average performance PRs per release */
  avgPerfTotal: number;
  /** All-time average contributors per release */
  avgContributorsTotal: number;
  /** All-time average new contributors per release */
  avgNewContributorsTotal: number;

  /** Most recent GB release version */
  latestRelease: string;
  /** Oldest GB release version in dataset */
  oldestRelease: string;
  /** Total number of releases in dataset */
  totalReleases: number;
  /** ISO timestamp of last data update */
  lastUpdated: string;
}
