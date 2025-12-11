import { useState, useMemo } from 'react';
import { DataViews } from '@wordpress/dataviews';
import { ExternalLink, Tooltip } from '@wordpress/components';
import type { Release } from '../data/types';

import '@wordpress/dataviews/build-style/style.css';

interface ReleasesTableProps {
  releases: Release[];
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

export function ReleasesTable({ releases }: ReleasesTableProps) {
  // Derive WP version options from releases data
  const wpVersionOptions = useMemo(() => {
    const versions = new Set<string>();
    releases.forEach((r) => {
      if (r.wpVersion) versions.add(r.wpVersion);
    });
    return Array.from(versions)
      .sort((a, b) => {
        const [aMajor, aMinor] = a.split('.').map(Number);
        const [bMajor, bMinor] = b.split('.').map(Number);
        if (bMajor !== aMajor) return bMajor - aMajor;
        return bMinor - aMinor;
      })
      .map((v) => ({ value: v, label: `WP ${v}` }));
  }, [releases]);
  const [view, setView] = useState<View>({
    type: 'table',
    perPage: 25,
    page: 1,
    sort: {
      field: 'gbVersion',
      direction: 'desc',
    },
    search: '',
    filters: [],
    fields: [
      'gbVersion',
      'wpVersion',
      'date',
      'totalPRs',
      'featurePRs',
      'bugPRs',
      'a11yPRs',
      'performancePRs',
      'contributors',
      'newContributors',
    ],
    layout: {},
  });

  const fields = useMemo(
    () => [
      {
        id: 'gbVersion',
        label: 'GB Version',
        enableHiding: false,
        enableGlobalSearch: true,
        render: ({ item }: { item: Release }) => (
          <>
            <ExternalLink
              href={item.changelogUrl}
              className="release-version-link"
            >
              {item.gbVersion}
            </ExternalLink>
            {item.isLastBeforeWPBeta && (
              <Tooltip text="Last Gutenberg version before WordPress beta freeze">
                <span className="release-badge-cutoff">Beta Cutoff</span>
              </Tooltip>
            )}
          </>
        ),
      },
      {
        id: 'wpVersion',
        label: 'WP Version',
        elements: wpVersionOptions,
        filterBy: {
          operators: ['is', 'isNot', 'isAny'] as ('is' | 'isNot' | 'isAny')[],
        },
        render: ({ item }: { item: Release }) =>
          item.wpVersion ? `WP ${item.wpVersion}` : '—',
      },
      {
        id: 'date',
        label: 'Release Date',
        enableSorting: true,
        render: ({ item }: { item: Release }) =>
          new Date(item.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
      },
      {
        id: 'totalPRs',
        label: 'Total PRs',
        enableSorting: true,
        render: ({ item }: { item: Release }) => (
          <span className="release-total-prs">{item.totalPRs}</span>
        ),
      },
      {
        id: 'featurePRs',
        label: 'Features',
        enableSorting: true,
        render: ({ item }: { item: Release }) => (
          <span className="release-features">
            {item.featurePRs} ({item.enhancementPercent}%)
          </span>
        ),
      },
      {
        id: 'bugPRs',
        label: 'Bug Fixes',
        enableSorting: true,
        render: ({ item }: { item: Release }) => (
          <span className="release-bugs">
            {item.bugPRs} ({item.bugfixPercent}%)
          </span>
        ),
      },
      {
        id: 'a11yPRs',
        label: 'A11y',
        enableSorting: true,
        render: ({ item }: { item: Release }) => (
          <span className="release-a11y">{item.a11yPRs}</span>
        ),
      },
      {
        id: 'performancePRs',
        label: 'Perf',
        enableSorting: true,
        render: ({ item }: { item: Release }) => (
          <span className="release-perf">{item.performancePRs}</span>
        ),
      },
      {
        id: 'contributors',
        label: 'Contributors',
        enableSorting: true,
      },
      {
        id: 'newContributors',
        label: 'New Contributors',
        enableSorting: true,
        render: ({ item }: { item: Release }) =>
          item.newContributors > 0 ? (
            <span className="release-new-contributors">+{item.newContributors}</span>
          ) : (
            '0'
          ),
      },
    ],
    [wpVersionOptions]
  );

  // Filter and sort data based on view state
  const processedData = useMemo(() => {
    let result = [...releases];

    // Apply search filter
    if (view.search) {
      const searchLower = view.search.toLowerCase();
      result = result.filter(
        (release) =>
          release.gbVersion.toLowerCase().includes(searchLower) ||
          release.wpVersion?.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    for (const filter of view.filters) {
      if (filter.field === 'wpVersion') {
        if (filter.operator === 'is') {
          result = result.filter((r) => r.wpVersion === filter.value);
        } else if (filter.operator === 'isNot') {
          result = result.filter((r) => r.wpVersion !== filter.value);
        } else if (filter.operator === 'isAny' && Array.isArray(filter.value)) {
          result = result.filter((r) =>
            (filter.value as unknown as string[]).includes(r.wpVersion ?? '')
          );
        }
      }
    }

    // Apply sorting
    if (view.sort.field) {
      result.sort((a, b) => {
        const field = view.sort.field as keyof Release;
        const aVal = a[field];
        const bVal = b[field];

        // Handle version sorting (semver-like comparison)
        if (field === 'gbVersion') {
          const partsA = String(aVal).split('.').map(Number);
          const partsB = String(bVal).split('.').map(Number);
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] ?? 0;
            const numB = partsB[i] ?? 0;
            if (numA !== numB) {
              return view.sort.direction === 'asc' ? numA - numB : numB - numA;
            }
          }
          return 0;
        }

        // Handle date sorting
        if (field === 'date') {
          const dateA = new Date(aVal as string).getTime();
          const dateB = new Date(bVal as string).getTime();
          return view.sort.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

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
  }, [releases, view.search, view.filters, view.sort]);

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
    <DataViews
      data={paginatedData}
      fields={fields}
      view={view as Parameters<typeof DataViews>[0]['view']}
      onChangeView={setView as Parameters<typeof DataViews>[0]['onChangeView']}
      paginationInfo={paginationInfo}
      defaultLayouts={defaultLayouts}
      getItemId={(item: Release) => item.gbVersion}
    />
  );
}
