# Data Types

TypeScript interfaces defining the data structures used throughout the application.

## Core Types

### Release

A single Gutenberg release with parsed changelog data.

```typescript
interface Release {
  gbVersion: string;           // e.g. "22.2.0"
  wpVersion: string | null;    // e.g. "6.9" or null if not in WP yet
  date: string;                // ISO format, e.g. "2025-01-15"
  isLastBeforeWPBeta: boolean; // True if last GB before WP beta freeze

  // PR metrics
  totalPRs: number;
  categories: Record<string, number>;  // e.g. { "Enhancements": 32, "Bug Fixes": 49 }

  // Contributors
  contributors: number;
  newContributors: number;
  contributorsList: string[];
  newContributorsList: string[];

  // Privacy-preserving aggregates (optional)
  contributorAggregates?: ReleaseContributorAggregates;

  // Metadata
  changelogUrl: string;
  parsedAt: string;
  parserVersion: string;
}
```

**Source**: `public/data/releases.json`

**Notes**:
- `categories` is the source of truth for all PR breakdowns
- `contributorAggregates` is computed separately and may not exist for all releases

### ReleaseContributorAggregates

Privacy-preserving contributor statistics for a single release.

```typescript
interface ReleaseContributorAggregates {
  stats: {
    total: number;
    newContributors: number;
  };
  sponsorBreakdown: Record<string, number>;  // { "Automattic": 15, "Unknown": 42 }
  countryBreakdown: Record<string, number>;  // { "United States": 20, "Unknown": 16 }
  aggregatedAt: string;                      // ISO timestamp
}
```

**Privacy**: Only aggregate counts are stored. Sum of breakdown values equals `stats.total`.

### WPVersionStats

Aggregated statistics for a WordPress version cycle.

```typescript
interface WPVersionStats {
  wpVersion: string;        // e.g. "6.9"
  gbVersionRange: string;   // e.g. "20.5-21.9"
  releaseCount: number;     // Number of GB releases in this WP cycle

  // Totals across all releases
  totalPRs: number;
  totalContributors: number;
  totalNewContributors: number;
  categoryTotals: Record<string, number>;  // Keyed by category ID

  // Averages per release
  avgPRsPerRelease: number;
  avgContributorsPerRelease: number;
  avgNewContributorsPerRelease: number;

  // Privacy-preserving aggregates (optional)
  contributorAggregates?: WPVersionContributorAggregates;
}
```

**Source**: `public/data/aggregated/by-wp-version.json`

### TimeSeriesPoint

Data point for trend charts.

```typescript
interface TimeSeriesPoint {
  gbVersion: string;
  date: string;
  totalPRs: number;
  categoryPRs: Record<string, number>;  // Keyed by category ID
  isLastBeforeWPBeta: boolean;
  wpVersion: string | null;
}
```

**Source**: `public/data/aggregated/time-series.json`

### Summary

Overall statistics across all releases.

```typescript
interface Summary {
  // Current WP cycle info
  currentWPCycle: string;       // e.g. "6.9"
  lastCutoffVersion: string;    // Last GB version in previous WP
  releasesSinceCutoff: number;  // Releases in current cycle

  // Current cycle averages
  avgPRsSinceCutoff: number;
  avgFeaturesSinceCutoff: number;
  avgBugsSinceCutoff: number;
  avgA11ySinceCutoff: number;
  avgPerfSinceCutoff: number;
  avgContributorsSinceCutoff: number;
  avgNewContributorsSinceCutoff: number;

  // Current cycle totals
  totalPRsSinceCutoff: number;
  totalFeaturesSinceCutoff: number;
  totalBugsSinceCutoff: number;
  totalA11ySinceCutoff: number;
  totalPerfSinceCutoff: number;
  uniqueContributorsSinceCutoff: number;
  uniqueNewContributorsSinceCutoff: number;

  // All-time averages
  avgPRsTotal: number;
  avgFeaturesTotal: number;
  avgBugsTotal: number;
  avgCodeQualityTotal: number;
  avgA11yTotal: number;
  avgPerfTotal: number;
  avgContributorsTotal: number;
  avgNewContributorsTotal: number;

  // Metadata
  latestRelease: string;
  oldestRelease: string;
  totalReleases: number;
  lastUpdated: string;
}
```

**Source**: `public/data/aggregated/summary.json`

### WPRelease

WordPress release schedule entry.

```typescript
interface WPRelease {
  wpVersion: string;      // e.g. "6.9"
  beta1Date: string;      // ISO format
  stableDate: string;     // ISO format
  lastGBVersion: string;  // e.g. "21.9"
  gbVersionRange: string; // e.g. "20.5-21.9"
}
```

**Source**: `public/data/wp-schedule.json`

## Type Relationships

```
WPRelease ──────────────────┐
  (schedule)                │
                            ▼
Release ◄───────────────► WPVersionStats
  │                          │
  │ contributorAggregates    │ contributorAggregates
  ▼                          ▼
ReleaseContributorAggregates   WPVersionContributorAggregates

TimeSeriesPoint ◄── derived from ── Release
Summary ◄── aggregated from ── Release[]
```

## Category Configuration

Categories are configured in `public/data/category-config.json`:

```typescript
interface CategoryConfig {
  aggregations: CategoryAggregation[];
}

interface CategoryAggregation {
  id: string;              // e.g. "features"
  label: string;           // e.g. "Features"
  color: string;           // CSS color
  rawCategories: string[]; // Changelog categories to sum
  defaultVisible: boolean;
}
```

**Default visible categories**: features, bugs, accessibility, performance, code-quality

**Available but hidden by default**: documentation, tools, experiments, mobile
