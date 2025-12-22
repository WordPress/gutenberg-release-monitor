import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  SelectControl,
  __experimentalText as Text,
} from '@wordpress/components';
import { chevronLeft, chevronRight, previous, next } from '@wordpress/icons';
import type { NormalizedRelease, SourceSummary } from '../data/normalized';
import { loadCategoryConfig, aggregateCategories, type CategoryConfig } from '../utils/categories';
import { CategoryPieChart } from './CategoryPieChart';
import { useURLState } from '../hooks/useURLState';
import { useConfig } from '../config';
import type { TabConfig } from '../config/types';

interface SummaryStatsProps {
  /** Normalized release data */
  data: NormalizedRelease[];
  /** Summary statistics */
  summary: SourceSummary;
  /** Tab configuration for labels and field mapping */
  tabConfig?: TabConfig;
  /** Currently visible category IDs (for clickable legend) */
  visibleCategories?: string[];
  /** Callback when a category is toggled via legend click */
  onCategoryToggle?: (categoryId: string, isVisible: boolean) => void;
  /** Current view mode (to sync breakdown selection when sponsors/countries) */
  viewMode?: 'averages' | 'totals' | 'distribution' | 'sponsors' | 'countries';
  /** Current metric type */
  metric?: 'prs' | 'contributors';
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
  const { summary, tabConfig, visibleCategories, onCategoryToggle, data } = props;
  const config = useConfig();

  // Use tabConfig for all display logic (no domain knowledge)
  const isAggregated = tabConfig?.isAggregated ?? false;
  const projectLabel = config.project.projectLabel;
  const versionLabel = tabConfig?.title ?? `${projectLabel} Version`;
  const versionNavLabel = tabConfig?.title?.replace('By ', '') ?? `${projectLabel} release`;
  const childItemLabel = tabConfig?.labels?.childItem ?? `${projectLabel} release`;

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  // Load category config on mount
  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Data comes pre-normalized from App - no transformation needed here

  // Compute valid versions and default for URL state
  const validVersions = useMemo(
    () => data.map((item) => item.version),
    [data]
  );

  const defaultVersion = useMemo(() => {
    // Use config to determine default: either from summary field or first item
    const summaryField = tabConfig?.defaultItemSummaryField;
    if (summaryField && summary[summaryField as keyof SourceSummary]) {
      return summary[summaryField as keyof SourceSummary] as string;
    }
    return data[0]?.version || '';
  }, [tabConfig?.defaultItemSummaryField, summary, data]);

  const [selectedVersion, setSelectedVersion] = useURLState(
    tabConfig?.urlParamKey ?? 'v',
    defaultVersion,
    validVersions
  );

  // Find selected item from normalized data (fallback to first item to prevent unmounting)
  const selectedItem = useMemo(
    () => data.find((item) => item.version === selectedVersion) ?? data[0],
    [data, selectedVersion]
  );

  // Compute category totals (use pre-computed for aggregated, aggregate for individual items)
  const categoryTotals = useMemo(() => {
    if (!selectedItem || !categoryConfig) return {};
    if (selectedItem.isAggregated) {
      return selectedItem.categoryTotals ?? {};
    }
    // Individual items: aggregate raw categories
    return aggregateCategories(selectedItem.rawCategories ?? {}, categoryConfig);
  }, [selectedItem, categoryConfig]);

  // Get sponsor and country breakdown data
  const sponsorData = useMemo(() => {
    return selectedItem?.contributorAggregates?.sponsorBreakdown ?? {};
  }, [selectedItem]);

  const countryData = useMemo(() => {
    return selectedItem?.contributorAggregates?.countryBreakdown ?? {};
  }, [selectedItem]);

  // Build stat items based on selected item
  const { primaryStats, secondaryStats } = useMemo(() => {
    if (!selectedItem || !categoryConfig) {
      return { primaryStats: [], secondaryStats: [] };
    }

    const defaultCategories = categoryConfig.aggregations.filter((agg) => agg.includeByDefault);

    // Category stat items with comparison to global average
    const buildCategoryStats = (useAverage: boolean): StatItem[] => {
      return defaultCategories.map((agg) => {
        const total = categoryTotals[agg.id] || 0;
        const value = useAverage && selectedItem.groupedCount
          ? Math.round(total / selectedItem.groupedCount)
          : total;
        const hasData = total > 0;
        const summaryFieldSuffix = agg.labels.short;
        const summaryTotal = summaryFieldSuffix
          ? (summary[`avg${summaryFieldSuffix}Total` as keyof SourceSummary] as number | undefined)
          : undefined;
        return {
          label: agg.labels.full,
          value,
          total: useAverage ? summaryTotal : undefined,
          unavailable: !hasData,
        };
      });
    };

    if (isAggregated) {
      // Aggregated: Primary = averages per child item, Secondary = totals
      const avgCategoryStats = buildCategoryStats(true);
      const totalCategoryStats = buildCategoryStats(false);

      const primary: StatItem[] = [
        { label: 'All PRs', value: selectedItem.avgPRs, total: summary.avgPRsTotal },
        ...avgCategoryStats,
        { label: 'Contributors', value: selectedItem.avgContributors, total: summary.avgContributorsTotal, unavailable: !selectedItem.hasContributorData },
        { label: 'New Contributors', value: selectedItem.avgNewContributors, total: summary.avgNewContributorsTotal, unavailable: !selectedItem.hasContributorData },
      ];

      const secondary: StatItem[] = [
        { label: 'All PRs', value: selectedItem.totalPRs },
        ...totalCategoryStats,
        { label: 'Contributors', value: selectedItem.contributors, unavailable: !selectedItem.hasContributorData },
        { label: 'New Contributors', value: selectedItem.newContributors, unavailable: !selectedItem.hasContributorData },
      ];

      return { primaryStats: primary, secondaryStats: secondary };
    }

    // Individual items: Single column with comparison to averages
    const categoryStats = buildCategoryStats(false);
    const primary: StatItem[] = [
      { label: 'All PRs', value: selectedItem.totalPRs, total: summary.avgPRsTotal },
      ...categoryStats,
      { label: 'Contributors', value: selectedItem.contributors, total: summary.avgContributorsTotal, unavailable: !selectedItem.hasContributorData },
      { label: 'New Contributors', value: selectedItem.newContributors, total: summary.avgNewContributorsTotal, unavailable: !selectedItem.hasContributorData },
    ];

    return { primaryStats: primary, secondaryStats: [] };
  }, [selectedItem, categoryConfig, categoryTotals, summary, isAggregated]);

  // Build version options for dropdown
  const versionOptions = useMemo(
    () => data.map((item) => ({ label: item.displayLabel, value: item.version })),
    [data]
  );

  // Navigation helpers
  const currentIndex = data.findIndex((item) => item.version === selectedVersion);
  const hasPrevious = currentIndex < data.length - 1;
  const hasNext = currentIndex > 0;

  const goToPrevious = useCallback(() => {
    if (hasPrevious) {
      setSelectedVersion(data[currentIndex + 1].version);
    }
  }, [currentIndex, hasPrevious, data, setSelectedVersion]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setSelectedVersion(data[currentIndex - 1].version);
    }
  }, [currentIndex, hasNext, data, setSelectedVersion]);

  const goToFirst = useCallback(() => {
    setSelectedVersion(data[data.length - 1].version);
  }, [data, setSelectedVersion]);

  const goToLast = useCallback(() => {
    setSelectedVersion(data[0].version);
  }, [data, setSelectedVersion]);

  // Derived display values
  const isCurrentOrLatest = useMemo(() => {
    const summaryField = tabConfig?.defaultItemSummaryField;
    if (summaryField && summary[summaryField as keyof SourceSummary]) {
      return selectedVersion === summary[summaryField as keyof SourceSummary];
    }
    return selectedVersion === data[0]?.version;
  }, [tabConfig?.defaultItemSummaryField, summary, selectedVersion, data]);

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
            (vs avg {Math.round(stat.total)}
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
            icon={previous}
            onClick={goToFirst}
            disabled={!hasPrevious}
            label={`First ${versionNavLabel}`}
          />
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
            label={versionLabel}
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
          <Button
            variant="secondary"
            size="small"
            icon={next}
            onClick={goToLast}
            disabled={!hasNext}
            label={`Last ${versionNavLabel}`}
          />
        </div>
      </CardHeader>

      {selectedItem && (
        <CardBody className="summary-card-body">
          <div className="summary-version-info">
            <Text className="summary-version-range">
              {isAggregated ? (
                <>
                  Includes {selectedItem.groupedCount} {childItemLabel}s
                  {selectedItem.groupedRange && (
                    <>, from {selectedItem.groupedRange.split('-')[0]} to {selectedItem.groupedRange.split('-')[1]}</>
                  )}.{' '}
                </>
              ) : (
                <>
                  Released {formatDate(selectedItem.date!)}
                  {tabConfig?.labels?.itemContext && selectedItem.memberOf && (
                    <> &middot; {tabConfig.labels.itemContext.replace('{version}', selectedItem.memberOf)}</>
                  )}
                </>
              )}
              {isCurrentOrLatest && (
                <span className="summary-version-current">
                  ({isAggregated ? 'current cycle' : 'latest'})
                </span>
              )}
            </Text>
          </div>

          <div className="summary-content">
            <div className="summary-pie-charts">
              {categoryConfig && (
                <>
                  <div className="summary-pie-chart-item">
                    <Text className="summary-pie-chart-title">Categories</Text>
                    <CategoryPieChart
                      breakdownType="categories"
                      categoryTotals={categoryTotals}
                      categoryConfig={categoryConfig}
                      size={200}
                      groupedCount={selectedItem.groupedCount}
                      visibleCategories={visibleCategories}
                      onCategoryToggle={onCategoryToggle}
                    />
                  </div>
                  <div className="summary-pie-chart-item">
                    <Text className="summary-pie-chart-title">Sponsors</Text>
                    <CategoryPieChart
                      breakdownType="sponsors"
                      breakdownData={sponsorData}
                      categoryTotals={categoryTotals}
                      categoryConfig={categoryConfig}
                      size={200}
                      groupedCount={selectedItem.groupedCount}
                    />
                  </div>
                  <div className="summary-pie-chart-item">
                    <Text className="summary-pie-chart-title">Countries</Text>
                    <CategoryPieChart
                      breakdownType="countries"
                      breakdownData={countryData}
                      categoryTotals={categoryTotals}
                      categoryConfig={categoryConfig}
                      size={200}
                      groupedCount={selectedItem.groupedCount}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="summary-stats-container">
              {tabConfig?.labels?.statsHeader && (
                <div className="summary-stats-header">{tabConfig.labels.statsHeader}</div>
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
