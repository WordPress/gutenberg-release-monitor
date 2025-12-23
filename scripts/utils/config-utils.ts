/**
 * Configuration utilities for scripts.
 * Loads project config to enable config-driven label generation.
 * @module scripts/utils/config-utils
 */

import { readFileSync, existsSync } from 'node:fs';
import type { ProjectConfig } from '../../src/config/types.js';

const CONFIG_PATH = 'public/config/project.json';

let cachedConfig: ProjectConfig | null = null;

/**
 * Load the project configuration from public/config/project.json.
 * Results are cached for the lifetime of the script execution.
 */
export function loadProjectConfig(): ProjectConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Project config not found: ${CONFIG_PATH}`);
  }

  const content = readFileSync(CONFIG_PATH, 'utf-8');
  cachedConfig = JSON.parse(content) as ProjectConfig;
  return cachedConfig;
}

/**
 * Get the version prefix for a given data endpoint.
 * Looks up the tab that uses this endpoint and returns its versionPrefix.
 * Falls back to project.projectLabel if no matching tab is found.
 *
 * @param endpoint - The data endpoint filename (e.g., 'gb-releases.json')
 * @returns The version prefix (e.g., 'Gutenberg' or 'WordPress')
 */
export function getVersionPrefixForEndpoint(endpoint: string): string {
  const config = loadProjectConfig();
  const tab = config.tabs.find((t) => t.dataEndpoint === endpoint);
  return tab?.versionPrefix ?? config.project.projectLabel;
}

/**
 * Clear the cached config (useful for testing).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
