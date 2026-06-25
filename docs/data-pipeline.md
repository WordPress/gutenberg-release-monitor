# Data Pipeline

This document describes the scripts that fetch, parse, and aggregate release data.

## Overview

```text
GitHub API ─────► build-gb-releases.ts ─────► gb-releases.json
                                                    │
                                                    ▼
                                          build-wp-cycles.ts
                                                    │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                              wp-cycles.json                  summary.json

                        compute-contributor-stats.ts
                                    │
                                    ▼
                      (adds contributorAggregates to both JSON files;
                       WP-cycle breakdowns use unique contributors)
```

## Scripts

### build-gb-releases.ts

Fetches Gutenberg releases from GitHub and parses changelog markdown.

**Location**: `scripts/build-gb-releases.ts`

**npm script**:

```bash
npm run data-sync:gb-releases
```

**Input**: GitHub API (releases endpoint for `WordPress/gutenberg`)

**Output**: `public/data/gb-releases.json`

**Process**:

1. Fetch all releases from GitHub API
1. Parse each release's changelog markdown
1. Extract PR counts by category
1. Extract contributor usernames from `@mentions`
1. Map to WordPress versions using `scripts/data/wp-schedule.json`
1. Transform to `NormalizedRelease[]` format

**Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Recommended | Increases API rate limit from 60 to 5000 requests/hour |

---

### build-wp-cycles.ts

Computes aggregated statistics by WordPress version.

**Location**: `scripts/build-wp-cycles.ts`

**npm script**:

```bash
npm run data-sync:wp-cycles
```

**Input**: `public/data/gb-releases.json`

**Output**:

- `public/data/wp-cycles.json` - Per-WP-version aggregates
- `public/data/summary.json` - Overall statistics

**Computed Metrics**:

- Total PRs, contributors, new contributors per WP cycle
- Average PRs per release
- Category totals (pre-aggregated using category config)
- Current WP cycle progress
- Since-cutoff vs all-time comparisons

Sponsor/country breakdowns live in `compute-contributor-stats.ts`. When this
script rebuilds cycle totals, it carries existing `contributorAggregates` forward
instead of deriving them from release-level counts.

---

### compute-contributor-stats.ts

Computes privacy-preserving contributor statistics (sponsor/country breakdowns).

**Location**: `scripts/compute-contributor-stats.ts`

**npm script**:

```bash
npm run data-sync:contributor-stats
```

**Input**:

- `public/data/gb-releases.json` - For contributor lists
- WP.org API - For contributor profiles
- GitHub API - For fallback profile data
- `scripts/data/geocode-cache.json` - Country cache keyed by hashed location

**Output**: Updates `gb-releases.json` and `wp-cycles.json` with `contributorAggregates`

**Process**:

1. Load contributor list from release changelog
1. Fetch WP.org profile for each contributor
1. Extract company/sponsor from profile
1. Resolve country from location, checking local aliases and the cache before Nominatim
1. Aggregate counts (no individual data stored)
1. Write aggregates back to release data
1. Refresh affected WP-cycle breakdowns using every release in each touched cycle

For a Gutenberg release, sponsor/country counts cover that release. For a WP
cycle, they count unique contributors across the cycle, so their totals line up
with `contributors`.

**Geocoding reliability**:

Geocoding checks local aliases first, then the persisted cache. It calls OpenStreetMap Nominatim only when neither can answer. The cache keeps a SHA-256 hash of the cleaned location with the resolved country and status, never the raw profile location.

Temporary Nominatim problems such as 403, 429, 5xx, timeouts, and network errors are retried with backoff. If they still fail, the contributor aggregate script stops before writing release data. A bad API day should not turn real countries into `"Unknown"` in committed data.

**Privacy Model**:

Only aggregate counts are stored. Individual contributor data is fetched on-demand and discarded after aggregation.

```text
Individual: @user1 → "Automattic" → counted
            @user2 → "Unknown" → counted

Stored: { "Automattic": 1, "Unknown": 1 }
```

---

### build-username-mapping.ts

Creates mapping between GitHub usernames and WP.org profiles.

**Location**: `scripts/build-username-mapping.ts`

**npm script**:

```bash
npm run build-mapping
```

**Output**: `scripts/data/username-mapping.json`

---

## Combined Commands

### Full Data Refresh

```bash
npm run data-sync:all
```

Runs `data-sync:gb-releases` + `data-sync:wp-cycles` in sequence.

### Complete Refresh with Contributors

```bash
npm run data-sync:all
npm run data-sync:contributor-stats
```

The contributor-stats step updates `gb-releases.json`, then refreshes the
WP-cycle breakdowns for cycles touched by newly aggregated Gutenberg releases.

## Data Files

### gb-releases.json

Array of `NormalizedRelease` objects representing individual Gutenberg releases.

```typescript
{
  id: "22.2",
  version: "22.2",
  displayLabel: "Gutenberg 22.2",
  isAggregated: false,
  totalPRs: 150,
  contributors: 45,
  newContributors: 5,
  date: "2024-12-15",
  memberOf: "6.9",
  rawCategories: { "Enhancements": 32, "Bug Fixes": 49, ... },
  contributorAggregates: { ... }
}
```

### wp-cycles.json

Array of `NormalizedRelease` objects representing aggregated WP version data.

```typescript
{
  id: "6.9",
  version: "6.9",
  displayLabel: "WordPress 6.9",
  isAggregated: true,
  totalPRs: 850,
  avgPRs: 141.67,
  groupedCount: 6,
  groupedRange: "22.0-22.5",
  categoryTotals: { "features": 200, "bugs": 300, ... },
  contributorAggregates: { ... }
}
```

### summary.json

Single `SourceSummary` object with overall statistics.

```typescript
{
  currentPeriod: "6.9",
  releasesSinceCutoff: 6,
  avgPRsSinceCutoff: 141.67,
  avgPRsTotal: 125.3,
  totalReleases: 150,
  lastUpdated: "2024-12-23T10:00:00Z"
}
```

### wp-schedule.json

WordPress release schedule mapping.

**Location**: `scripts/data/wp-schedule.json`

```json
{
  "releases": [
    {
      "wpVersion": "6.9",
      "beta1Date": "2025-03-04",
      "stableDate": "2025-04-15",
      "lastGBVersion": "20.8.0"
    }
  ]
}
```

**Note**: This file is maintained manually. Update it when new WordPress releases are scheduled.

## Script Utilities

Located in `scripts/utils/`:

| Utility | Purpose |
|---------|---------|
| `changelog-parser.ts` | Parse changelog markdown |
| `github-api.ts` | GitHub API client |
| `wporg-api.ts` | WP.org API client |
| `contributor-data.ts` | Profile fetching |
| `sponsor-normalization.ts` | Company name normalization |
| `geocoding.ts` | Location → country mapping |
| `category-utils.ts` | Category aggregation |
| `release-utils.ts` | Release data utilities |
| `file-utils.ts` | JSON I/O with change detection |

## Sponsor Normalization

Company names are normalized for consistent aggregation:

| Raw | Normalized |
|-----|------------|
| "Automattic, Inc." | "Automattic" |
| "Lead Engineer @bigbite" | "bigbite" |
| "Freelance", "#opentowork" | "Self-sponsored" |
| "", null, undefined | "Unknown" |

See `scripts/utils/sponsor-normalization.ts` for the full mapping.

## Customization

### Changelog Parser

The parser in `scripts/utils/changelog-parser.ts` handles multiple changelog formats:

- Modern format (v8+): `### Category` headers
- Mid-era format (v6-v7): `## Category` headers
- Legacy format (v5-): Various formats

To adapt for another project, modify:

1. `parseChangelog()` - Main entry point
1. `extractCategories()` - Category detection
1. `extractContributors()` - Contributor extraction

### Category Mapping

Raw changelog categories are mapped using `public/config/categories.json`. The scripts use this configuration to:

1. Map raw category names to aggregation IDs
1. Compute totals for aggregated views
1. Maintain consistent category groupings

### Adding New Data Sources

To add a new data source:

1. Create a new script in `scripts/`
1. Add npm script to `package.json`
1. Output data to `public/data/`
1. Update the appropriate tab config to use the new endpoint

## Automated Refresh

See [Deployment](deployment.md) for GitHub Actions workflow that runs weekly data refresh.
