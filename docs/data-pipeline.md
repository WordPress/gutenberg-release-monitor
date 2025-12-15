# Data Pipeline

## Overview

Data flows through a series of scripts that fetch, parse, and aggregate release information.

```
GitHub API ──► parse-changelog.ts ──► releases.json
                                           │
                                           ▼
                                    aggregate-data.ts
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
             summary.json       by-wp-version.json        time-series.json
```

## Scripts

### parse-changelog.ts

Fetches Gutenberg releases from GitHub and parses changelog markdown.

```bash
npm run parse
```

**Input**: GitHub API (releases endpoint)

**Output**: `public/data/releases.json`

**Process**:
1. Fetch all releases from `WordPress/gutenberg` repository
2. Parse each release's changelog markdown
3. Extract PR counts by category
4. Extract contributor usernames
5. Map to WordPress versions using `wp-schedule.json`

### aggregate-data.ts

Computes aggregated statistics from parsed releases.

```bash
npm run aggregate
```

**Input**: `public/data/releases.json`

**Output**:
- `public/data/aggregated/summary.json` - Overall statistics
- `public/data/aggregated/by-wp-version.json` - Per-WP-version aggregates
- `public/data/aggregated/time-series.json` - Chart data points

**Computed Metrics**:
- Total PRs, contributors, new contributors per WP cycle
- Average PRs per release
- Category distribution (features, bugs, a11y, performance, etc.)
- Current WP cycle progress

### compute-release-aggregates.ts

Computes privacy-first contributor statistics (sponsor/country breakdowns).

```bash
# Compute for specific WP versions
npm run compute-aggregates:wp

# Compute for all releases (use sparingly)
npm run compute-aggregates
```

**Options**:
| Flag | Description |
|------|-------------|
| `--wp-version 6.9,7.0` | Target specific WP versions |
| `--gb-version 19.0.0` | Target specific GB version |
| `--from-gb 19.0.0` | Start of GB version range |
| `--to-gb 20.0.0` | End of GB version range |
| `--force` | Recompute even if aggregates exist |

**Process**:
1. Load contributor list from release changelog
2. Fetch WP.org profile for each contributor
3. Extract company/sponsor from profile
4. Geocode location to country
5. Aggregate counts (no individual data stored)
6. Write aggregates to release data

**Privacy**: Only aggregate counts are stored. Individual contributor data is fetched on-demand and discarded after aggregation.

### build-username-mapping.ts

Creates mapping between GitHub usernames and display names.

```bash
npm run build-mapping
```

**Input**: GitHub API (contributor profiles)

**Output**: `public/data/username-mapping.json`

## Combined Commands

### Full Refresh

```bash
npm run refresh
```

Runs `parse` + `aggregate` in sequence. Use for routine data updates.

### GitHub Actions

Automated refresh runs **Mondays at 9:00 UTC** via `.github/workflows/refresh-data.yml`.

Workflow options:
| Option | Behavior |
|--------|----------|
| `auto` | Compute aggregates for new releases only |
| `skip` | Skip contributor aggregates (fast) |
| `force-all` | Recompute ALL aggregates |

## Data Files

### releases.json

Array of `Release` objects with:
- Version info (`gbVersion`, `wpVersion`, `date`)
- PR metrics (`totalPRs`, `categories`)
- Contributor counts (`contributors`, `newContributors`)
- Optional `contributorAggregates` (sponsor/country breakdowns)

### wp-schedule.json

WordPress release schedule mapping GB versions to WP versions:

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

**Note**: Currently maintained manually. Auto-update planned.

### category-config.json

Category aggregation definitions:

```json
{
  "aggregations": [
    {
      "id": "features",
      "label": "Features",
      "color": "#4CAF50",
      "rawCategories": ["Enhancements", "New APIs", ...]
    }
  ]
}
```

## Sponsor Normalization

Company names are normalized for consistent aggregation:

| Raw | Normalized |
|-----|------------|
| "Automattic, Inc." | "Automattic" |
| "Lead Engineer @bigbite" | "bigbite" |
| "Freelance", "#opentowork" | "Self-sponsored" |

See `scripts/utils/sponsor-normalization.ts`.
