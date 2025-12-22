/**
 * Category utilities for computing aggregated values from raw categories.
 * Reads category configuration from the config file.
 * @module scripts/utils/category-utils
 */

import { readFileSync } from 'node:fs';
import type { Release } from '../types.js';

/**
 * Category aggregation configuration.
 */
export interface CategoryAggregation {
  /** Unique identifier, e.g. "features", "bugs" */
  id: string;
  /** Display label, e.g. "Features", "Bug Fixes" */
  label: string;
  /** CSS color for charts, e.g. "#4CAF50" */
  color: string;
  /** Raw changelog category names to sum, e.g. ["Enhancements", "New APIs"] */
  rawCategories: string[];
  /** Whether this category is visible by default in the UI */
  includeByDefault: boolean;
}

/**
 * Category configuration loaded from config/categories.json.
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
 */
export function loadCategoryConfig(): CategoryConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const content = readFileSync('public/config/categories.json', 'utf-8');
  cachedConfig = JSON.parse(content);
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
 * Get aggregated PR count for a specific aggregation ID from a release.
 */
export function getAggregatedPRs(
  release: Release,
  aggregationId: string
): number {
  const config = loadCategoryConfig();
  const agg = config.aggregations.find((a) => a.id === aggregationId);
  if (!agg) return 0;
  return sumCategories(release.categories || {}, agg.rawCategories);
}

