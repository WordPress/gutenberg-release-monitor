# API Reference

Complete reference for hooks and utilities provided by the application.

## React Hooks

### useDarkMode

Manages dark mode state with system preference detection and localStorage persistence.

**Location**: `src/hooks/useDarkMode.ts`

**Signature**:

```typescript
function useDarkMode(): {
  isDark: boolean;
  theme: 'light' | 'dark' | 'system';
  toggle: () => void;
  setToSystem: () => void;
}
```

**Returns**:

| Property | Type | Description |
|----------|------|-------------|
| `isDark` | boolean | Current dark mode status |
| `theme` | `'light' \| 'dark' \| 'system'` | Current theme preference |
| `toggle` | function | Toggle between light/dark |
| `setToSystem` | function | Reset to system preference |

**Behavior**:

- Initializes from localStorage (key: `theme-preference`)
- Defaults to `'system'` if no stored preference
- `isDark` is true when theme is `'dark'` OR when theme is `'system'` and system prefers dark
- Applies `dark-mode` CSS class to `document.documentElement`
- Listens to system theme changes when in system mode

**Example**:

```typescript
import { useDarkMode } from '@/hooks/useDarkMode';

function ThemeToggle() {
  const { isDark, toggle } = useDarkMode();
  return (
    <button onClick={toggle}>
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
```

---

### useURLState

Syncs component state with URL query parameters.

**Location**: `src/hooks/useURLState.ts`

**Signature**:

```typescript
function useURLState(
  paramName: string,
  defaultValue: string,
  validValues?: string[]
): [string, (value: string) => void]
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `paramName` | string | Query parameter name |
| `defaultValue` | string | Fallback value if URL param is missing or invalid |
| `validValues` | string[] (optional) | Array of allowed values |

**Returns**:

Tuple of `[currentValue, setValue]`

**Behavior**:

- Initializes from URL parameter, falls back to `defaultValue`
- Re-validates state when `validValues` changes (useful when data loads)
- Removes param from URL when value equals `defaultValue` (cleaner URLs)
- Uses `window.history.replaceState()` to update URL without navigation
- Re-initializes when `paramName` changes (e.g., switching tabs)
- Setter only accepts values in `validValues` array (if provided)

**Example**:

```typescript
import { useURLState } from '@/hooks/useURLState';

function VersionSelector({ versions }: { versions: string[] }) {
  const [selected, setSelected] = useURLState(
    'version',           // URL param name
    versions[0] || '',   // Default value
    versions             // Valid values
  );

  return (
    <select value={selected} onChange={(e) => setSelected(e.target.value)}>
      {versions.map((v) => <option key={v}>{v}</option>)}
    </select>
  );
}
```

---

### useTabData

Fetches and caches release data for a specific tab.

**Location**: `src/hooks/useReleases.ts`

**Signature**:

```typescript
function useTabData(tabId: string): UseQueryResult<NormalizedRelease[], Error>
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `tabId` | string | Tab identifier from config |

**Returns**:

React Query result object with:

| Property | Type | Description |
|----------|------|-------------|
| `data` | NormalizedRelease[] | Cached release data |
| `isLoading` | boolean | Fetch in progress |
| `isError` | boolean | Fetch failed |
| `error` | Error | Error details |
| `refetch` | function | Manual refetch |

**Behavior**:

- Uses `tabConfig.dataEndpoint` to determine fetch URL
- Fetches from `data/{dataEndpoint}` (relative path)
- Only enabled if `dataEndpoint` and `tabConfig` are available
- Caches results with query key: `['tabData', tabId]`

**Example**:

```typescript
import { useTabData } from '@/hooks/useReleases';

function ReleaseList({ tabId }: { tabId: string }) {
  const { data, isLoading, error } = useTabData(tabId);

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <ul>
      {data?.map((release) => (
        <li key={release.id}>{release.displayLabel}</li>
      ))}
    </ul>
  );
}
```

---

### useSummary

Fetches and caches summary statistics.

**Location**: `src/hooks/useReleases.ts`

**Signature**:

```typescript
function useSummary(tabId: string): UseQueryResult<SourceSummary, Error>
```

**Returns**:

React Query result object with `SourceSummary` data.

**Behavior**:

- Uses the active tab's `summaryEndpoint` when it has one; otherwise uses `config.dataSources.summary`
- Uses the active tab's `summaryEndpoint` when it has one; otherwise uses `config.dataSources.summary`
- Caches with query key: `['summary', summaryPath]`
- Always enabled (no conditional dependencies)

**Example**:

```typescript
import { useSummary } from '@/hooks/useReleases';

function ComparisonStats({ currentPRs, activeTab }: { currentPRs: number; activeTab: string }) {
  const { data: summary } = useSummary(activeTab);

  if (!summary) return null;

  const diff = currentPRs - summary.avgPRsTotal;
  return (
    <span>
      {diff > 0 ? '+' : ''}{diff.toFixed(1)} vs average
    </span>
  );
}
```

---

## Configuration Hooks

### useConfig

Returns the full project configuration.

**Location**: `src/config/ConfigProvider.tsx`

**Signature**:

```typescript
function useConfig(): ProjectConfig
```

**Throws**: Error if used outside of `ConfigProvider`

**Example**:

```typescript
import { useConfig } from '@/config';

function ProjectHeader() {
  const config = useConfig();
  return <h1>{config.project.name}</h1>;
}
```

---

### useTabConfig

Returns configuration for a specific tab.

**Location**: `src/config/ConfigProvider.tsx`

**Signature**:

```typescript
function useTabConfig(tabId: string): TabConfig
```

**Throws**: Error if tab not found or used outside of `ConfigProvider`

**Example**:

```typescript
import { useTabConfig } from '@/config';

function TabContent({ tabId }: { tabId: string }) {
  const tabConfig = useTabConfig(tabId);
  return <span>{tabConfig.versionPrefix}</span>;
}
```

---

### useTabIds

Returns array of all tab IDs.

**Location**: `src/config/ConfigProvider.tsx`

**Signature**:

```typescript
function useTabIds(): string[]
```

**Example**:

```typescript
import { useTabIds } from '@/config';

function TabNavigation() {
  const tabIds = useTabIds();
  // ['by-wp-version', 'by-gb-release']
}
```

---

### useTabPanelTabs

Returns tabs formatted for `@wordpress/components` TabPanel.

**Location**: `src/config/ConfigProvider.tsx`

**Signature**:

```typescript
function useTabPanelTabs(): Array<{ name: string; title: string }>
```

**Example**:

```typescript
import { TabPanel } from '@wordpress/components';
import { useTabPanelTabs } from '@/config';

function Navigation() {
  const tabs = useTabPanelTabs();
  return (
    <TabPanel tabs={tabs} onSelect={handleSelect}>
      {(tab) => <TabContent tabId={tab.name} />}
    </TabPanel>
  );
}
```

---

## Category Utilities

**Location**: `src/utils/categories.ts`

### loadCategoryConfig

Loads category configuration from JSON file.

```typescript
async function loadCategoryConfig(): Promise<CategoryConfig>
```

Results are cached for performance. Returns cached config on subsequent calls.

---

### sumCategories

Sums PR counts for specific raw category names.

```typescript
function sumCategories(
  categories: Record<string, number>,
  rawCategoryNames: string[]
): number
```

**Example**:

```typescript
const raw = { 'Bug Fixes': 5, 'Enhancements': 3, 'New APIs': 2 };
const bugs = sumCategories(raw, ['Bug Fixes']);
// Returns: 5
```

---

### aggregateCategories

Transforms raw categories into configured groups.

```typescript
function aggregateCategories(
  categories: Record<string, number>,
  config: CategoryConfig
): Record<string, number>
```

**Example**:

```typescript
const raw = { 'Bug Fixes': 5, 'Enhancements': 3, 'New APIs': 2 };
const aggregated = aggregateCategories(raw, config);
// Returns: { bugs: 5, features: 5 }
```

---

### getAggregatedPRs

Gets aggregated PR count for a specific aggregation ID.

```typescript
function getAggregatedPRs(
  categories: Record<string, number>,
  config: CategoryConfig,
  aggregationId: string
): number
```

---

### calculateCategoryPercentages

Calculates percentages for selected categories.

```typescript
function calculateCategoryPercentages(
  aggregated: Record<string, number>,
  selectedIds: string[]
): Record<string, number>
```

Percentages are relative to the total of selected categories (sums to 100%).

**Example**:

```typescript
const aggregated = { bugs: 100, features: 50, perf: 50 };
const percentages = calculateCategoryPercentages(
  aggregated,
  ['bugs', 'features']
);
// Returns: { bugs: 67, features: 33 }
```

---

### getCategoryColor

Gets the hex color for a category by ID.

```typescript
function getCategoryColor(
  config: CategoryConfig,
  categoryId: string
): string
```

Returns `'#9E9E9E'` (gray) if not found.

---

### getDefaultSelectedCategories

Gets category IDs marked as `includeByDefault` in config.

```typescript
function getDefaultSelectedCategories(config: CategoryConfig): string[]
```

---

## Usage Patterns

### Loading and Aggregating Data

```typescript
import { useTabData } from '@/hooks/useReleases';
import { loadCategoryConfig, aggregateCategories } from '@/utils/categories';

function ReleaseStats({ tabId }: { tabId: string }) {
  const { data } = useTabData(tabId);
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  const aggregated = useMemo(() => {
    if (!categoryConfig || !data?.[0]?.rawCategories) return {};
    return aggregateCategories(data[0].rawCategories, categoryConfig);
  }, [data, categoryConfig]);

  // Use aggregated data...
}
```

### URL State with Validation

```typescript
import { useURLState } from '@/hooks/useURLState';
import { useTabData } from '@/hooks/useReleases';

function VersionSelector({ tabId }: { tabId: string }) {
  const { data } = useTabData(tabId);
  const versions = data?.map((r) => r.version) ?? [];

  const [selected, setSelected] = useURLState(
    'v',
    versions[0] || '',
    versions  // Re-validates when data loads
  );

  return (
    <select value={selected} onChange={(e) => setSelected(e.target.value)}>
      {versions.map((v) => <option key={v}>{v}</option>)}
    </select>
  );
}
```

### Building Chart Legend

```typescript
import { loadCategoryConfig, getCategoryColor, getDefaultSelectedCategories } from '@/utils/categories';

function ChartLegend() {
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  if (!categoryConfig) return null;

  const defaultCategories = getDefaultSelectedCategories(categoryConfig);

  return (
    <div>
      {defaultCategories.map((id) => {
        const agg = categoryConfig.aggregations.find((a) => a.id === id);
        if (!agg) return null;
        return (
          <span key={id} style={{ color: getCategoryColor(categoryConfig, id) }}>
            {agg.labels.full}
          </span>
        );
      })}
    </div>
  );
}
```
