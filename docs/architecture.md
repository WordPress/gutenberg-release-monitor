# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Sources                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  GitHub API  │  │  WP.org API  │  │  wp-schedule.json    │  │
│  │  (releases)  │  │  (profiles)  │  │  (manual)            │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Scripts (Node.js)                            │
│  ┌──────────────────┐  ┌────────────────────────────────────┐  │
│  │ parse-changelog  │  │ compute-release-aggregates         │  │
│  │ aggregate-data   │  │ build-username-mapping             │  │
│  └────────┬─────────┘  └──────────────┬─────────────────────┘  │
└───────────┼────────────────────────────┼────────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JSON Data Files                               │
│  ┌──────────────┐  ┌──────────────────────────────────────┐    │
│  │ releases.json│  │ aggregated/                          │    │
│  │              │  │   ├── summary.json                   │    │
│  │              │  │   ├── by-wp-version.json             │    │
│  │              │  │   └── time-series.json               │    │
│  └──────────────┘  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     React Application                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      App.tsx                              │  │
│  │  (tabs, view modes, chart types, category filtering)     │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│              ┌────────────┼────────────┐                       │
│              ▼            ▼            ▼                       │
│  ┌───────────────┐ ┌───────────┐ ┌────────────┐               │
│  │ SummaryStats  │ │ TrendChart│ │ DataTable  │               │
│  └───────────────┘ └───────────┘ └────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App.tsx
├── Header (tabs, theme toggle)
├── SummaryStats (key metrics, category legend)
├── TrendChart (Recharts visualization)
└── DataTable (@wordpress/dataviews)
```

### Data Fetching (React Query)

Custom hooks fetch and cache JSON data:

| Hook | Data Source | Purpose |
|------|-------------|---------|
| `useReleases()` | releases.json | All parsed GB releases |
| `useSummary()` | aggregated/summary.json | Overall statistics |
| `useWPVersionStats()` | aggregated/by-wp-version.json | Per-WP-version aggregates |
| `useTimeSeries()` | aggregated/time-series.json | Chart data points |

### State Management

| State | Location | Sync |
|-------|----------|------|
| Active tab | `useURLState` | URL param `tab` |
| View mode | `useURLState` | URL param `viewMode` |
| Chart type | `useURLState` | URL param `chartType` |
| Visible categories | `useURLState` | URL param `categories` |
| Dark mode | `useDarkMode` | localStorage |

## Key Design Patterns

### 1. Dual Data Source Pattern

Single components handle both WP version and GB release views:

```typescript
type DataTableProps =
  | { dataSource: 'wp-version'; data: WPVersionStats[] }
  | { dataSource: 'gb-release'; data: Release[] };
```

Benefits:
- Prevents component remounting on tab switch
- Preserves animations and scroll position
- Type-safe data handling via discriminated unions

### 2. Privacy-First Contributor Data

No individual contributor data is stored permanently:

```
Workflow:
1. Fetch contributor list from changelog
2. Look up WP.org/GitHub profiles on-the-fly
3. Compute aggregate counts (sponsor, country)
4. Store only aggregates, discard individual data
```

### 3. URL State Synchronization

All user preferences sync to URL for shareable states:

```typescript
const [tab, setTab] = useURLState('tab', 'wp-version', ['wp-version', 'gb-release']);
```

- Clean URLs when value equals default
- Type-safe allowed values
- Browser history integration

### 4. Category Aggregation

Raw changelog categories map to display aggregations:

```
Raw: "Bug Fixes", "Bug Fixes for the Block Editor"
  → Aggregated: "bugs" (summed count)

Raw: "Accessibility", "Global Styles Accessibility"
  → Aggregated: "accessibility" (summed count)
```

Configuration in `public/data/category-config.json`.

## Directory Structure

```
src/
├── App.tsx              # Main orchestrator
├── main.tsx             # React entry point
├── components/
│   ├── SummaryStats.tsx # Key metrics display
│   ├── TrendChart.tsx   # Chart visualization
│   ├── DataTable.tsx    # Tabular data view
│   └── CategoryFilter.tsx
├── hooks/
│   ├── useReleases.ts   # Release data fetching
│   ├── useSummary.ts    # Summary stats fetching
│   ├── useWPVersionStats.ts
│   ├── useTimeSeries.ts
│   ├── useDarkMode.ts   # Theme management
│   └── useURLState.ts   # URL param sync
├── data/
│   └── types.ts         # TypeScript interfaces
└── utils/
    └── categories.ts    # Category helpers

scripts/
├── parse-changelog.ts   # GitHub → releases.json
├── aggregate-data.ts    # releases → aggregated/
├── compute-release-aggregates.ts  # Contributor stats
├── build-username-mapping.ts
└── utils/
    ├── github-api.ts
    ├── wporg-api.ts
    ├── changelog-parser.ts
    ├── contributor-data.ts
    ├── sponsor-normalization.ts
    ├── geocoding.ts
    ├── category-utils.ts
    └── file-utils.ts

public/data/
├── releases.json        # Parsed release data
├── wp-schedule.json     # WP release dates
├── category-config.json # Category definitions
├── username-mapping.json
└── aggregated/
    ├── summary.json
    ├── by-wp-version.json
    └── time-series.json
```
