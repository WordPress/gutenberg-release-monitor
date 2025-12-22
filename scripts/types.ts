/**
 * Types used by scripts for parsing and aggregating data.
 * These are internal to scripts - UI uses types from src/data/normalized.ts
 */

/** Contributor aggregate statistics */
export interface ReleaseContributorAggregates {
  stats: {
    total: number;
    newContributors: number;
  };
  sponsorBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
  aggregatedAt: string;
}

/** Alias for WP version aggregates (same structure) */
export type WPVersionContributorAggregates = ReleaseContributorAggregates;

/** Raw parsed release data (internal to scripts) */
export interface Release {
  gbVersion: string;
  wpVersion: string | null;
  date: string;
  isLastBeforeWPBeta: boolean;
  totalPRs: number;
  categories: Record<string, number>;
  contributors: number;
  newContributors: number;
  contributorsList: string[];
  newContributorsList: string[];
  contributorAggregates?: ReleaseContributorAggregates;
  changelogUrl: string;
  parsedAt: string;
  parserVersion: string;
}

/** WordPress release schedule entry */
export interface WPRelease {
  wpVersion: string;
  beta1Date: string;
  stableDate: string;
  lastGBVersion: string;
  gbVersionRange: string;
}

/** Aggregated stats for a WP version (used by compute-release-aggregates) */
export interface WPVersionStats {
  wpVersion: string;
  gbVersionRange: string;
  releaseCount: number;
  totalPRs: number;
  totalContributors: number;
  totalNewContributors: number;
  categoryTotals: Record<string, number>;
  avgPRsPerRelease: number;
  avgContributorsPerRelease: number;
  avgNewContributorsPerRelease: number;
  contributorAggregates?: ReleaseContributorAggregates;
}
