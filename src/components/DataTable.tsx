import { useState, useMemo, useEffect } from 'react';
import { DataViews } from '@wordpress/dataviews';
import { ExternalLink, Tooltip } from '@wordpress/components';
import type { Release, WPVersionStats } from '../data/types';
import type { ViewMode, MetricType } from '../App';
import {
  loadCategoryConfig,
  getAggregatedPRs,
  type CategoryConfig,
} from '../utils/categories';

import '@wordpress/dataviews/build-style/style.css';

interface BaseDataTableProps {
  viewMode: ViewMode;
  metric: MetricType;
}

interface WPVersionDataTableProps extends BaseDataTableProps {
  dataSource: 'wp-version';
  data: WPVersionStats[];
}

interface GBReleaseDataTableProps extends BaseDataTableProps {
  dataSource: 'gb-release';
  data: Release[];
}

type DataTableProps = WPVersionDataTableProps | GBReleaseDataTableProps;

// Normalized row type that both data sources transform into
interface TableRow {
  id: string;
  version: string;           // wpVersion or gbVersion (displayed as primary version)
  displayVersion: string;    // formatted display string
  totalPRs: number;
  contributors: number;
  newContributors: number;
  // WP-specific
  gbVersionRange?: string;
  releaseCount?: number;
  avgPRsPerRelease?: number;
  // GB-specific
  date?: string;
  changelogUrl?: string;
  isLastBeforeWPBeta?: boolean;
  wpVersionIncluded?: string;  // Which WP version this GB release is in
  // Unified category data (raw counts)
  categoryTotals: Record<string, number>;
  // Source type for conditional rendering
  sourceType: 'wp' | 'gb';
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

const defaultLayouts = {
  table: {},
};

const CONTRIBUTOR_FIELDS = ['contributors', 'newContributors'];

export function DataTable(props: DataTableProps) {
  const { dataSource, data, viewMode, metric } = props;
  const isWPVersion = dataSource === 'wp-version';
  const isContributorMetric = metric === 'contributors';

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Get default visible categories
  const defaultVisibleCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
  }, [categoryConfig]);

  // Transform source data into normalized TableRow[]
  const tableData: TableRow[] = useMemo(() => {
    if (!categoryConfig) return [];

    if (isWPVersion) {
      const wpData = data as WPVersionStats[];
      return wpData.map((stat) => {
        // Build category totals
        const categoryTotals: Record<string, number> = {};
        categoryConfig.aggregations.forEach((agg) => {
          categoryTotals[agg.id] = stat.categoryTotals?.[agg.id] || 0;
        });

        return {
          id: stat.wpVersion,
          version: stat.wpVersion,
          displayVersion: `WP ${stat.wpVersion}`,
          totalPRs: stat.totalPRs,
          contributors: stat.totalContributors,
          newContributors: stat.totalNewContributors,
          gbVersionRange: stat.gbVersionRange,
          releaseCount: stat.releaseCount,
          avgPRsPerRelease: stat.avgPRsPerRelease,
          categoryTotals,
          sourceType: 'wp' as const,
        };
      });
    }

    // GB Release
    const gbData = data as Release[];
    return gbData.map((release) => {
      // Aggregate categories using config
      const categoryTotals: Record<string, number> = {};
      categoryConfig.aggregations.forEach((agg) => {
        categoryTotals[agg.id] = getAggregatedPRs(release.categories, categoryConfig, agg.id);
      });

      return {
        id: release.gbVersion,
        version: release.gbVersion,
        displayVersion: release.gbVersion,
        totalPRs: release.totalPRs,
        contributors: release.contributors,
        newContributors: release.newContributors,
        date: release.date,
        changelogUrl: release.changelogUrl,
        isLastBeforeWPBeta: release.isLastBeforeWPBeta,
        wpVersionIncluded: release.wpVersion ?? undefined,
        categoryTotals,
        sourceType: 'gb' as const,
      };
    });
  }, [data, categoryConfig, isWPVersion]);

  // Derive WP version options from GB releases (for filtering)
  const wpVersionOptions = useMemo(() => {
    if (isWPVersion) return [];
    const versions = new Set<string>();
    tableData.forEach((row) => {
      if (row.wpVersionIncluded) versions.add(row.wpVersionIncluded);
    });
    return Array.from(versions)
      .sort((a, b) => {
        const [aMajor, aMinor] = a.split('.').map(Number);
        const [bMajor, bMinor] = b.split('.').map(Number);
        if (bMajor !== aMajor) return bMajor - aMajor;
        return bMinor - aMinor;
      })
      .map((v) => ({ value: v, label: `WP ${v}` }));
  }, [isWPVersion, tableData]);

  // Compute visible field IDs based on data source, view mode, and metric
  const visibleFieldIds = useMemo(() => {
    const categoryFieldIds = defaultVisibleCategories.map((agg) => `cat_${agg.id}`);

    // Base fields that always appear
    const baseFields = isWPVersion
      ? ['version', 'gbVersionRange', 'releaseCount']
      : ['version', 'wpVersionIncluded', 'date'];

    // Metric-specific fields
    if (isContributorMetric) {
      // Contributor metric: show contributor fields only
      return [...baseFields, ...CONTRIBUTOR_FIELDS];
    }

    // PR metric: show totalPRs and category breakdown
    return [...baseFields, 'totalPRs', ...categoryFieldIds];
  }, [isWPVersion, defaultVisibleCategories, isContributorMetric]);

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

  // Compute effective view with current fields (avoids setState in effect)
  const effectiveView = useMemo(
    () => ({ ...view, fields: visibleFieldIds }),
    [view, visibleFieldIds]
  );

  // Build fields for DataViews (all work with TableRow)
  const fields = useMemo(() => {
    if (!categoryConfig) return [];

    const baseFields = [];

    // Version field (primary identifier)
    if (isWPVersion) {
      baseFields.push({
        id: 'version',
        label: 'WP Version',
        enableHiding: false,
        enableGlobalSearch: true,
        render: ({ item }: { item: TableRow }) => (
          <span className="wp-version-cell">{item.displayVersion}</span>
        ),
      });
      baseFields.push({
        id: 'gbVersionRange',
        label: 'GB Versions',
        enableSorting: false,
        render: ({ item }: { item: TableRow }) => (
          <span className="wp-version-range">{item.gbVersionRange}</span>
        ),
      });
      baseFields.push({
        id: 'releaseCount',
        label: 'Releases',
        enableSorting: true,
      });
    } else {
      baseFields.push({
        id: 'version',
        label: 'GB Version',
        enableHiding: false,
        enableGlobalSearch: true,
        render: ({ item }: { item: TableRow }) => (
          <>
            <ExternalLink
              href={item.changelogUrl || '#'}
              className="release-version-link"
            >
              {item.displayVersion}
            </ExternalLink>
            {item.isLastBeforeWPBeta && (
              <Tooltip text="Last Gutenberg version before WordPress beta freeze">
                <span className="release-badge-cutoff">Beta Cutoff</span>
              </Tooltip>
            )}
          </>
        ),
      });
      baseFields.push({
        id: 'wpVersionIncluded',
        label: 'WP Version',
        elements: wpVersionOptions,
        filterBy: {
          operators: ['is', 'isNot', 'isAny'] as ('is' | 'isNot' | 'isAny')[],
        },
        render: ({ item }: { item: TableRow }) =>
          item.wpVersionIncluded ? `WP ${item.wpVersionIncluded}` : '—',
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
      label: isWPVersion ? 'PRs' : 'Total PRs',
      enableSorting: true,
      render: ({ item }: { item: TableRow }) => (
        <span className={isWPVersion ? 'total-cell' : 'release-total-prs'}>
          {item.totalPRs.toLocaleString()}
        </span>
      ),
    });

    // Category fields
    const categoryFields = categoryConfig.aggregations.map((agg) => ({
      id: `cat_${agg.id}`,
      label: agg.label,
      enableSorting: true,
      getValue: ({ item }: { item: TableRow }) => {
        const count = item.categoryTotals[agg.id] || 0;
        if (isWPVersion) {
          if (viewMode === 'averages' && item.releaseCount) {
            return count > 0 ? Math.round(count / item.releaseCount) : 0;
          }
          if (viewMode === 'distribution') {
            return item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
          }
          return count; // totals
        }
        // GB Release
        if (viewMode === 'distribution') {
          return item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
        }
        return count;
      },
      render: ({ item }: { item: TableRow }) => {
        const count = item.categoryTotals[agg.id] || 0;

        if (isWPVersion) {
          if (viewMode === 'averages' && item.releaseCount) {
            const avg = count > 0 ? Math.round(count / item.releaseCount) : 0;
            if (avg === 0) return '—';
            return <span className={`release-${agg.id}`}>{avg}</span>;
          }
          if (viewMode === 'distribution') {
            const percent = item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
            if (percent === 0) return '—';
            return <span className={`release-${agg.id}`}>{percent}%</span>;
          }
          // totals
          if (count === 0) return '—';
          return <span className={`release-${agg.id}`}>{count.toLocaleString()}</span>;
        }

        // GB Release
        const percent = item.totalPRs > 0 ? Math.round((count / item.totalPRs) * 100) : 0;
        if (viewMode === 'distribution') {
          return <span className={`release-${agg.id}`}>{percent}%</span>;
        }
        if (agg.id === 'features' || agg.id === 'bugs') {
          return (
            <span className={`release-${agg.id}`}>
              {count} ({percent}%)
            </span>
          );
        }
        return <span className={`release-${agg.id}`}>{count}</span>;
      },
    }));

    // Contributor fields (always defined, visibility controlled by visibleFieldIds)
    const contributorFields = [];
    contributorFields.push({
        id: 'contributors',
        label: 'Contributors',
        enableSorting: true,
        getValue: ({ item }: { item: TableRow }) => {
          if (isWPVersion && viewMode === 'averages' && item.releaseCount) {
            return item.contributors > 0 ? Math.round(item.contributors / item.releaseCount) : 0;
          }
          return item.contributors;
        },
        render: ({ item }: { item: TableRow }) => {
          if (isWPVersion && viewMode === 'averages' && item.releaseCount) {
            return item.contributors > 0 ? Math.round(item.contributors / item.releaseCount) : '—';
          }
          if (isWPVersion) {
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
          if (isWPVersion && viewMode === 'averages' && item.releaseCount) {
            return item.newContributors > 0 ? Math.round(item.newContributors / item.releaseCount) : 0;
          }
          return item.newContributors;
        },
        render: ({ item }: { item: TableRow }) => {
          if (isWPVersion && viewMode === 'averages' && item.releaseCount) {
            const avg = item.newContributors > 0 ? Math.round(item.newContributors / item.releaseCount) : 0;
            return avg > 0 ? <span className="release-new-contributors">+{avg}</span> : '—';
          }
          if (isWPVersion) {
            return item.newContributors > 0 ? (
              <span className="release-new-contributors">+{item.newContributors.toLocaleString()}</span>
            ) : '—';
          }
          return item.newContributors > 0 ? (
            <span className="release-new-contributors">+{item.newContributors}</span>
          ) : '0';
        },
      });

    return [...baseFields, ...categoryFields, ...contributorFields];
  }, [categoryConfig, isWPVersion, viewMode, wpVersionOptions]);

  // Process data (filter, search, sort)
  const processedData = useMemo(() => {
    let result = [...tableData];

    if (view.search) {
      const searchLower = view.search.toLowerCase();
      result = result.filter((row) => {
        if (row.version.toLowerCase().includes(searchLower)) return true;
        if (row.gbVersionRange?.toLowerCase().includes(searchLower)) return true;
        if (row.wpVersionIncluded?.toLowerCase().includes(searchLower)) return true;
        return false;
      });
    }

    for (const filter of view.filters) {
      if (filter.field === 'wpVersionIncluded') {
        if (filter.operator === 'is') {
          result = result.filter((r) => r.wpVersionIncluded === filter.value);
        } else if (filter.operator === 'isNot') {
          result = result.filter((r) => r.wpVersionIncluded !== filter.value);
        } else if (filter.operator === 'isAny' && Array.isArray(filter.value)) {
          result = result.filter((r) =>
            (filter.value as unknown as string[]).includes(r.wpVersionIncluded ?? '')
          );
        }
      }
    }

    if (view.sort.field) {
      result.sort((a, b) => {
        const field = view.sort.field;

        if (field === 'version') {
          // Version comparison (semantic versioning)
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

        // Get values - handle direct properties and category fields
        let aVal: number | string | undefined;
        let bVal: number | string | undefined;

        if (field.startsWith('cat_')) {
          const catId = field.replace('cat_', '');
          aVal = a.categoryTotals[catId] || 0;
          bVal = b.categoryTotals[catId] || 0;
        } else {
          aVal = a[field as keyof TableRow] as number | string | undefined;
          bVal = b[field as keyof TableRow] as number | string | undefined;
        }

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
  }, [tableData, view.search, view.filters, view.sort]);

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
    <div className={isWPVersion ? 'wp-version-table' : undefined}>
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
