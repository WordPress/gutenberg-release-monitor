/**
 * Normalized data type for the presentation layer.
 * This is the unified interface that all UI components work with.
 * Data providers convert their specific formats to this type.
 */

/**
 * Contributor aggregates - domain-agnostic breakdown data for the UI.
 * Data providers convert their specific formats to this structure.
 */
export interface ContributorAggregates {
  /** Sponsor breakdown: { "Company A": 15, "Unknown": 42, ... } */
  sponsorBreakdown: Record<string, number>;
  /** Country breakdown: { "United States": 20, "Unknown": 16, ... } */
  countryBreakdown: Record<string, number>;
}

/**
 * Normalized release - unified interface for the presentation layer.
 * Represents either an aggregated view or an individual release.
 * UI components should only work with this type - never with raw data types.
 */
export interface NormalizedRelease {
  /** Unique identifier (same as version) */
  id: string;
  /** Version string (raw, e.g., "19.0") */
  version: string;
  /** Display version without trailing .0 (e.g., "19") */
  displayVersion: string;
  /** Display label with prefix (e.g., "Gutenberg 19") */
  displayLabel: string;
  /** Whether this groups other items */
  isAggregated: boolean;

  // Core stats - totals (always present)
  /** Total PRs */
  totalPRs: number;
  /** Total contributors */
  contributors: number;
  /** New contributors */
  newContributors: number;
  /** Whether contributor data is available */
  hasContributorData: boolean;

  // Core stats - averages (pre-computed for UI)
  // For aggregated: computed average per grouped item
  // For individual: same as totals (no averaging possible)
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

  // Individual item fields (items that belong to a group)
  /** Release date (individual items only) */
  date?: string;
  /** Which group this item belongs to */
  memberOf?: string;
  /** Whether this item has a special marker */
  isSpecialMarker?: boolean;
  /** URL to changelog (individual items only) */
  changelogUrl?: string;
}
