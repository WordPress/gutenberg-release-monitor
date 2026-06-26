import { useState, useMemo, useEffect, useRef } from 'react';
import { DataViews } from '@wordpress/dataviews';
import { ExternalLink, Tooltip } from '@wordpress/components';
import type { NormalizedRelease } from '../data/normalized';
import type { ViewMode, MetricType, TabConfig } from '../config/types';
import {
  loadCategoryConfig,
  getAggregatedPRs,
  type CategoryConfig,
} from '../utils/categories';

import '@wordpress/dataviews/build-style/style.css';

interface DataTableProps {
  /** Normalized release data */
  data: NormalizedRelease[];
  viewMode: ViewMode;
  metric: MetricType;
  tabConfig?: TabConfig;
}

// Row type for DataViews component - derived from NormalizedRelease
interface TableRow {
  id: string;
  version: string;
  displayLabel: string;
  totalPRs: number;
  contributors: number;
  newContributors: number;
  // Pre-computed averages (for averages view)
  avgPRs: number;
  avgContributors: number;
  avgNewContributors: number;
  // Aggregated view fields (items that group other items)
  groupedRange?: string;
  groupedCount?: number;
  // Individual item fields (items that belong to a group)
  date?: string;
  changelogUrl?: string;
  isSpecialMarker?: boolean;
  memberOf?: string;
  // Unified category data (aggregated counts)
  categoryTotals: Record<string, number>;
  aiPRs: number;
  aiShare: number;
  aiNonAgent: number;
  aiAgent: number;
  aiAgentShare: number;
  aiNotDetected: number;
  aiTools: string;
  aiToolCounts: Record<string, number>;
  // For conditional rendering
  isAggregated: boolean;
}

interface View {
  type: 'table';
  perPage: number;
  page: number;
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  search: string;
  filters: Array<{
    field: string;
    operator: string;
    value: string | number;
  }>;
  fields: string[];
  layout: Record<string, unknown>;
}

interface SortableField {
  id: string;
  getValue?: ({ item }: { item: TableRow }) => number | string | undefined;
}

const defaultLayouts = {
  table: {},
};

const CONTRIBUTOR_FIELDS = ['contributors', 'newContributors'];
const AI_USAGE_FIELDS = ['aiPRs', 'aiShare', 'aiNotDetected', 'aiNonAgent', 'aiAgent'];
const AI_TOOLS_FIELDS = ['aiPRs', 'aiShare', 'aiTools'];
const AI_AGENTS_FIELDS = ['aiAgent', 'aiAgentShare', 'aiPRs', 'aiNonAgent'];

function formatCompactNumber(value: number): string {
  if (value === 0) return '0';
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function DataTable(props: DataTableProps) {
  const { data, viewMode, metric, tabConfig } = props;

  // Use tabConfig for display logic (no domain knowledge)
  const isAggregated = tabConfig?.isAggregated ?? false;
  const isContributorMetric = metric === 'contributors';
  const isAIMetric = metric === 'ai';

  // Track context changes to reset fields only when necessary
  const contextKey = `${tabConfig?.id ?? 'default'}-${metric}${isAIMetric ? `-${viewMode}` : ''}`;
  const prevContextKey = useRef<string | null>(null);

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Get default visible categories
  const defaultVisibleCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
  }, [categoryConfig]);

  // Transform NormalizedRelease[] into TableRow[] for DataViews
  const tableData: TableRow[] = useMemo(() => {
    if (!categoryConfig) return [];

    return data.map((item) => {
      // Build category totals - aggregate from raw if individual, use pre-computed if aggregated
      const categoryTotals: Record<string, number> = {};
      categoryConfig.aggregations.forEach((agg) => {
        if (item.categoryTotals) {
          // Pre-aggregated (aggregated items)
          categoryTotals[agg.id] = item.categoryTotals[agg.id] || 0;
        } else if (item.rawCategories) {
          // Aggregate from raw categories (individual items)
          categoryTotals[agg.id] = getAggregatedPRs(item.rawCategories, categoryConfig, agg.id);
        } else {
          categoryTotals[agg.id] = 0;
        }
      });

      const aiPRs = item.aiPRs ?? 0;
      const aiAgent = item.aiBreakdown?.agent ?? 0;
      const aiToolCounts = item.aiBreakdown?.byTool ?? {};
      const aiTools = Object.entries(aiToolCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([tool]) => tool)
        .join(', ');

      return {
        id: item.id,
        version: item.version,
        displayLabel: item.displayLabel,
        totalPRs: item.totalPRs,
        contributors: item.contributors,
        newContributors: item.newContributors,
        avgPRs: item.avgPRs,
        avgContributors: item.avgContributors,
        avgNewContributors: item.avgNewContributors,
        groupedRange: item.groupedRange,
        groupedCount: item.groupedCount,
        date: item.date,
        changelogUrl: item.changelogUrl,
        isSpecialMarker: item.isSpecialMarker,
        memberOf: item.memberOf,
        categoryTotals,
        aiPRs,
        aiShare: item.totalPRs > 0 ? (aiPRs / item.totalPRs) * 100 : 0,
        aiNonAgent: item.aiBreakdown?.nonAgent ?? 0,
        aiAgent,
        aiAgentShare: aiPRs > 0 ? (aiAgent / aiPRs) * 100 : 0,
        aiNotDetected: Math.max(0, item.totalPRs - aiPRs),
        aiTools,
        aiToolCounts,
        isAggregated: item.isAggregated,
      };
    });
  }, [data, categoryConfig]);

  // Get parent version prefix from config for filter labels
  const parentVersionPrefixForFilter = tabConfig?.labels?.parentVersionPrefix ?? '';

  // Derive group options from individual items (for filtering by membership)
  const memberOfOptions = useMemo(() => {
    if (isAggregated) return [];
    const versions = new Set<string>();
    tableData.forEach((row) => {
      if (row.memberOf) versions.add(row.memberOf);
    });
    return Array.from(versions)
      .sort((a, b) => {
        const [aMajor, aMinor] = a.split('.').map(Number);
        const [bMajor, bMinor] = b.split('.').map(Number);
        if (bMajor !== aMajor) return bMajor - aMajor;
        return bMinor - aMinor;
      })
      .map((v) => ({
        value: v,
        label: `${parentVersionPrefixForFilter} ${v}`.trim(),
      }));
  }, [isAggregated, tableData, parentVersionPrefixForFilter]);

  // Compute visible field IDs based on data source, view mode, and metric
  const visibleFieldIds = useMemo(() => {
    const categoryFieldIds = defaultVisibleCategories.map((agg) => `cat_${agg.id}`);

    // Base fields that always appear (aggregated vs individual)
    const baseFields = isAggregated
      ? ['version', 'groupedRange', 'groupedCount']
      : ['version', 'memberOf', 'date'];

    // Metric-specific fields
    if (isAIMetric) {
      return [
        ...baseFields,
        'totalPRs',
        ...(viewMode === 'ai-tools'
          ? AI_TOOLS_FIELDS
          : viewMode === 'ai-agents'
            ? AI_AGENTS_FIELDS
            : AI_USAGE_FIELDS),
      ];
    }

    if (isContributorMetric) {
      // Contributor metric: show contributor fields only
      return [...baseFields, ...CONTRIBUTOR_FIELDS];
    }

    // PR metric: show totalPRs and category breakdown
    return [...baseFields, 'totalPRs', ...categoryFieldIds];
  }, [isAggregated, defaultVisibleCategories, isContributorMetric, isAIMetric, viewMode]);

  const defaultSortField = 'version';

  const [view, setView] = useState<View>({
    type: 'table',
    perPage: 25,
    page: 1,
    sort: {
      field: defaultSortField,
      direction: 'desc',
    },
    search: '',
    filters: [],
    fields: [],
    layout: {},
  });

  // Initialize or reset fields when context changes (data source or metric)
  useEffect(() => {
    const contextChanged = prevContextKey.current !== contextKey;

    if (contextChanged) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset on prop change
      setView((prev) => ({ ...prev, fields: visibleFieldIds }));
      prevContextKey.current = contextKey;
    }
  }, [contextKey, visibleFieldIds]);

  // Use view directly - fields are managed by the effect above
  // This preserves user column selections until context changes
  const effectiveView = view;

  // Build fields for DataViews (all work with TableRow)
  const fields = useMemo(() => {
    if (!categoryConfig) return [];

    // Get labels from config (no domain-specific inference)
    const versionColumnLabel = tabConfig?.labels?.versionColumn ?? 'Version';
    const childVersionColumnLabel = tabConfig?.labels?.childVersionColumn ?? 'Versions';
    const parentVersionColumnLabel = tabConfig?.labels?.parentVersionColumn ?? 'Version';
    const parentVersionPrefixValue = tabConfig?.labels?.parentVersionPrefix ?? '';

    const baseFields = [];

    // Version field (primary identifier)
    if (isAggregated) {
      baseFields.push({
        id: 'version',
        label: versionColumnLabel,
        enableHiding: false,
        enableGlobalSearch: true,
        render: ({ item }: { item: TableRow }) => (
          <span className="aggregated-cell">{item.displayLabel}</span>
        ),
      });
      baseFields.push({
        id: 'groupedRange',
        label: childVersionColumnLabel,
        enableSorting: false,
        render: ({ item }: { item: TableRow }) => (
          <span className="grouped-range">{item.groupedRange}</span>
        ),
      });
      baseFields.push({
        id: 'groupedCount',
        label: 'Releases',
        enableSorting: true,
      });
    } else {
      baseFields.push({
        id: 'version',
        label: versionColumnLabel,
        enableHiding: false,
        enableGlobalSearch: true,
        render: ({ item }: { item: TableRow }) => (
          <>
            <ExternalLink
              href={item.changelogUrl || '#'}
              className="release-version-link"
            >
              {item.displayLabel}
            </ExternalLink>
            {item.isSpecialMarker && tabConfig?.labels?.specialMarkerTooltip && (
              <Tooltip text={tabConfig.labels.specialMarkerTooltip}>
                <span className="release-badge-cutoff">Beta Cutoff</span>
              </Tooltip>
            )}
          </>
        ),
      });
      baseFields.push({
        id: 'memberOf',
        label: parentVersionColumnLabel,
        elements: memberOfOptions,
        filterBy: {
          operators: ['is', 'isNot', 'isAny'] as ('is' | 'isNot' | 'isAny')[],
        },
        render: ({ item }: { item: TableRow }) =>
          item.memberOf
            ? `${parentVersionPrefixValue} ${item.memberOf}`.trim()
            : '—',
      });
      baseFields.push({
        id: 'date',
        label: 'Release Date',
        enableSorting: true,
        render: ({ item }: { item: TableRow }) =>
          item.date
            ? new Date(item.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '—',
      });
    }

    // Total PRs field
    baseFields.push({
      id: 'totalPRs',
      label: isAggregated ? 'PRs' : 'Total PRs',
      enableSorting: true,
      render: ({ item }: { item: TableRow }) => (
        <span className={isAggregated ? 'total-cell' : 'release-total-prs'}>
          {item.totalPRs.toLocaleString()}
        </span>
      ),
    });

    // Category fields
    const categoryFields = categoryConfig.aggregations.map((agg) => ({
      id: `cat_${agg.id}`,
      label: agg.labels.full,
      enableSorting: true,
      getValue: ({ item }: { item: TableRow }) => {
        const count = item.categoryTotals[agg.id] || 0;
        if (isAggregated) {
          if (viewMode === 'averages' && item.groupedCount) {
            return count > 0 ? Math.round(count / item.groupedCount) : 0;
          }
          if (viewMode === 'distribution') {
            return item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
          }
          return count; // totals
        }
        // Individual release
        if (viewMode === 'distribution') {
          return item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
        }
        return count;
      },
      render: ({ item }: { item: TableRow }) => {
        const count = item.categoryTotals[agg.id] || 0;
        const colorStyle = { color: agg.color };

        if (isAggregated) {
          if (viewMode === 'averages' && item.groupedCount) {
            const avg = count > 0 ? Math.round(count / item.groupedCount) : 0;
            if (avg === 0) return '—';
            return <span className={`release-${agg.id}`} style={colorStyle}>{avg}</span>;
          }
          if (viewMode === 'distribution') {
            const percent = item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
            if (percent === 0) return '—';
            return <span className={`release-${agg.id}`} style={colorStyle}>{percent}%</span>;
          }
          // totals
          if (count === 0) return '—';
          return <span className={`release-${agg.id}`} style={colorStyle}>{count.toLocaleString()}</span>;
        }

        // Individual release
        const percent = item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
        if (viewMode === 'distribution') {
          return <span className={`release-${agg.id}`} style={colorStyle}>{percent}%</span>;
        }
        if (agg.id === 'features' || agg.id === 'bugs') {
          return (
            <span className={`release-${agg.id}`} style={colorStyle}>
              {count} ({percent}%)
            </span>
          );
        }
        return <span className={`release-${agg.id}`} style={colorStyle}>{count}</span>;
      },
    }));

    // Contributor fields (always defined, visibility controlled by visibleFieldIds)
    const contributorFields = [];
    contributorFields.push({
        id: 'contributors',
        label: 'Contributors',
        enableSorting: true,
        getValue: ({ item }: { item: TableRow }) => {
          if (isAggregated && viewMode === 'averages' && item.groupedCount) {
            return item.contributors > 0 ? Math.round(item.contributors / item.groupedCount) : 0;
          }
          return item.contributors;
        },
        render: ({ item }: { item: TableRow }) => {
          if (isAggregated && viewMode === 'averages' && item.groupedCount) {
            return item.contributors > 0 ? Math.round(item.contributors / item.groupedCount) : '—';
          }
          if (isAggregated) {
            return item.contributors > 0 ? item.contributors.toLocaleString() : '—';
          }
          return item.contributors;
        },
      });
      contributorFields.push({
        id: 'newContributors',
        label: 'New Contributors',
        enableSorting: true,
        getValue: ({ item }: { item: TableRow }) => {
          if (isAggregated && viewMode === 'averages' && item.groupedCount) {
            return item.newContributors > 0 ? Math.round(item.newContributors / item.groupedCount) : 0;
          }
          return item.newContributors;
        },
        render: ({ item }: { item: TableRow }) => {
          if (isAggregated && viewMode === 'averages' && item.groupedCount) {
            const avg = item.newContributors > 0 ? Math.round(item.newContributors / item.groupedCount) : 0;
            return avg > 0 ? <span className="release-new-contributors">+{avg}</span> : '—';
          }
          if (isAggregated) {
            return item.newContributors > 0 ? (
              <span className="release-new-contributors">+{item.newContributors.toLocaleString()}</span>
            ) : '—';
          }
          return item.newContributors > 0 ? (
            <span className="release-new-contributors">+{item.newContributors}</span>
          ) : '0';
        },
      });

    const getAIDivisor = (item: TableRow) =>
      isAggregated && viewMode === 'averages' && item.groupedCount
        ? item.groupedCount
        : 1;

    const aiFields = [
      {
        id: 'aiPRs',
        label: isAggregated && viewMode === 'averages' ? 'Detected AI / Release' : 'Detected AI PRs',
        enableSorting: true,
        getValue: ({ item }: { item: TableRow }) => item.aiPRs / getAIDivisor(item),
        render: ({ item }: { item: TableRow }) => {
          const value = item.aiPRs / getAIDivisor(item);
          return <span className="release-ai-prs">{formatCompactNumber(value)}</span>;
        },
      },
      {
        id: 'aiShare',
        label: 'Detected AI %',
        enableSorting: true,
        render: ({ item }: { item: TableRow }) =>
          item.totalPRs > 0 ? `${item.aiShare.toFixed(1)}%` : '—',
      },
      {
        id: 'aiNonAgent',
        label: 'Other detected AI',
        enableSorting: true,
        getValue: ({ item }: { item: TableRow }) => item.aiNonAgent / getAIDivisor(item),
        render: ({ item }: { item: TableRow }) => {
          const value = item.aiNonAgent / getAIDivisor(item);
          return value > 0 ? formatCompactNumber(value) : '—';
        },
      },
      {
        id: 'aiAgent',
        label: 'Known agent account',
        enableSorting: true,
        getValue: ({ item }: { item: TableRow }) => item.aiAgent / getAIDivisor(item),
        render: ({ item }: { item: TableRow }) => {
          const value = item.aiAgent / getAIDivisor(item);
          return value > 0 ? formatCompactNumber(value) : '—';
        },
      },
      {
        id: 'aiAgentShare',
        label: 'Known agent %',
        enableSorting: true,
        render: ({ item }: { item: TableRow }) =>
          item.aiPRs > 0 ? `${item.aiAgentShare.toFixed(1)}%` : '—',
      },
      {
        id: 'aiNotDetected',
        label: isAggregated && viewMode === 'averages' ? 'Not detected / Release' : 'Not detected',
        enableSorting: true,
        getValue: ({ item }: { item: TableRow }) => item.aiNotDetected / getAIDivisor(item),
        render: ({ item }: { item: TableRow }) => {
          const value = item.aiNotDetected / getAIDivisor(item);
          return formatCompactNumber(value);
        },
      },
      {
        id: 'aiTools',
        label: 'Tools',
        enableSorting: true,
        render: ({ item }: { item: TableRow }) => {
          const divisor = getAIDivisor(item);
          const tools = Object.entries(item.aiToolCounts)
            .sort(([, a], [, b]) => b - a)
            .filter(([, count]) => count > 0);

          if (tools.length === 0) return '—';

          return (
            <span className="ai-tool-list">
              {tools.map(([tool, count]) => (
                <span key={tool} className="ai-tool-chip">
                  {tool} {formatCompactNumber(count / divisor)}
                </span>
              ))}
            </span>
          );
        },
      },
    ];

    return [...baseFields, ...categoryFields, ...contributorFields, ...aiFields];
  }, [categoryConfig, isAggregated, tabConfig, viewMode, memberOfOptions]);

  // Process data (filter, search, sort)
  const processedData = useMemo(() => {
    let result = [...tableData];

    if (view.search) {
      const searchLower = view.search.toLowerCase();
      result = result.filter((row) => {
        if (row.version.toLowerCase().includes(searchLower)) return true;
        if (row.groupedRange?.toLowerCase().includes(searchLower)) return true;
        if (row.memberOf?.toLowerCase().includes(searchLower)) return true;
        if (row.aiTools.toLowerCase().includes(searchLower)) return true;
        return false;
      });
    }

    for (const filter of view.filters) {
      if (filter.field === 'memberOf') {
        if (filter.operator === 'is') {
          result = result.filter((r) => r.memberOf === filter.value);
        } else if (filter.operator === 'isNot') {
          result = result.filter((r) => r.memberOf !== filter.value);
        } else if (filter.operator === 'isAny' && Array.isArray(filter.value)) {
          result = result.filter((r) =>
            (filter.value as unknown as string[]).includes(r.memberOf ?? '')
          );
        }
      }
    }

    if (view.sort.field) {
      const field = view.sort.field;
      const activeField = (fields as SortableField[]).find(({ id }) => id === field);

      result.sort((a, b) => {
        if (field === 'version') {
          // Version comparison (semantic versioning)
          if (!a.version || !b.version) return 0;
          const partsA = a.version.split('.').map(Number);
          const partsB = b.version.split('.').map(Number);
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] ?? 0;
            const numB = partsB[i] ?? 0;
            if (numA !== numB) {
              return view.sort.direction === 'asc' ? numA - numB : numB - numA;
            }
          }
          return 0;
        }

        if (field === 'date' && a.date && b.date) {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return view.sort.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        const getSortValue = (item: TableRow): number | string | undefined => {
          if (activeField?.getValue) {
            return activeField.getValue({ item });
          }

          // Keep the old path for fields that do not provide getValue.
          if (field.startsWith('cat_')) {
            const catId = field.replace('cat_', '');
            return item.categoryTotals[catId] || 0;
          }

          return item[field as keyof TableRow] as number | string | undefined;
        };

        const aVal = getSortValue(a);
        const bVal = getSortValue(b);

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return view.sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const strA = String(aVal ?? '');
        const strB = String(bVal ?? '');
        return view.sort.direction === 'asc'
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    return result;
  }, [tableData, fields, view.search, view.filters, view.sort]);

  // Paginate
  const paginatedData = useMemo(() => {
    const start = (view.page - 1) * view.perPage;
    const end = start + view.perPage;
    return processedData.slice(start, end);
  }, [processedData, view.page, view.perPage]);

  const paginationInfo = useMemo(
    () => ({
      totalItems: processedData.length,
      totalPages: Math.ceil(processedData.length / view.perPage),
    }),
    [processedData.length, view.perPage]
  );

  return (
    <div className={isAggregated ? 'aggregated-table' : undefined}>
      <DataViews
        data={paginatedData}
        fields={fields}
        view={effectiveView as Parameters<typeof DataViews>[0]['view']}
        onChangeView={setView as Parameters<typeof DataViews>[0]['onChangeView']}
        paginationInfo={paginationInfo}
        defaultLayouts={defaultLayouts}
        getItemId={(item: TableRow) => item.id}
      />
    </div>
  );
}
