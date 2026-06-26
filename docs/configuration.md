# Configuration Guide

This guide explains how to customize the dashboard through configuration files, and how to adapt it for tracking releases from other projects.

## Configuration Files Overview

| File | Purpose |
|------|---------|
| `public/config/project.json` | Main project configuration (tabs, labels, defaults) |
| `public/config/categories.json` | Category aggregations (colors, raw mappings) |
| `scripts/data/wp-schedule.json` | Release schedule (version mappings) |

## Project Configuration

**Location**: `public/config/project.json`

This file defines the overall dashboard structure, tabs, data sources, and default settings.

### Full Schema

```typescript
interface ProjectConfig {
  version: string;           // Config schema version
  project: ProjectInfo;      // Metadata and branding
  tabs: TabConfig[];         // Tab definitions
  dataSources: DataSources;  // Data file paths
  defaults: Defaults;        // UI defaults
}
```

### Project Info

```json
{
  "project": {
    "name": "Gutenberg Release Monitor",
    "description": "Track Gutenberg release statistics and changelog data.",
    "projectUrl": "https://github.com/WordPress/gutenberg",
    "projectLabel": "Gutenberg",
    "disclaimer": "This data is an approximation...",
    "learnMoreUrl": "https://developer.wordpress.org/..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Dashboard title |
| `description` | string | Short description for metadata |
| `projectUrl` | string | Link to source project |
| `projectLabel` | string | Text for "View on GitHub"-style links |
| `disclaimer` | string | Disclaimer text below header |
| `learnMoreUrl` | string | Link for "Learn more" |

### Tab Configuration

Each tab represents a different view of the data:

```json
{
  "tabs": [
    {
      "id": "by-wp-version",
      "title": "By WP Version",
      "dataEndpoint": "wp-cycles.json",
      "isAggregated": true,
      "versionPrefix": "WordPress",
      "supportedViewModes": ["averages", "totals", "distribution", "sponsors", "countries"],
      "tableCardClass": "aggregated-table-card",
      "urlParamKey": "wp",
      "defaultItemSummaryField": "currentPeriod",
      "showReferenceLines": false,
      "labels": { ... }
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, used in URL |
| `title` | string | Tab button text |
| `dataEndpoint` | string | JSON file in `public/data/` |
| `summaryEndpoint` | string (optional) | Summary JSON file in `public/data/`. If omitted, the app uses `dataSources.summary`. |
| `isAggregated` | boolean | True for grouped data (e.g., WP versions containing multiple GB releases) |
| `versionPrefix` | string | Prefix for version display ("WordPress 6.9") |
| `supportedViewModes` | string[] | Available modes: `averages`, `totals`, `distribution`, `sponsors`, `countries` |
| `tableCardClass` | string \| null | CSS class for table styling |
| `urlParamKey` | string | URL parameter for version selection |
| `defaultItemSummaryField` | string \| null | Summary field to select default item |
| `showReferenceLines` | boolean | Show special markers on charts |
| `labels` | TabLabels | UI text customization |

### Tab Labels

Customize all UI text for a tab:

```json
{
  "labels": {
    "averagesToggle": "Per Release",
    "statsHeader": "Averages per Gutenberg release",
    "childItem": "Gutenberg release",
    "versionColumn": "Version",
    "childVersionColumn": "GB Releases",
    "parentVersionColumn": null,
    "parentVersionPrefix": null,
    "itemContext": null,
    "specialMarkerTooltip": null,
    "chartSecondaryLabel": "Gutenberg releases included"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `averagesToggle` | string \| null | Label for averages/totals toggle |
| `statsHeader` | string \| null | Header for stats section |
| `childItem` | string \| null | Label for child items (singular) |
| `versionColumn` | string \| null | Primary version column header |
| `childVersionColumn` | string \| null | Child versions column header |
| `parentVersionColumn` | string \| null | Parent version column header |
| `parentVersionPrefix` | string \| null | Prefix for parent version values |
| `itemContext` | string \| null | Template with `{version}` placeholder |
| `specialMarkerTooltip` | string \| null | Tooltip for special markers |
| `chartSecondaryLabel` | string \| null | Secondary chart series label |

### Data Sources

```json
{
  "dataSources": {
    "summary": "summary.json"
  }
}
```

Set `summaryEndpoint` on a tab when that tab needs its own comparison summary.

### Defaults

```json
{
  "defaults": {
    "tab": "by-wp-version",
    "viewMode": "averages",
    "chartType": "stacked",
    "metric": "prs",
    "releaseCount": 50
  }
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `tab` | Tab ID | Default active tab |
| `viewMode` | `averages`, `totals`, `distribution`, `sponsors`, `countries` | Default view |
| `chartType` | `line`, `bar`, `area`, `stacked` | Default chart |
| `metric` | `prs`, `contributors` | Default metric |
| `releaseCount` | number | Default releases shown |

## Category Configuration

**Location**: `public/config/categories.json`

Categories map raw changelog section names to display groups with consistent styling.

### Schema

```typescript
interface CategoryConfig {
  version: string;
  aggregations: CategoryAggregation[];
}

interface CategoryAggregation {
  id: string;                  // Unique identifier
  labels: {
    full: string;              // Full display name
    short: string;             // Abbreviated name
  };
  color: string;               // Hex color for charts
  rawCategories: string[];     // Changelog section names to match
  includeByDefault: boolean;   // Show in UI by default
}
```

### Example

```json
{
  "aggregations": [
    {
      "id": "features",
      "labels": { "full": "Features", "short": "Features" },
      "color": "#4CAF50",
      "rawCategories": [
        "Enhancements",
        "Enhancement",
        "Features",
        "New Features",
        "New APIs"
      ],
      "includeByDefault": true
    },
    {
      "id": "bugs",
      "labels": { "full": "Bug Fixes", "short": "Bugs" },
      "color": "#F44336",
      "rawCategories": [
        "Bug Fixes",
        "Bugfixes",
        "Bugs",
        "Fixes"
      ],
      "includeByDefault": true
    }
  ]
}
```

### Current Categories

| ID | Color | Included by Default |
|----|-------|---------------------|
| `features` | Green (#4CAF50) | Yes |
| `bugs` | Red (#F44336) | Yes |
| `codeQuality` | Blue (#2196F3) | Yes |
| `a11y` | Purple (#9C27B0) | Yes |
| `performance` | Orange (#FF9800) | Yes |
| `documentation` | Brown (#795548) | No |
| `other` | Gray (#9E9E9E) | No |

### Adding a Category

1. Add a new aggregation to `categories.json`:

```json
{
  "id": "testing",
  "labels": { "full": "Testing", "short": "Test" },
  "color": "#00BCD4",
  "rawCategories": ["Testing", "Tests", "QA"],
  "includeByDefault": true
}
```

1. Ensure your changelog parser creates entries with matching raw category names

## Release Schedule

**Location**: `scripts/data/wp-schedule.json`

Maps Gutenberg version ranges to WordPress versions:

```json
{
  "releases": [
    {
      "wpVersion": "6.9",
      "beta1Date": "2025-03-04",
      "stableDate": "2025-04-15",
      "lastGBVersion": "20.8.0"
    },
    {
      "wpVersion": "6.8",
      "beta1Date": "2024-11-18",
      "stableDate": "2025-01-14",
      "lastGBVersion": "19.9.0"
    }
  ]
}
```

This file is maintained manually and used by `build-gb-releases.ts` to assign WordPress versions to Gutenberg releases.

## Adapting for Another Project

### Step 1: Fork and Clone

```bash
git clone https://github.com/your-username/gutenberg-release-monitor.git
cd gutenberg-release-monitor
npm install
```

### Step 2: Update Project Info

Edit `public/config/project.json`:

```json
{
  "project": {
    "name": "My Project Release Monitor",
    "description": "Track My Project release statistics.",
    "projectUrl": "https://github.com/org/my-project",
    "projectLabel": "My Project",
    "disclaimer": "Data parsed from release changelogs.",
    "learnMoreUrl": "https://my-project.org/releases"
  }
}
```

### Step 3: Configure Tabs

Define your data views in the `tabs` array. For a simple single-view dashboard:

```json
{
  "tabs": [
    {
      "id": "releases",
      "title": "Releases",
      "dataEndpoint": "releases.json",
      "isAggregated": false,
      "versionPrefix": "v",
      "supportedViewModes": ["averages", "distribution"],
      "tableCardClass": null,
      "urlParamKey": "v",
      "defaultItemSummaryField": null,
      "showReferenceLines": false,
      "labels": {
        "averagesToggle": null,
        "statsHeader": null,
        "childItem": null,
        "versionColumn": "Version",
        "childVersionColumn": null,
        "parentVersionColumn": null,
        "parentVersionPrefix": null,
        "itemContext": null,
        "specialMarkerTooltip": null,
        "chartSecondaryLabel": null
      }
    }
  ],
  "defaults": {
    "tab": "releases",
    "viewMode": "averages",
    "chartType": "bar",
    "metric": "prs",
    "releaseCount": 20
  }
}
```

### Step 4: Update Categories

Edit `public/config/categories.json` to match your changelog format:

```json
{
  "aggregations": [
    {
      "id": "features",
      "labels": { "full": "Features", "short": "Feat" },
      "color": "#4CAF50",
      "rawCategories": ["Added", "New", "Features"],
      "includeByDefault": true
    },
    {
      "id": "fixes",
      "labels": { "full": "Fixes", "short": "Fix" },
      "color": "#F44336",
      "rawCategories": ["Fixed", "Bug Fixes"],
      "includeByDefault": true
    },
    {
      "id": "changes",
      "labels": { "full": "Changes", "short": "Change" },
      "color": "#2196F3",
      "rawCategories": ["Changed", "Updated"],
      "includeByDefault": true
    }
  ],
  "version": "1.0.0"
}
```

### Step 5: Modify the Changelog Parser

The changelog parser in `scripts/utils/changelog-parser.ts` parses GitHub release markdown. You may need to modify it for your project's changelog format.

Key functions to review:

- `parseChangelog()` - Main parsing entry point
- `extractCategories()` - Extracts PR counts by category
- `extractContributors()` - Extracts contributor usernames

### Step 6: Create Initial Data

Run the data pipeline to generate your JSON files:

```bash
# Parse releases from GitHub
npm run data-sync:gb-releases

# Generate aggregates
npm run data-sync:wp-cycles
```

### Step 7: Test Locally

```bash
npm run dev
```

## Configuration Provider API

The configuration is accessed via React Context hooks:

### useConfig()

Returns the full `ProjectConfig` object:

```typescript
import { useConfig } from '@/config';

function MyComponent() {
  const config = useConfig();
  return <h1>{config.project.name}</h1>;
}
```

### useTabConfig(tabId)

Returns configuration for a specific tab:

```typescript
import { useTabConfig } from '@/config';

function TabContent({ tabId }: { tabId: string }) {
  const tabConfig = useTabConfig(tabId);
  return <span>{tabConfig.versionPrefix}</span>;
}
```

### useTabIds()

Returns array of all tab IDs:

```typescript
import { useTabIds } from '@/config';

function TabList() {
  const tabIds = useTabIds();
  // ['by-wp-version', 'by-gb-release']
}
```

### useTabPanelTabs()

Returns tabs formatted for `@wordpress/components` TabPanel:

```typescript
import { useTabPanelTabs } from '@/config';

function Navigation() {
  const tabs = useTabPanelTabs();
  // [{ name: 'by-wp-version', title: 'By WP Version' }, ...]
}
```

## Validation

The configuration provider validates config at load time:

- Ensures `version` field exists
- Validates `tabs` is a non-empty array
- Checks `dataSources.summary` is defined
- Validates `defaults` contains required fields

Invalid configuration will throw an error at app startup.
