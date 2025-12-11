/**
 * Category utilities for computing aggregated values from raw categories.
 * The raw `categories` field is the source of truth - these utilities
 * compute derived values on-the-fly.
 */

import type { Release } from '../data/types.js';

const BASE_URL = import.meta.env.BASE_URL;

/**
 * Category aggregation configuration loaded from category-config.json.
 */
export interface CategoryAggregation {
  id: string;
  label: string;
  color: string;
  rawCategories: string[];
  includeByDefault: boolean;
}

export interface CategoryConfig {
  aggregations: CategoryAggregation[];
  version: string;
}

// Cache the loaded config
let cachedConfig: CategoryConfig | null = null;

/**
 * Load the category configuration from the JSON file.
 * Results are cached for performance.
 */
export async function loadCategoryConfig(): Promise<CategoryConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const response = await fetch(`${BASE_URL}data/category-config.json`);
  cachedConfig = await response.json();
  return cachedConfig!;
}

/**
 * Sum PR counts for specific raw category names.
 */
export function sumCategories(
  categories: Record<string, number>,
  rawCategoryNames: string[]
): number {
  return rawCategoryNames.reduce(
    (sum, name) => sum + (categories[name] || 0),
    0
  );
}

/**
 * Get aggregated PR count for a specific aggregation ID.
 * Requires config to be loaded first via loadCategoryConfig().
 */
export function getAggregatedPRs(
  categories: Record<string, number>,
  config: CategoryConfig,
  aggregationId: string
): number {
  const agg = config.aggregations.find((a) => a.id === aggregationId);
  if (!agg) return 0;
  return sumCategories(categories, agg.rawCategories);
}

/**
 * Calculate enhancement percentage for a release.
 */
export function getEnhancementPercent(
  release: Release,
  config: CategoryConfig
): number {
  const total = release.totalPRs || 1;
  const features = getAggregatedPRs(release.categories, config, 'features');
  return Math.round((features / total) * 100);
}

/**
 * Calculate bug fix percentage for a release.
 */
export function getBugfixPercent(
  release: Release,
  config: CategoryConfig
): number {
  const total = release.totalPRs || 1;
  const bugs = getAggregatedPRs(release.categories, config, 'bugs');
  return Math.round((bugs / total) * 100);
}

/**
 * Aggregate raw categories into configured groups.
 * Returns a map of aggregation id -> total count.
 */
export function aggregateCategories(
  categories: Record<string, number>,
  config: CategoryConfig
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const agg of config.aggregations) {
    result[agg.id] = sumCategories(categories, agg.rawCategories);
  }

  return result;
}

/**
 * Calculate percentages for aggregated categories.
 * Only includes categories in the selectedIds array.
 * Percentages are relative to the total of selected categories (sums to 100%).
 */
export function calculateCategoryPercentages(
  aggregated: Record<string, number>,
  selectedIds: string[]
): Record<string, number> {
  const selectedTotal = selectedIds.reduce(
    (sum, id) => sum + (aggregated[id] || 0),
    0
  );

  if (selectedTotal === 0) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const id of selectedIds) {
    result[id] = Math.round(((aggregated[id] || 0) / selectedTotal) * 100);
  }

  return result;
}

/**
 * Get the color for a category by its aggregation id.
 */
export function getCategoryColor(
  config: CategoryConfig,
  categoryId: string
): string {
  const agg = config.aggregations.find((a) => a.id === categoryId);
  return agg?.color || '#9E9E9E'; // Default to gray
}

/**
 * Get default selected category IDs from config.
 */
export function getDefaultSelectedCategories(config: CategoryConfig): string[] {
  return config.aggregations.filter((a) => a.includeByDefault).map((a) => a.id);
}
