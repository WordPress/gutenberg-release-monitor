import { useState, useMemo, useEffect } from 'react';
import { DataViews } from '@wordpress/dataviews';
import {
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import type { WPVersionStats } from '../data/types';
import {
  loadCategoryConfig,
  type CategoryConfig,
} from '../utils/categories';

import '@wordpress/dataviews/build-style/style.css';

interface WPVersionTableProps {
  wpVersionStats: WPVersionStats[];
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

// Mapping from category config IDs to WPVersionStats field names
const CATEGORY_FIELD_MAP: Record<string, { total: keyof WPVersionStats; avg?: keyof WPVersionStats }> = {
  features: { total: 'totalFeaturePRs', avg: 'avgFeaturePRsPerRelease' },
  bugs: { total: 'totalBugPRs', avg: 'avgBugPRsPerRelease' },
  a11y: { total: 'totalA11yPRs' },
  performance: { total: 'totalPerformancePRs' },
};

// Mapping for percentage fields
const PERCENT_FIELD_MAP: Record<string, keyof WPVersionStats> = {
  features: 'avgEnhancementPercent',
  bugs: 'avgBugfixPercent',
};

type ViewMode = 'averages' | 'totals' | 'distribution';

export function WPVersionTable({ wpVersionStats }: WPVersionTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('averages');
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  // Load category config on mount
  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Get categories that have WPVersionStats fields
  const supportedCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations.filter((agg) => agg.id in CATEGORY_FIELD_MAP);
  }, [categoryConfig]);

  // Compute visible fields based on view mode
  const visibleFields = useMemo(() => {
    const categoryFieldIds = supportedCategories.map((agg) => `cat_${agg.id}_${viewMode}`);
    return [...BASE_FIELDS, 'totalPRs', ...categoryFieldIds, ...CONTRIBUTOR_FIELDS];
  }, [viewMode, supportedCategories]);

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

  // Generate category fields dynamically from config
  const categoryFields = useMemo(() => {
    if (!categoryConfig) return [];

    return supportedCategories.flatMap((agg) => {
      const mapping = CATEGORY_FIELD_MAP[agg.id];
      if (!mapping) return [];

      const fields = [];

      // Averages field
      if (viewMode === 'averages') {
        const avgField = mapping.avg;
        fields.push({
          id: `cat_${agg.id}_averages`,
          label: agg.label,
          enableSorting: true,
          getValue: ({ item }: { item: WPVersionStats }) => {
            if (avgField) return item[avgField] as number;
            // Calculate average from total
            const total = item[mapping.total] as number;
            return total > 0 ? Math.round(total / item.releaseCount) : 0;
          },
          render: ({ item }: { item: WPVersionStats }) => {
            let value: number;
            if (avgField) {
              value = item[avgField] as number;
            } else {
              const total = item[mapping.total] as number;
              value = total > 0 ? Math.round(total / item.releaseCount) : 0;
            }
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
          render: ({ item }: { item: WPVersionStats }) => {
            const value = item[mapping.total] as number;
            if (value === 0) return '—';
            return <span className={`release-${agg.id}`}>{value.toLocaleString()}</span>;
          },
        });
      }

      // Distribution field (percentages)
      if (viewMode === 'distribution') {
        const percentField = PERCENT_FIELD_MAP[agg.id];
        fields.push({
          id: `cat_${agg.id}_distribution`,
          label: agg.label,
          enableSorting: true,
          getValue: ({ item }: { item: WPVersionStats }) => {
            if (percentField) return item[percentField] as number;
            // Calculate percentage from totals
            const total = item[mapping.total] as number;
            return item.totalPRs > 0 ? Math.round((total / item.totalPRs) * 100) : 0;
          },
          render: ({ item }: { item: WPVersionStats }) => {
            let percent: number;
            if (percentField) {
              percent = item[percentField] as number;
            } else {
              const total = item[mapping.total] as number;
              percent = item.totalPRs > 0 ? Math.round((total / item.totalPRs) * 100) : 0;
            }
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
  }, [wpVersionStats, view.search, view.sort]);

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
      <div className="wp-version-table-header">
        <ToggleGroupControl
          __nextHasNoMarginBottom
          isBlock
          label="View mode"
          hideLabelFromVision
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
        >
          <ToggleGroupControlOption value="averages" label="Averages" />
          <ToggleGroupControlOption value="totals" label="Totals" />
          <ToggleGroupControlOption value="distribution" label="Distribution" />
        </ToggleGroupControl>
      </div>
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
