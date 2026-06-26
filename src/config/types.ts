/**
 * Configuration types for the project.
 * These types define the structure of config/project.json.
 * @module config/types
 */

/** View mode options for the dashboard */
export type ViewMode = 'averages' | 'totals' | 'distribution' | 'sponsors' | 'countries' | 'ai-usage' | 'ai-tools' | 'ai-agents';

/** Chart type options */
export type ChartType = 'line' | 'bar' | 'area' | 'stacked';

/** Top-level dashboard section options. */
export type MetricType = 'prs' | 'contributors' | 'ai';

/**
 * Labels configuration for a tab.
 */
export interface TabLabels {
  /** Custom label for 'averages' toggle button (null = use metric name) */
  averagesToggle: string | null;
  /** Header text for averages stats section (null = don't show header) */
  statsHeader: string | null;
  /** Label for child items in aggregated views (singular, e.g., "Gutenberg release") */
  childItem: string | null;
  /** Column header for the primary version (e.g., "WP Version", "GB Version") */
  versionColumn: string | null;
  /** Column header for child versions in aggregated views (e.g., "GB Versions") */
  childVersionColumn: string | null;
  /** Column header for parent version in non-aggregated views (e.g., "WP Version" for GB releases) */
  parentVersionColumn: string | null;
  /** Prefix for parent version values (e.g., "WP" for displaying "WP 6.7") */
  parentVersionPrefix: string | null;
  /** Template for item context with {version} placeholder (e.g., "Included in WordPress {version}") */
  itemContext: string | null;
  /** Tooltip for special marker badges (e.g., beta cutoff indicator) */
  specialMarkerTooltip: string | null;
  /** Label for secondary chart series (e.g., "GB releases included") */
  chartSecondaryLabel: string | null;
}

/**
 * Tab configuration - defines a single tab/view in the dashboard.
 */
export interface TabConfig {
  /** Unique identifier for the tab (used in URL params) */
  id: string;
  /** Display title for the tab */
  title: string;
  /** Path to the data file relative to /data/ */
  dataEndpoint: string;
  /** Optional summary data file path relative to /data/ (falls back to dataSources.summary) */
  summaryEndpoint?: string;
  /** Whether this tab shows aggregated data (AggregatedStats vs SourceRelease) */
  isAggregated: boolean;
  /** Whether this tab is hidden by default (only visible when explicitly requested via URL) */
  hidden?: boolean;
  /** Prefix for display labels (e.g., 'WordPress' for 'WordPress 6.7') */
  versionPrefix: string;
  /** View modes available for this tab */
  supportedViewModes: ViewMode[];
  /** CSS class for the table card (null = no class) */
  tableCardClass: string | null;
  /** URL parameter key for version selection */
  urlParamKey: string;
  /** Summary field for default selected item (null = use first item) */
  defaultItemSummaryField: string | null;
  /** Whether to show reference lines on charts (e.g., special markers) */
  showReferenceLines: boolean;
  /** Labels for this tab's UI elements */
  labels: TabLabels;
}

/**
 * Project metadata and branding.
 */
export interface ProjectInfo {
  /** Project display name */
  name: string;
  /** Short description */
  description: string;
  /** URL to the project repository */
  projectUrl: string;
  /** Label for links (e.g., 'Gutenberg') */
  projectLabel: string;
  /** Disclaimer text shown below header */
  disclaimer: string;
  /** URL for 'Learn more' link */
  learnMoreUrl: string;
}

/**
 * Paths to data source files.
 */
export interface DataSources {
  /** Path to summary.json */
  summary: string;
}

/**
 * Default values for UI controls.
 */
export interface Defaults {
  /** Default tab ID */
  tab: string;
  /** Default view mode */
  viewMode: ViewMode;
  /** Default chart type */
  chartType: ChartType;
  /** Default metric type */
  metric: MetricType;
  /** Default number of releases to show */
  releaseCount: number;
}

/**
 * Root configuration object structure.
 */
export interface ProjectConfig {
  /** Config version for compatibility checking */
  version: string;
  /** Project metadata */
  project: ProjectInfo;
  /** Tab definitions */
  tabs: TabConfig[];
  /** Data source paths */
  dataSources: DataSources;
  /** Default values */
  defaults: Defaults;
}
