# Architecture

This document describes the system design and key patterns of the Gutenberg Release Monitor.

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Sources                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  GitHub API  │  │  WP.org API  │  │  scripts/data/             │ │
│  │  (releases)  │  │  (profiles)  │  │  wp-schedule.json (manual) │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────────┘ │
└─────────┼─────────────────┼─────────────────────┼───────────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Scripts (Node.js + TypeScript)                  │
│  ┌─────────────────────┐  ┌─────────────────────────────────────┐   │
│  │ build-gb-releases   │  │ compute-contributor-stats           │   │
│  │ build-wp-cycles     │  │ build-username-mapping              │   │
│  └──────────┬──────────┘  └──────────────┬──────────────────────┘   │
└─────────────┼────────────────────────────┼──────────────────────────┘
              │                            │
              ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       public/data/ (JSON files)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ gb-releases.json│  │ wp-cycles.json │  │ summary.json   │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      React Application                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      ConfigProvider                             │ │
│  │  (loads public/config/project.json + categories.json)          │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           ▼                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                         App.tsx                                 │ │
│  │  (tabs, URL state, view modes, chart types, category filter)   │ │
│  └───────────────────────────┬────────────────────────────────────┘ │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────┐             │
│  │ SummaryStats  │  │  TrendChart    │  │  DataTable │             │
│  └───────────────┘  └────────────────┘  └────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## Design Philosophy

### Configuration-Driven Architecture

The application separates concerns through external configuration:

| Concern | Configuration File | Purpose |
|---------|-------------------|---------|
| UI Structure | `public/config/project.json` | Tabs, labels, defaults, data sources |
| Data Categories | `public/config/categories.json` | Category aggregations, colors, visibility |
| Release Schedule | `scripts/data/wp-schedule.json` | WordPress version → Gutenberg version mapping |

This allows significant customization without modifying React components.

### Privacy-First Data Handling

Contributor data follows a privacy-preserving pattern:

```text
1. Fetch contributor usernames from changelog
2. Look up profiles from WP.org/GitHub APIs
3. Extract sponsor/company and location
4. Aggregate into counts (e.g., "Automattic: 15")
5. Store ONLY aggregates, discard individual data
```

No individual contributor information is persisted.

### URL State Synchronization

All user preferences sync to URL parameters for shareable states:

```typescript
const [tab, setTab] = useURLState('tab', 'by-wp-version');
const [viewMode, setViewMode] = useURLState('view', 'averages');
```

- Default values are omitted from URL (cleaner links)
- Browser history integration works naturally
- Links can be shared with preserved state

## Frontend Architecture

### Component Hierarchy

```text
App.tsx
├── Header
│   ├── Title (link to reset URL)
│   └── Theme Toggle (useDarkMode)
├── TabPanel (@wordpress/components)
│   └── Tab Content
│       ├── SummaryStats
│       │   └── CategoryPieChart
│       ├── View Controls (mode, chart type, metric)
│       ├── TrendChart (Recharts)
│       └── DataTable (@wordpress/dataviews)
├── CategoryFilter (visibility toggles)
└── Footer (metadata)
```

### Data Fetching (React Query)

Custom hooks fetch and cache JSON data:

| Hook | Data Source | Purpose |
|------|-------------|---------|
| `useTabData(tabId)` | `{tab.dataEndpoint}` | Tab-specific release data |
| `useSummary(tabId)` | `{tab.summaryEndpoint ?? dataSources.summary}` | Summary stats for the selected tab |

### State Management

| State | Hook | Persistence |
|-------|------|-------------|
| Active tab | `useURLState('tab')` | URL parameter |
| View mode | `useURLState('view')` | URL parameter |
| Chart type | `useURLState('chart')` | URL parameter |
| Metric (PRs/contributors) | `useURLState('metric')` | URL parameter |
| Selected version | `useURLState(tabConfig.urlParamKey)` | URL parameter |
| Visible categories | `useURLState('categories')` | URL parameter |
| Release count | `useURLState('releases')` | URL parameter |
| Dark mode | `useDarkMode()` | localStorage |

## Configuration System

### ConfigProvider Pattern

Configuration is loaded once at app startup and distributed via React Context:

```typescript
// Load configuration
const { data: config } = useQuery({
  queryKey: ['config'],
  queryFn: () => fetch('config/project.json').then(r => r.json()),
  staleTime: Infinity,
});

// Provide to app
<ConfigContext.Provider value={config}>
  <App />
</ConfigContext.Provider>

// Consume in components
const config = useConfig();
const tabConfig = useTabConfig('by-wp-version');
```

### Tab Configuration Structure

Each tab defines its data source, supported features, and UI labels:

```typescript
interface TabConfig {
  id: string;                    // URL identifier
  title: string;                 // Display title
  dataEndpoint: string;          // JSON file path
  summaryEndpoint?: string;      // Optional summary JSON path
  isAggregated: boolean;         // Multiple releases per item?
  versionPrefix: string;         // "WordPress" or "Gutenberg"
  supportedViewModes: string[];  // Available view modes
  urlParamKey: string;           // Version URL param name
  showReferenceLines: boolean;   // Show special markers on chart
  labels: TabLabels;             // UI text customization
}
```

### Category Aggregation System

Raw changelog categories are mapped to display groups:

```text
Raw categories (from changelog):
  "Bug Fixes", "Bug Fixes for Block Editor", "Bugfixes"
        ↓
Aggregation config (categories.json):
  { id: "bugs", rawCategories: ["Bug Fixes", ...], color: "#F44336" }
        ↓
Display: "Bug Fixes" with consistent color
```

## Key Design Patterns

### 1. Dual Data Source Pattern

Components handle both aggregated (WP version) and non-aggregated (GB release) views through the same interface:

```typescript
// Data structure is normalized - same fields work for both
interface NormalizedRelease {
  version: string;           // "6.9" or "20.5.0"
  isAggregated: boolean;     // true for WP versions
  totalPRs: number;
  contributors: number;
  // ... same fields for both types
}
```

Benefits:

- Single component handles multiple data types
- No remounting when switching tabs
- Preserves animations and scroll position

### 2. Category Configuration Pattern

Categories are fully externalized:

```typescript
// categories.json
{
  "aggregations": [
    {
      "id": "features",
      "labels": { "full": "Features", "short": "Feat" },
      "color": "#4CAF50",
      "rawCategories": ["Enhancements", "New APIs", "New Features"],
      "includeByDefault": true
    }
  ]
}
```

This allows:

- Adding/removing categories without code changes
- Customizing colors and labels
- Mapping multiple raw categories to one display group

### 3. URL State Pattern

The `useURLState` hook provides bidirectional sync:

```typescript
function useURLState(
  param: string,
  defaultValue: string,
  validValues?: string[]
): [string, (value: string) => void]
```

Features:

- Validates against allowed values
- Removes param when value equals default
- Re-validates when validValues changes (e.g., after data loads)

## Directory Structure

```text
src/
├── App.tsx                  # Main orchestrator
├── main.tsx                 # React entry point
├── index.css                # Global styles
├── config/
│   ├── types.ts             # Configuration TypeScript interfaces
│   ├── index.ts             # Exports
│   └── ConfigProvider.tsx   # Context provider + hooks
├── components/
│   ├── SummaryStats.tsx     # Key metrics + category legend
│   ├── TrendChart.tsx       # Recharts visualization
│   ├── DataTable.tsx        # @wordpress/dataviews table
│   ├── CategoryPieChart.tsx # Distribution chart
│   ├── CategoryFilter.tsx   # Visibility toggles
│   └── ErrorBoundary.tsx    # Error handling
├── hooks/
│   ├── useReleases.ts       # useTabData, useSummary
│   ├── useDarkMode.ts       # Theme management
│   └── useURLState.ts       # URL parameter sync
├── data/
│   └── normalized.ts        # NormalizedRelease, SourceSummary types
└── utils/
    └── categories.ts        # Category helper functions

scripts/
├── build-gb-releases.ts     # Parse GitHub releases
├── build-wp-cycles.ts       # Compute WP version aggregates
├── compute-contributor-stats.ts  # Sponsor/country aggregates
├── build-username-mapping.ts     # GitHub → WP.org mapping
├── types.ts                 # Script type definitions
├── data/
│   └── wp-schedule.json     # WP release schedule
└── utils/
    ├── changelog-parser.ts  # Parse changelog markdown
    ├── github-api.ts        # GitHub API client
    ├── wporg-api.ts         # WP.org API client
    ├── contributor-data.ts  # Profile fetching
    ├── sponsor-normalization.ts  # Company name normalization
    ├── geocoding.ts         # Location → country mapping
    ├── category-utils.ts    # Category aggregation
    ├── release-utils.ts     # Release data utilities
    ├── file-utils.ts        # JSON I/O
    └── config-utils.ts      # Config helpers

public/
├── config/
│   ├── project.json         # Main project configuration
│   └── categories.json      # Category definitions
└── data/
    ├── gb-releases.json     # Individual Gutenberg releases
    ├── wp-cycles.json       # WP version aggregates
    ├── summary.json         # Default summary stats
    └── scf/scf-summary.json # SCF summary stats
```

## Extending the System

### Adding a New Tab

1. Add tab configuration to `public/config/project.json`:

```json
{
  "tabs": [
    {
      "id": "my-new-tab",
      "title": "My Tab",
      "dataEndpoint": "my-data.json",
      "isAggregated": false,
      "supportedViewModes": ["averages", "distribution"],
      "urlParamKey": "v",
      "labels": { ... }
    }
  ]
}
```

1. Create data file at `public/data/my-data.json` matching `NormalizedRelease[]` schema

### Adding a New View Mode

1. Add to `supportedViewModes` in tab configuration
2. Handle new mode in `SummaryStats.tsx` and `TrendChart.tsx`
3. Add any new data fields to `NormalizedRelease` type

### Adding a New Category

1. Add to `public/config/categories.json`:

```json
{
  "id": "my-category",
  "labels": { "full": "My Category", "short": "My" },
  "color": "#FF5722",
  "rawCategories": ["Raw Category Name"],
  "includeByDefault": true
}
```

1. Ensure changelog parser maps the raw category name correctly

### Customizing for Another Project

See [Configuration Guide](configuration.md) for step-by-step instructions on adapting this dashboard for a different project.
