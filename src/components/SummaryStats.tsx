import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  SelectControl,
  __experimentalText as Text,
} from '@wordpress/components';
import { chevronLeft, chevronRight } from '@wordpress/icons';
import type { Summary, WPVersionStats, Release } from '../data/types';
import { loadCategoryConfig, aggregateCategories, type CategoryConfig } from '../utils/categories';
import { CategoryPieChart } from './CategoryPieChart';
import { useURLState } from '../hooks/useURLState';

interface BaseSummaryStatsProps {
  summary: Summary;
  /** Currently visible category IDs (for clickable legend) */
  visibleCategories?: string[];
  /** Callback when a category is toggled via legend click */
  onCategoryToggle?: (categoryId: string, isVisible: boolean) => void;
}

interface WPVersionSummaryStatsProps extends BaseSummaryStatsProps {
  dataSource: 'wp-version';
  data: WPVersionStats[];
}

interface GBReleaseSummaryStatsProps extends BaseSummaryStatsProps {
  dataSource: 'gb-release';
  data: Release[];
}

type SummaryStatsProps = WPVersionSummaryStatsProps | GBReleaseSummaryStatsProps;

// Normalized data structure for both sources
interface NormalizedItem {
  id: string;
  version: string;
  displayLabel: string;
  sourceType: 'wp' | 'gb';
  // Stats
  totalPRs: number;
  contributors: number;
  newContributors: number;
  hasContributorData: boolean;
  // Category data (raw categories for GB, pre-aggregated for WP)
  rawCategories?: Record<string, number>;
  categoryTotals?: Record<string, number>;
  // WP-specific
  releaseCount?: number;
  gbVersionRange?: string;
  avgPRsPerRelease?: number;
  avgContributorsPerRelease?: number;
  avgNewContributorsPerRelease?: number;
  // GB-specific
  date?: string;
  wpVersion?: string;
}

interface StatItem {
  label: string;
  value: number;
  total?: number;
  unavailable?: boolean;
}

function formatDiff(current: number, total: number): string {
  if (total === 0) return '';
  const diff = Math.round(((current - total) / total) * 100);
  if (diff === 0) return '';
  return diff > 0 ? `+${diff}%` : `${diff}%`;
}

function getDiffClass(current: number, total: number): string {
  if (total === 0) return 'neutral';
  const diff = current - total;
  if (diff > 0) return 'positive';
  if (diff < 0) return 'negative';
  return 'neutral';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SummaryStats(props: SummaryStatsProps) {
  const { summary, visibleCategories, onCategoryToggle, dataSource, data } = props;
  const isWPVersion = dataSource === 'wp-version';

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  // Load category config on mount
  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Normalize all data into common structure
  const normalizedItems = useMemo((): NormalizedItem[] => {
    if (isWPVersion) {
      return (data as WPVersionStats[]).map((stat) => ({
        id: stat.wpVersion,
        version: stat.wpVersion,
        displayLabel: `WordPress ${stat.wpVersion}`,
        sourceType: 'wp' as const,
        totalPRs: stat.totalPRs,
        contributors: stat.totalContributors,
        newContributors: stat.totalNewContributors,
        hasContributorData: stat.totalContributors > 0,
        categoryTotals: stat.categoryTotals,
        releaseCount: stat.releaseCount,
        gbVersionRange: stat.gbVersionRange,
        avgPRsPerRelease: stat.avgPRsPerRelease,
        avgContributorsPerRelease: stat.avgContributorsPerRelease,
        avgNewContributorsPerRelease: stat.avgNewContributorsPerRelease,
      }));
    }
    return (data as Release[]).map((release) => ({
      id: release.gbVersion,
      version: release.gbVersion,
      displayLabel: `Gutenberg ${release.gbVersion}`,
      sourceType: 'gb' as const,
      totalPRs: release.totalPRs,
      contributors: release.contributors,
      newContributors: release.newContributors,
      hasContributorData: release.contributors > 0,
      rawCategories: release.categories,
      date: release.date,
      wpVersion: release.wpVersion ?? undefined,
    }));
  }, [data, isWPVersion]);

  // Compute valid versions and default for URL state
  const validVersions = useMemo(
    () => normalizedItems.map((item) => item.version),
    [normalizedItems]
  );

  const defaultVersion = useMemo(() => {
    if (isWPVersion) {
      return summary.currentWPCycle;
    }
    return normalizedItems[0]?.version || '';
  }, [isWPVersion, summary.currentWPCycle, normalizedItems]);

  const [selectedVersion, setSelectedVersion] = useURLState(
    isWPVersion ? 'wp' : 'gb',
    defaultVersion,
    validVersions
  );

  // Find selected item from normalized data (fallback to first item to prevent unmounting)
  const selectedItem = useMemo(
    () => normalizedItems.find((item) => item.version === selectedVersion) ?? normalizedItems[0],
    [normalizedItems, selectedVersion]
  );

  // Compute category totals (aggregate for GB, use pre-computed for WP)
  const categoryTotals = useMemo(() => {
    if (!selectedItem || !categoryConfig) return {};
    if (selectedItem.sourceType === 'wp') {
      return selectedItem.categoryTotals ?? {};
    }
    // GB: aggregate raw categories
    return aggregateCategories(selectedItem.rawCategories ?? {}, categoryConfig);
  }, [selectedItem, categoryConfig]);

  // Map category IDs to Summary field name suffixes
  const categoryToSummaryField: Record<string, string> = {
    features: 'Features',
    bugs: 'Bugs',
    codeQuality: 'CodeQuality',
    a11y: 'A11y',
    performance: 'Perf',
  };

  // Build stat items based on selected item
  const { primaryStats, secondaryStats } = useMemo(() => {
    if (!selectedItem || !categoryConfig) {
      return { primaryStats: [], secondaryStats: [] };
    }

    const defaultCategories = categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
    const isWP = selectedItem.sourceType === 'wp';

    // Category stat items with comparison to global average
    const buildCategoryStats = (useAverage: boolean): StatItem[] => {
      return defaultCategories.map((agg) => {
        const total = categoryTotals[agg.id] || 0;
        const value = useAverage && selectedItem.releaseCount
          ? Math.round(total / selectedItem.releaseCount)
          : total;
        const hasData = total > 0;
        const summaryFieldSuffix = categoryToSummaryField[agg.id];
        const summaryTotal = summaryFieldSuffix
          ? (summary[`avg${summaryFieldSuffix}Total` as keyof Summary] as number | undefined)
          : undefined;
        return {
          label: agg.label,
          value,
          total: useAverage ? summaryTotal : undefined,
          unavailable: !hasData,
        };
      });
    };

    if (isWP) {
      // WP: Primary = averages per release, Secondary = totals
      const avgCategoryStats = buildCategoryStats(true);
      const totalCategoryStats = buildCategoryStats(false);

      const primary: StatItem[] = [
        { label: 'All PRs', value: selectedItem.avgPRsPerRelease ?? 0, total: summary.avgPRsTotal },
        ...avgCategoryStats,
        { label: 'Contributors', value: selectedItem.avgContributorsPerRelease ?? 0, total: summary.avgContributorsTotal, unavailable: !selectedItem.hasContributorData },
        { label: 'New Contributors', value: selectedItem.avgNewContributorsPerRelease ?? 0, total: summary.avgNewContributorsTotal, unavailable: !selectedItem.hasContributorData },
      ];

      const secondary: StatItem[] = [
        { label: 'All PRs', value: selectedItem.totalPRs },
        ...totalCategoryStats,
        { label: 'Contributors', value: selectedItem.contributors, unavailable: !selectedItem.hasContributorData },
        { label: 'New Contributors', value: selectedItem.newContributors, unavailable: !selectedItem.hasContributorData },
      ];

      return { primaryStats: primary, secondaryStats: secondary };
    }

    // GB: Single column with comparison to averages
    const gbCategoryStats = buildCategoryStats(false);
    const primary: StatItem[] = [
      { label: 'All PRs', value: selectedItem.totalPRs, total: summary.avgPRsTotal },
      ...gbCategoryStats,
      { label: 'Contributors', value: selectedItem.contributors, total: summary.avgContributorsTotal, unavailable: !selectedItem.hasContributorData },
      { label: 'New Contributors', value: selectedItem.newContributors, total: summary.avgNewContributorsTotal, unavailable: !selectedItem.hasContributorData },
    ];

    return { primaryStats: primary, secondaryStats: [] };
  }, [selectedItem, categoryConfig, categoryTotals, summary, categoryToSummaryField]);

  // Build version options for dropdown
  const versionOptions = useMemo(
    () => normalizedItems.map((item) => ({ label: item.displayLabel, value: item.version })),
    [normalizedItems]
  );

  // Navigation helpers
  const currentIndex = normalizedItems.findIndex((item) => item.version === selectedVersion);
  const hasPrevious = currentIndex < normalizedItems.length - 1;
  const hasNext = currentIndex > 0;

  const goToPrevious = useCallback(() => {
    if (hasPrevious) {
      setSelectedVersion(normalizedItems[currentIndex + 1].version);
    }
  }, [currentIndex, hasPrevious, normalizedItems, setSelectedVersion]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setSelectedVersion(normalizedItems[currentIndex - 1].version);
    }
  }, [currentIndex, hasNext, normalizedItems, setSelectedVersion]);

  // Derived display values
  const isCurrentOrLatest = isWPVersion
    ? selectedVersion === summary.currentWPCycle
    : selectedVersion === normalizedItems[0]?.version;

  const versionNavLabel = isWPVersion ? 'WordPress version' : 'Gutenberg release';

  // Render stat item with optional comparison
  const renderStatItem = (stat: StatItem, showComparison: boolean) => {
    const diff = stat.unavailable ? '' : formatDiff(stat.value, stat.total ?? 0);
    const diffClass = stat.unavailable ? 'neutral' : getDiffClass(stat.value, stat.total ?? 0);

    return (
      <div key={stat.label} className="summary-stat">
        <div className="summary-stat-label">{stat.label}</div>
        <div className={`summary-stat-value${stat.unavailable ? ' unavailable' : ''}`}>
          {stat.unavailable ? 'N/A' : stat.value.toLocaleString()}
        </div>
        {showComparison && !stat.unavailable && stat.total !== undefined && (
          <div className="summary-stat-comparison">
            (vs {isWPVersion ? '' : 'avg '}{Math.round(stat.total)}
            {diff && (
              <>
                , <span className={`summary-stat-diff ${diffClass}`}>{diff}</span>
              </>
            )}
            )
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="summary-section">
      <CardHeader className="summary-card-header">
        <div className="summary-version-nav">
          <Button
            variant="secondary"
            size="small"
            icon={chevronLeft}
            onClick={goToPrevious}
            disabled={!hasPrevious}
            label={`Previous ${versionNavLabel}`}
          />
          <SelectControl
            __nextHasNoMarginBottom
            label={isWPVersion ? 'WordPress Version' : 'Gutenberg Version'}
            hideLabelFromVision
            value={selectedVersion}
            options={versionOptions}
            onChange={(value) => setSelectedVersion(value)}
            className="summary-version-select"
          />
          <Button
            variant="secondary"
            size="small"
            icon={chevronRight}
            onClick={goToNext}
            disabled={!hasNext}
            label={`Next ${versionNavLabel}`}
          />
        </div>
      </CardHeader>

      {selectedItem && (
        <CardBody className="summary-card-body">
          <div className="summary-version-info">
            <Text className="summary-version-range">
              {selectedItem.sourceType === 'wp' ? (
                <>
                  Includes {selectedItem.releaseCount} Gutenberg releases, from{' '}
                  {selectedItem.gbVersionRange?.split('-')[0]} to {selectedItem.gbVersionRange?.split('-')[1]}.{' '}
                </>
              ) : (
                <>
                  Released {formatDate(selectedItem.date!)}
                  {selectedItem.wpVersion
                    ? <> &middot; Included in WordPress {selectedItem.wpVersion}</>
                    : <> &middot; Not yet in WordPress</>
                  }
                </>
              )}
              {isCurrentOrLatest && (
                <span className="summary-version-current">
                  ({selectedItem.sourceType === 'wp' ? 'current cycle' : 'latest'})
                </span>
              )}
            </Text>
          </div>

          <div className="summary-content">
            {categoryConfig && (
              <CategoryPieChart
                categoryTotals={categoryTotals}
                categoryConfig={categoryConfig}
                size={200}
                releaseCount={selectedItem.releaseCount}
                visibleCategories={visibleCategories}
                onCategoryToggle={onCategoryToggle}
              />
            )}

            <div className="summary-stats-container">
              {selectedItem.sourceType === 'wp' && (
                <div className="summary-stats-header">Averages per Gutenberg release</div>
              )}
              <div className="summary-stats">
                {primaryStats.map((stat) => renderStatItem(stat, true))}
              </div>

              {secondaryStats.length > 0 && (
                <>
                  <div className="summary-stats-header">Totals</div>
                  <div className="summary-stats summary-stats-totals">
                    {secondaryStats.map((stat) => renderStatItem(stat, false))}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
