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
import type { Summary, WPVersionStats } from '../data/types';
import { loadCategoryConfig, type CategoryConfig } from '../utils/categories';
import { CategoryPieChart } from './CategoryPieChart';
import { useURLState } from '../hooks/useURLState';

interface SummaryStatsProps {
  summary: Summary;
  wpVersionStats: WPVersionStats[];
  /** Currently visible category IDs (for clickable legend) */
  visibleCategories?: string[];
  /** Callback when a category is toggled via legend click */
  onCategoryToggle?: (categoryId: string, isVisible: boolean) => void;
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

function parseVersionRange(range: string): { start: string; end: string } {
  const [start, end] = range.split('-');
  return { start, end };
}

export function SummaryStats({
  summary,
  wpVersionStats,
  visibleCategories,
  onCategoryToggle,
}: SummaryStatsProps) {
  const validVersions = useMemo(
    () => wpVersionStats.map((s) => s.wpVersion),
    [wpVersionStats]
  );
  const [selectedVersion, setSelectedVersion] = useURLState(
    'wp',
    summary.currentWPCycle,
    validVersions
  );
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  // Load category config on mount
  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  const selectedStats = wpVersionStats.find(
    (stats) => stats.wpVersion === selectedVersion
  );
  const isCurrentCycle = selectedVersion === summary.currentWPCycle;

  // Check if data is available (0 means no data for these categories in older releases)
  const hasContributorData = selectedStats ? selectedStats.totalContributors > 0 : false;

  // Use pre-calculated averages from aggregated data
  const avgContributors = selectedStats?.avgContributorsPerRelease ?? 0;
  const avgNewContributors = selectedStats?.avgNewContributorsPerRelease ?? 0;

  // Map category IDs to Summary field name suffixes
  // Summary type uses abbreviated names that don't always match category IDs
  const categoryToSummaryField: Record<string, string> = {
    features: 'Features',
    bugs: 'Bugs',
    codeQuality: 'CodeQuality',
    a11y: 'A11y',
    performance: 'Perf',
  };

  // Generate category stats dynamically from config
  const categoryStats = useMemo(() => {
    if (!categoryConfig || !selectedStats) return { avg: [], total: [] };

    // Only show categories that are marked as includeByDefault
    const defaultCategories = categoryConfig.aggregations.filter((agg) => agg.includeByDefault);

    const avgItems: StatItem[] = defaultCategories.map((agg) => {
      const total = selectedStats.categoryTotals?.[agg.id] || 0;
      const value = total > 0 ? Math.round(total / selectedStats.releaseCount) : 0;
      const hasData = total > 0;
      const summaryFieldSuffix = categoryToSummaryField[agg.id];
      const summaryTotal = summaryFieldSuffix
        ? (summary[`avg${summaryFieldSuffix}Total` as keyof Summary] as number | undefined)
        : undefined;
      return {
        label: agg.label,
        value,
        total: summaryTotal,
        unavailable: !hasData,
      };
    });

    const totalItems: StatItem[] = defaultCategories.map((agg) => {
      const value = selectedStats.categoryTotals?.[agg.id] || 0;
      const hasData = value > 0;
      return {
        label: agg.label,
        value,
        unavailable: !hasData,
      };
    });

    return { avg: avgItems, total: totalItems };
  }, [categoryConfig, selectedStats, summary]);

  const avgStats: StatItem[] = selectedStats
    ? [
        {
          label: 'All PRs',
          value: selectedStats.avgPRsPerRelease,
          total: summary.avgPRsTotal,
        },
        ...categoryStats.avg,
        {
          label: 'Contributors',
          value: avgContributors,
          total: summary.avgContributorsTotal,
          unavailable: !hasContributorData,
        },
        {
          label: 'New Contributors',
          value: avgNewContributors,
          total: summary.avgNewContributorsTotal,
          unavailable: !hasContributorData,
        },
      ]
    : [];

  const totalStats: StatItem[] = selectedStats
    ? [
        { label: 'All PRs', value: selectedStats.totalPRs },
        ...categoryStats.total,
        { label: 'Contributors', value: selectedStats.totalContributors, unavailable: !hasContributorData },
        { label: 'New Contributors', value: selectedStats.totalNewContributors, unavailable: !hasContributorData },
      ]
    : [];

  const versionOptions = wpVersionStats.map((stats) => ({
    label: `WordPress ${stats.wpVersion}`,
    value: stats.wpVersion,
  }));

  // Navigation helpers (versions are sorted newest to oldest)
  const currentIndex = wpVersionStats.findIndex((s) => s.wpVersion === selectedVersion);
  const hasPrevious = currentIndex < wpVersionStats.length - 1;
  const hasNext = currentIndex > 0;

  const goToPrevious = useCallback(() => {
    if (hasPrevious) {
      setSelectedVersion(wpVersionStats[currentIndex + 1].wpVersion);
    }
  }, [currentIndex, hasPrevious, wpVersionStats]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setSelectedVersion(wpVersionStats[currentIndex - 1].wpVersion);
    }
  }, [currentIndex, hasNext, wpVersionStats]);

  // Build the header text based on whether it's current or past cycle
  const versionRange = selectedStats
    ? parseVersionRange(selectedStats.gbVersionRange)
    : null;

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
            label="Previous WordPress version"
          />
          <SelectControl
            __nextHasNoMarginBottom
            label="WordPress Version"
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
            label="Next WordPress version"
          />
        </div>
      </CardHeader>

      {selectedStats && (
        <CardBody className="summary-card-body">
          <div className="summary-version-info">
            <Text className="summary-version-range">
              Includes {selectedStats.releaseCount} Gutenberg releases, from {versionRange?.start} to {versionRange?.end}.{' '}
              {isCurrentCycle && <span className="summary-version-current">(current cycle)</span>}
            </Text>
          </div>

          <div className="summary-content">
            {categoryConfig && selectedStats.categoryTotals && (
              <CategoryPieChart
                categoryTotals={selectedStats.categoryTotals}
                categoryConfig={categoryConfig}
                size={200}
                releaseCount={selectedStats.releaseCount}
                visibleCategories={visibleCategories}
                onCategoryToggle={onCategoryToggle}
              />
            )}

            <div className="summary-stats-container">
              <div className="summary-stats">
                <div className="summary-stats-header">Averages per Gutenberg release</div>
                {avgStats.map((stat) => {
                  const diff = stat.unavailable ? '' : formatDiff(stat.value, stat.total ?? 0);
                  const diffClass = stat.unavailable ? 'neutral' : getDiffClass(stat.value, stat.total ?? 0);
                  return (
                    <div key={stat.label} className="summary-stat">
                      <div className="summary-stat-label">{stat.label}</div>
                      <div className={`summary-stat-value${stat.unavailable ? ' unavailable' : ''}`}>
                        {stat.unavailable ? 'N/A' : stat.value.toLocaleString()}
                      </div>
                      {!stat.unavailable && stat.total !== undefined && (
                        <div className="summary-stat-comparison">
                          (vs {stat.total}
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
                })}
              </div>

              <div className="summary-stats summary-stats-totals">
                <div className="summary-stats-header">Totals</div>
                {totalStats.map((stat) => (
                  <div key={stat.label} className="summary-stat">
                    <div className="summary-stat-label">{stat.label}</div>
                    <div className={`summary-stat-value${stat.unavailable ? ' unavailable' : ''}`}>
                      {stat.unavailable ? 'N/A' : stat.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </CardBody>
      )}

    </Card>
  );
}
