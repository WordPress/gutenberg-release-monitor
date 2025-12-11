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

  // PR counts
  totalPRs: number;
  featurePRs: number;
  bugPRs: number;
  a11yPRs: number;
  performancePRs: number;

  // Contributors
  contributors: number;
  newContributors: number;

  // Percentages (pre-calculated)
  enhancementPercent: number;
  bugfixPercent: number;

  // Metadata
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
 * Aggregated statistics for a WordPress version.
 */
export interface WPVersionStats {
  wpVersion: string;
  gbVersionRange: string;
  releaseCount: number;

  // Totals
  totalPRs: number;
  totalFeaturePRs: number;
  totalBugPRs: number;
  totalA11yPRs: number;
  totalPerformancePRs: number;
  totalContributors: number;
  totalNewContributors: number;

  // Averages per release
  avgPRsPerRelease: number;
  avgFeaturePRsPerRelease: number;
  avgBugPRsPerRelease: number;

  // Percentages
  avgEnhancementPercent: number;
  avgBugfixPercent: number;
}

/**
 * Time series data point for charts.
 */
export interface TimeSeriesPoint {
  gbVersion: string;
  date: string;
  totalPRs: number;
  featurePRs: number;
  bugPRs: number;
  a11yPRs: number;
  performancePRs: number;
  isLastBeforeWPBeta: boolean;
  wpVersion: string | null;
}

/**
 * Summary statistics across all releases.
 */
export interface Summary {
  // Current cycle info
  currentWPCycle: string;
  lastCutoffVersion: string;
  releasesSinceCutoff: number;

  // Averages in current WP cycle
  avgPRsSinceCutoff: number;
  avgFeaturesSinceCutoff: number;
  avgBugsSinceCutoff: number;
  avgA11ySinceCutoff: number;
  avgPerfSinceCutoff: number;
  avgContributorsSinceCutoff: number;
  avgNewContributorsSinceCutoff: number;

  // Totals in current WP cycle
  totalPRsSinceCutoff: number;
  totalFeaturesSinceCutoff: number;
  totalBugsSinceCutoff: number;
  totalA11ySinceCutoff: number;
  totalPerfSinceCutoff: number;

  // Total averages (all-time)
  avgPRsTotal: number;
  avgFeaturesTotal: number;
  avgBugsTotal: number;
  avgA11yTotal: number;
  avgPerfTotal: number;
  avgContributorsTotal: number;
  avgNewContributorsTotal: number;

  // Other stats
  latestRelease: string;
  oldestRelease: string;
  totalReleases: number;
  lastUpdated: string;
}
