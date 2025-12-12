import { useState, useMemo, useEffect } from 'react';
import { DataViews } from '@wordpress/dataviews';
import type { WPVersionStats } from '../data/types';
import type { ViewMode } from '../App';
import {
  loadCategoryConfig,
  type CategoryConfig,
} from '../utils/categories';

import '@wordpress/dataviews/build-style/style.css';

interface WPVersionTableProps {
  wpVersionStats: WPVersionStats[];
  viewMode: ViewMode;
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

// Base fields always visible
const BASE_FIELDS = ['wpVersion', 'gbVersionRange', 'releaseCount'];
const CONTRIBUTOR_FIELDS = ['contributors', 'newContributors'];

export function WPVersionTable({ wpVersionStats, viewMode }: WPVersionTableProps) {
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  // Load category config on mount
  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Get all categories from config
  const supportedCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations;
  }, [categoryConfig]);

  // Get default visible categories (those marked includeByDefault)
  const defaultVisibleCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
  }, [categoryConfig]);

  // Compute visible fields based on view mode (only includeByDefault categories)
  const visibleFields = useMemo(() => {
    const categoryFieldIds = defaultVisibleCategories.map((agg) => `cat_${agg.id}_${viewMode}`);
    return [...BASE_FIELDS, 'totalPRs', ...categoryFieldIds, ...CONTRIBUTOR_FIELDS];
  }, [viewMode, defaultVisibleCategories]);

  const [view, setView] = useState<View>({
    type: 'table',
    perPage: 25,
    page: 1,
    sort: {
      field: 'wpVersion',
      direction: 'desc',
    },
    search: '',
    filters: [],
    fields: [...BASE_FIELDS, 'totalPRs', ...CONTRIBUTOR_FIELDS],
    layout: {},
  });

  // Update view fields when mode or config changes
  useEffect(() => {
    setView((prev) => ({
      ...prev,
      fields: visibleFields,
    }));
  }, [visibleFields]);

  // Base fields always shown
  const baseFields = useMemo(() => [
    {
      id: 'wpVersion',
      label: 'WP Version',
      enableHiding: false,
      enableGlobalSearch: true,
      render: ({ item }: { item: WPVersionStats }) => (
        <span className="wp-version-cell">WP {item.wpVersion}</span>
      ),
    },
    {
      id: 'gbVersionRange',
      label: 'GB Versions',
      enableSorting: false,
      render: ({ item }: { item: WPVersionStats }) => (
        <span className="wp-version-range">{item.gbVersionRange}</span>
      ),
    },
    {
      id: 'releaseCount',
      label: 'Releases',
      enableSorting: true,
    },
    {
      id: 'totalPRs',
      label: 'PRs',
      enableSorting: true,
      render: ({ item }: { item: WPVersionStats }) => (
        <span className="total-cell">{item.totalPRs.toLocaleString()}</span>
      ),
    },
  ], []);

  // Generate category fields dynamically from config using categoryTotals
  const categoryFields = useMemo(() => {
    if (!categoryConfig) return [];

    return supportedCategories.flatMap((agg) => {
      const fields = [];

      // Averages field
      if (viewMode === 'averages') {
        fields.push({
          id: `cat_${agg.id}_averages`,
          label: agg.label,
          enableSorting: true,
          getValue: ({ item }: { item: WPVersionStats }) => {
            const total = item.categoryTotals?.[agg.id] || 0;
            return total > 0 ? Math.round(total / item.releaseCount) : 0;
          },
          render: ({ item }: { item: WPVersionStats }) => {
            const total = item.categoryTotals?.[agg.id] || 0;
            const value = total > 0 ? Math.round(total / item.releaseCount) : 0;
            if (value === 0) return '—';
            return <span className={`release-${agg.id}`}>{value}</span>;
          },
        });
      }

      // Totals field
      if (viewMode === 'totals') {
        fields.push({
          id: `cat_${agg.id}_totals`,
          label: agg.label,
          enableSorting: true,
          getValue: ({ item }: { item: WPVersionStats }) => item.categoryTotals?.[agg.id] || 0,
          render: ({ item }: { item: WPVersionStats }) => {
            const value = item.categoryTotals?.[agg.id] || 0;
            if (value === 0) return '—';
            return <span className={`release-${agg.id}`}>{value.toLocaleString()}</span>;
          },
        });
      }

      // Distribution field (percentages)
      if (viewMode === 'distribution') {
        fields.push({
          id: `cat_${agg.id}_distribution`,
          label: agg.label,
          enableSorting: true,
          getValue: ({ item }: { item: WPVersionStats }) => {
            const total = item.categoryTotals?.[agg.id] || 0;
            return item.totalPRs > 0 ? Math.round((total / item.totalPRs) * 100) : 0;
          },
          render: ({ item }: { item: WPVersionStats }) => {
            const total = item.categoryTotals?.[agg.id] || 0;
            const percent = item.totalPRs > 0 ? Math.round((total / item.totalPRs) * 100) : 0;
            if (percent === 0) return '—';
            return <span className={`release-${agg.id}`}>{percent}%</span>;
          },
        });
      }

      return fields;
    });
  }, [categoryConfig, supportedCategories, viewMode]);

  // Contributor fields
  const contributorFields = useMemo(() => {
    if (viewMode === 'distribution') return []; // No contributors in distribution view

    if (viewMode === 'averages') {
      return [
        {
          id: 'contributors',
          label: 'Contributors',
          enableSorting: true,
          getValue: ({ item }: { item: WPVersionStats }) =>
            item.totalContributors > 0 ? Math.round(item.totalContributors / item.releaseCount) : 0,
          render: ({ item }: { item: WPVersionStats }) =>
            item.totalContributors > 0
              ? Math.round(item.totalContributors / item.releaseCount)
              : '—',
        },
        {
          id: 'newContributors',
          label: 'New Contributors',
          enableSorting: true,
          getValue: ({ item }: { item: WPVersionStats }) =>
            item.totalNewContributors > 0 ? Math.round(item.totalNewContributors / item.releaseCount) : 0,
          render: ({ item }: { item: WPVersionStats }) =>
            item.totalNewContributors > 0 ? (
              <span className="release-new-contributors">
                +{Math.round(item.totalNewContributors / item.releaseCount)}
              </span>
            ) : '—',
        },
      ];
    }

    // Totals view
    return [
      {
        id: 'contributors',
        label: 'Contributors',
        enableSorting: true,
        render: ({ item }: { item: WPVersionStats }) =>
          item.totalContributors > 0 ? item.totalContributors.toLocaleString() : '—',
      },
      {
        id: 'newContributors',
        label: 'New Contributors',
        enableSorting: true,
        render: ({ item }: { item: WPVersionStats }) =>
          item.totalNewContributors > 0 ? (
            <span className="release-new-contributors">+{item.totalNewContributors.toLocaleString()}</span>
          ) : '—',
      },
    ];
  }, [viewMode]);

  // Combine all fields
  const fields = useMemo(
    () => [...baseFields, ...categoryFields, ...contributorFields],
    [baseFields, categoryFields, contributorFields]
  );

  // Sort data based on view state
  const processedData = useMemo(() => {
    let result = [...wpVersionStats];

    // Apply search filter
    if (view.search) {
      const searchLower = view.search.toLowerCase();
      result = result.filter(
        (stat) =>
          stat.wpVersion.toLowerCase().includes(searchLower) ||
          stat.gbVersionRange.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    for (const filter of view.filters) {
      if (filter.field === 'wpVersion') {
        if (filter.operator === 'is') {
          result = result.filter((s) => s.wpVersion === filter.value);
        } else if (filter.operator === 'isNot') {
          result = result.filter((s) => s.wpVersion !== filter.value);
        } else if (filter.operator === 'isAny' && Array.isArray(filter.value)) {
          result = result.filter((s) =>
            (filter.value as unknown as string[]).includes(s.wpVersion)
          );
        }
      }
    }

    // Apply sorting
    if (view.sort.field) {
      result.sort((a, b) => {
        const field = view.sort.field as keyof WPVersionStats;

        // Handle version sorting (semver-like comparison)
        if (field === 'wpVersion') {
          const [aMajor, aMinor] = a.wpVersion.split('.').map(Number);
          const [bMajor, bMinor] = b.wpVersion.split('.').map(Number);
          if (bMajor !== aMajor) {
            return view.sort.direction === 'asc' ? aMajor - bMajor : bMajor - aMajor;
          }
          return view.sort.direction === 'asc' ? aMinor - bMinor : bMinor - aMinor;
        }

        const aVal = a[field];
        const bVal = b[field];

        // Handle numeric sorting
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return view.sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Handle string sorting
        const strA = String(aVal ?? '');
        const strB = String(bVal ?? '');
        return view.sort.direction === 'asc'
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    return result;
  }, [wpVersionStats, view.search, view.filters, view.sort]);

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
    <div className="wp-version-table">
      <DataViews
        data={paginatedData}
        fields={fields}
        view={view as Parameters<typeof DataViews>[0]['view']}
        onChangeView={setView as Parameters<typeof DataViews>[0]['onChangeView']}
        paginationInfo={paginationInfo}
        defaultLayouts={defaultLayouts}
        getItemId={(item: WPVersionStats) => item.wpVersion}
      />
    </div>
  );
}
