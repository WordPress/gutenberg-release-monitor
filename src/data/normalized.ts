/**
 * Normalized data types for the presentation layer.
 * JSON files match these types directly - no runtime transformation needed.
 * UI components should only work with these types.
 */

/**
 * Contributor aggregates - breakdown data for sponsors/countries.
 */
export interface ContributorAggregates {
  /** Sponsor breakdown: { "Company A": 15, "Unknown": 42, ... } */
  sponsorBreakdown: Record<string, number>;
  /** Country breakdown: { "United States": 20, "Unknown": 16, ... } */
  countryBreakdown: Record<string, number>;
}

/**
 * AI involvement breakdown for a release or cycle.
 * Counts only *disclosed* AI use (body markers / agent authors), so it is a lower bound.
 */
export interface AIBreakdown {
  /** PRs per tool. A PR using two tools counts in both, so this can exceed aiPRs. */
  byTool: Record<string, number>;
  /** PRs where a human author disclosed AI use. */
  assisted: number;
  /** PRs opened directly by an autonomous agent. */
  autonomous: number;
}

/**
 * Normalized release - unified interface for all tab data.
 * Represents either an aggregated view (by-wp-version) or individual release.
 * JSON files match this structure exactly.
 */
export interface NormalizedRelease {
  /** Unique identifier (same as version) */
  id: string;
  /** Version string (e.g., "22.2" or "7.0") */
  version: string;
  /** Display label with prefix (e.g., "Gutenberg 22.2") */
  displayLabel: string;
  /** Whether this groups other items */
  isAggregated: boolean;

  // Core stats - totals
  /** Total PRs */
  totalPRs: number;
  /** Total contributors */
  contributors: number;
  /** New contributors */
  newContributors: number;
  /** Whether contributor data is available */
  hasContributorData: boolean;

  // Core stats - averages (pre-computed)
  // For aggregated: average per grouped item
  // For individual: same as totals
  /** PRs for averages view */
  avgPRs: number;
  /** Contributors for averages view */
  avgContributors: number;
  /** New contributors for averages view */
  avgNewContributors: number;

  // Category data
  /** Raw category breakdown (individual items only) */
  rawCategories?: Record<string, number>;
  /** Pre-aggregated category totals (aggregated items) */
  categoryTotals?: Record<string, number>;

  // Contributor breakdown
  /** Sponsor/country aggregates */
  contributorAggregates?: ContributorAggregates;

  // Aggregated view fields (items that group other items)
  /** Number of items in this group */
  groupedCount?: number;
  /** Range of grouped item versions */
  groupedRange?: string;

  // Individual item fields
  /** Release date (individual items only) */
  date?: string;
  /** Which group this item belongs to */
  memberOf?: string;
  /** Whether this item has a special marker */
  isSpecialMarker?: boolean;
  /** URL to changelog (individual items only) */
  changelogUrl?: string;

  // AI involvement (disclosed)
  /** Merged PRs in this release/group with disclosed AI involvement. */
  aiPRs?: number;
  /** Breakdown of those AI PRs by tool and by mode. */
  aiBreakdown?: AIBreakdown;
}

/**
 * Summary statistics for the dashboard.
 */
export interface SourceSummary {
  /** Current period identifier */
  currentPeriod: string;
  /** Last cutoff version */
  lastCutoffVersion: string;
  /** Number of releases since cutoff */
  releasesSinceCutoff: number;
  /** Since-cutoff averages */
  avgPRsSinceCutoff: number;
  avgContributorsSinceCutoff: number;
  avgNewContributorsSinceCutoff: number;
  /** Since-cutoff totals */
  totalPRsSinceCutoff: number;
  uniqueContributorsSinceCutoff: number;
  uniqueNewContributorsSinceCutoff: number;
  /** All-time averages */
  avgPRsTotal: number;
  avgContributorsTotal: number;
  avgNewContributorsTotal: number;
  /** Metadata */
  latestRelease: string;
  oldestRelease: string;
  totalReleases: number;
  lastUpdated: string;
}
