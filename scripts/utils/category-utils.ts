/**
 * Category utilities for computing aggregated values from raw categories.
 * Reads category configuration from the config file.
 */

import { readFileSync } from 'node:fs';
import type { Release } from '../../src/data/types.js';

/**
 * Category aggregation configuration.
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
 */
export function loadCategoryConfig(): CategoryConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const content = readFileSync('public/data/category-config.json', 'utf-8');
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

/**
 * Convenience functions for common aggregation IDs.
 * These use the config, so category mappings are defined in one place.
 */
export function getReleaseFeaturePRs(release: Release): number {
  return getAggregatedPRs(release, 'features');
}

export function getReleaseBugPRs(release: Release): number {
  return getAggregatedPRs(release, 'bugs');
}

export function getReleaseA11yPRs(release: Release): number {
  return getAggregatedPRs(release, 'a11y');
}

export function getReleasePerformancePRs(release: Release): number {
  return getAggregatedPRs(release, 'performance');
}

export function getReleaseCodeQualityPRs(release: Release): number {
  return getAggregatedPRs(release, 'codeQuality');
}

export function getReleaseDocumentationPRs(release: Release): number {
  return getAggregatedPRs(release, 'documentation');
}
