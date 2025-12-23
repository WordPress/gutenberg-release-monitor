# Data Types

TypeScript interfaces defining the data structures used throughout the application.

## Overview

The codebase uses two sets of types:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Presentation** | `src/data/normalized.ts` | Types for UI components, match JSON files directly |
| **Scripts** | `scripts/types.ts` | Types for data processing scripts |

## Presentation Layer Types

These types are used by React components. JSON data files match these interfaces directly.

### NormalizedRelease

The main data interface used by all visualization components.

```typescript
interface NormalizedRelease {
  // Identity
  id: string;              // Unique identifier (same as version)
  version: string;         // Version string (e.g., "22.2" or "7.0")
  displayLabel: string;    // With prefix (e.g., "Gutenberg 22.2")
  isAggregated: boolean;   // Whether this groups other items

  // Core stats - totals
  totalPRs: number;
  contributors: number;
  newContributors: number;
  hasContributorData: boolean;

  // Core stats - averages (pre-computed)
  avgPRs: number;          // For aggregated: per grouped item; individual: same as total
  avgContributors: number;
  avgNewContributors: number;

  // Category data
  rawCategories?: Record<string, number>;   // Individual items only
  categoryTotals?: Record<string, number>;  // Aggregated items only

  // Contributor breakdown (when available)
  contributorAggregates?: ContributorAggregates;

  // Aggregated view fields
  groupedCount?: number;   // Number of items in this group
  groupedRange?: string;   // Range of grouped item versions

  // Individual item fields
  date?: string;           // Release date
  memberOf?: string;       // Which group this belongs to
  isSpecialMarker?: boolean;  // Has special marker (e.g., beta cutoff)
  changelogUrl?: string;   // URL to changelog
}
```

**Source**: `public/data/gb-releases.json` and `public/data/wp-cycles.json`

**Notes**:

- For aggregated items (WP versions), `avgPRs` = average per grouped release
- For individual items, `avgPRs` = `totalPRs` (same value)
- `categoryTotals` is pre-aggregated using category config
- `rawCategories` is the raw changelog breakdown

### ContributorAggregates

Privacy-preserving contributor statistics.

```typescript
interface ContributorAggregates {
  sponsorBreakdown: Record<string, number>;  // { "Automattic": 15, "Unknown": 42, ... }
  countryBreakdown: Record<string, number>;  // { "United States": 20, "Unknown": 16, ... }
}
```

**Privacy**: Only aggregate counts are stored. Individual contributor information is never persisted.

### SourceSummary

Overall dashboard statistics for comparisons.

```typescript
interface SourceSummary {
  // Current period info
  currentPeriod: string;       // e.g., "6.9"
  lastCutoffVersion: string;   // Last version in previous period
  releasesSinceCutoff: number;

  // Since-cutoff averages
  avgPRsSinceCutoff: number;
  avgContributorsSinceCutoff: number;
  avgNewContributorsSinceCutoff: number;

  // Since-cutoff totals
  totalPRsSinceCutoff: number;
  uniqueContributorsSinceCutoff: number;
  uniqueNewContributorsSinceCutoff: number;

  // All-time averages
  avgPRsTotal: number;
  avgContributorsTotal: number;
  avgNewContributorsTotal: number;

  // Metadata
  latestRelease: string;
  oldestRelease: string;
  totalReleases: number;
  lastUpdated: string;
}
```

**Source**: `public/data/summary.json`

## Configuration Types

See [Configuration Guide](configuration.md) for full documentation. Key types:

### ProjectConfig

```typescript
interface ProjectConfig {
  version: string;
  project: ProjectInfo;
  tabs: TabConfig[];
  dataSources: DataSources;
  defaults: Defaults;
}
```

### TabConfig

```typescript
interface TabConfig {
  id: string;
  title: string;
  dataEndpoint: string;
  isAggregated: boolean;
  versionPrefix: string;
  supportedViewModes: ViewMode[];
  tableCardClass: string | null;
  urlParamKey: string;
  defaultItemSummaryField: string | null;
  showReferenceLines: boolean;
  labels: TabLabels;
}
```

### CategoryConfig

```typescript
interface CategoryConfig {
  aggregations: CategoryAggregation[];
  version: string;
}

interface CategoryAggregation {
  id: string;
  labels: { full: string; short: string };
  color: string;
  rawCategories: string[];
  includeByDefault: boolean;
}
```

## Script Types

Types used internally by data processing scripts.

### Release

Raw parsed release data from GitHub.

```typescript
interface Release {
  gbVersion: string;           // e.g., "22.2.0"
  wpVersion: string | null;    // e.g., "6.9" or null
  date: string;                // ISO format
  isLastBeforeWPBeta: boolean;

  // PR metrics
  totalPRs: number;
  categories: Record<string, number>;  // Raw changelog categories

  // Contributors
  contributors: number;
  newContributors: number;
  contributorsList: string[];      // GitHub usernames
  newContributorsList: string[];

  // Optional aggregates
  contributorAggregates?: ReleaseContributorAggregates;

  // Metadata
  changelogUrl: string;
  parsedAt: string;
  parserVersion: string;
}
```

### ReleaseContributorAggregates

Script-internal format for contributor aggregates.

```typescript
interface ReleaseContributorAggregates {
  stats: {
    total: number;
    newContributors: number;
  };
  sponsorBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
  aggregatedAt: string;  // ISO timestamp
}
```

### WPRelease

WordPress release schedule entry.

```typescript
interface WPRelease {
  wpVersion: string;      // e.g., "6.9"
  beta1Date: string;      // ISO format
  stableDate: string;     // ISO format
  lastGBVersion: string;  // e.g., "21.9"
  gbVersionRange: string; // e.g., "20.5-21.9"
}
```

**Source**: `scripts/data/wp-schedule.json`

## Type Relationships

```text
                                 ┌─────────────────────┐
                                 │ scripts/data/       │
                                 │ wp-schedule.json    │
                                 │ (WPRelease[])       │
                                 └──────────┬──────────┘
                                            │ used by
                                            ▼
┌─────────────────────┐         ┌─────────────────────┐
│ GitHub API          │────────▶│ build-gb-releases   │
│ (releases endpoint) │         │ (creates Release[]) │
└─────────────────────┘         └──────────┬──────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │ public/data/            │
                              │ gb-releases.json        │
                              │ (NormalizedRelease[])   │
                              └────────────┬────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
         ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
         │ build-wp-cycles  │   │ compute-         │   │ React App        │
         │ (aggregates by   │   │ contributor-     │   │ (useTabData)     │
         │ WP version)      │   │ stats            │   └──────────────────┘
         └────────┬─────────┘   └────────┬─────────┘
                  │                      │
                  ▼                      ▼
       ┌──────────────────┐   ┌──────────────────┐
       │ wp-cycles.json   │   │ Updated with     │
       │ summary.json     │   │ ContributorAggs  │
       └──────────────────┘   └──────────────────┘
```

## Enums and Unions

### ViewMode

```typescript
type ViewMode = 'averages' | 'totals' | 'distribution' | 'sponsors' | 'countries';
```

### ChartType

```typescript
type ChartType = 'line' | 'bar' | 'area' | 'stacked';
```

### MetricType

```typescript
type MetricType = 'prs' | 'contributors';
```

## JSON File Schemas

### gb-releases.json

```typescript
type GBReleasesFile = NormalizedRelease[];
// Array of individual Gutenberg releases
// isAggregated: false
// Has: date, memberOf, rawCategories, changelogUrl
```

### wp-cycles.json

```typescript
type WPCyclesFile = NormalizedRelease[];
// Array of aggregated WP version entries
// isAggregated: true
// Has: groupedCount, groupedRange, categoryTotals
```

### summary.json

```typescript
type SummaryFile = SourceSummary;
// Single object with dashboard statistics
```
