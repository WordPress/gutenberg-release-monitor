/**
 * Data provider interface for abstracting data sources.
 * Allows swapping between JSON files, API, or database backends.
 * @module data/data-provider
 */

import type { Release, WPVersionStats, TimeSeriesPoint, Summary } from './types';
import type { TabConfig } from '../config/types';

/**
 * Abstract interface for data providers.
 * Implementations can fetch from JSON files, REST APIs, GraphQL, or databases.
 */
export interface DataProvider {
  /**
   * Fetch data for a specific tab.
   * @param tabConfig - Configuration for the tab to fetch data for
   * @returns Array of data items (Release[] or WPVersionStats[])
   */
  fetchTabData(tabConfig: TabConfig): Promise<Release[] | WPVersionStats[]>;

  /**
   * Fetch summary statistics.
   * @returns Summary data
   */
  fetchSummary(): Promise<Summary>;

  /**
   * Fetch time series data for charts.
   * @returns Array of time series points
   */
  fetchTimeSeries(): Promise<TimeSeriesPoint[]>;
}

/**
 * Context for providing the data provider to components.
 */
export type { DataProvider as default };
