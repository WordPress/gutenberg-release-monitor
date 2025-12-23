/**
 * Category utilities for computing aggregated values from raw categories.
 * The raw `categories` field is the source of truth - these utilities
 * compute derived values on-the-fly.
 */

/**
 * Category aggregation configuration loaded from categories.json.
 */
/** Category label variants */
export interface CategoryLabels {
  /** Full display label, e.g. "Bug Fixes", "Accessibility" */
  full: string;
  /** Short/abbreviated form, e.g. "Bugs", "A11y" */
  short: string;
}

export interface CategoryAggregation {
  /** Unique identifier, e.g. "features", "bugs" */
  id: string;
  /** Display labels in various forms */
  labels: CategoryLabels;
  /** CSS color for charts, e.g. "#4CAF50" */
  color: string;
  /** Raw changelog category names to sum, e.g. ["Enhancements", "New APIs"] */
  rawCategories: string[];
  /** Whether this category is visible by default in the UI */
  includeByDefault: boolean;
}

/**
 * Category configuration loaded from categories.json.
 */
export interface CategoryConfig {
  /** List of category aggregation definitions */
  aggregations: CategoryAggregation[];
  /** Config version for compatibility tracking */
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

  // Use relative path - resolves correctly from current page location
  const response = await fetch('config/categories.json');
  cachedConfig = await response.json();
  return cachedConfig!;
}

/**
 * Sum PR counts for specific raw category names.
 *
 * @param categories - Raw category counts from changelog (e.g., `{ "Bug Fixes": 10 }`)
 * @param rawCategoryNames - Category names to sum (e.g., `["Bug Fixes", "Bugfixes"]`)
 * @returns Total count across all matching categories
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
 *
 * @param categories - Raw category counts from release data
 * @param config - Loaded category configuration
 * @param aggregationId - Aggregation ID (e.g., "features", "bugs")
 * @returns Summed count for the aggregation, or 0 if not found
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
 * Aggregate raw categories into configured groups.
 *
 * @param categories - Raw category counts from release data
 * @param config - Loaded category configuration
 * @returns Map of aggregation ID to total count (e.g., `{ features: 42, bugs: 28 }`)
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
 *
 * @param aggregated - Map of aggregation ID to count
 * @param selectedIds - Category IDs to include in percentage calculation
 * @returns Map of category ID to percentage (rounded to whole number)
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
 *
 * @param config - Loaded category configuration
 * @param categoryId - Aggregation ID to look up
 * @returns Hex color string (e.g., "#4CAF50"), defaults to gray if not found
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
 *
 * @param config - Loaded category configuration
 * @returns Array of category IDs where `includeByDefault` is true
 */
export function getDefaultSelectedCategories(config: CategoryConfig): string[] {
  return config.aggregations.filter((a) => a.includeByDefault).map((a) => a.id);
}
