/**
 * JSON file-based data provider implementation.
 * Fetches data from static JSON files in the public/data directory.
 * @module data/json-data-provider
 */

import type { DataProvider } from './data-provider';
import type { Release, WPVersionStats, TimeSeriesPoint, Summary } from './types';
import type { ProjectConfig, TabConfig } from '../config/types';

/**
 * Data provider that fetches from static JSON files.
 */
export class JsonDataProvider implements DataProvider {
  constructor(private config: ProjectConfig) {}

  /**
   * Fetch data for a specific tab based on its configuration.
   */
  async fetchTabData(tabConfig: TabConfig): Promise<Release[] | WPVersionStats[]> {
    const response = await fetch(`data/${tabConfig.dataEndpoint}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tab data: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Fetch summary statistics.
   */
  async fetchSummary(): Promise<Summary> {
    const response = await fetch(`data/${this.config.dataSources.summary}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch summary: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Fetch time series data for charts.
   */
  async fetchTimeSeries(): Promise<TimeSeriesPoint[]> {
    const response = await fetch(`data/${this.config.dataSources.timeSeries}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch time series: ${response.status}`);
    }
    return response.json();
  }
}

/**
 * Create a JSON data provider instance.
 */
export function createJsonDataProvider(config: ProjectConfig): DataProvider {
  return new JsonDataProvider(config);
}
