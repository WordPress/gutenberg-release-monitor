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
import type { Release, Summary } from '../data/types';
import { loadCategoryConfig, aggregateCategories, type CategoryConfig } from '../utils/categories';
import { CategoryPieChart } from './CategoryPieChart';

interface GBReleaseSummaryStatsProps {
  releases: Release[];
  summary: Summary;
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

function getInitialVersion(releases: Release[], defaultVersion: string): string {
  const params = new URLSearchParams(window.location.search);
  const gbParam = params.get('gb');
  if (gbParam && releases.some((r) => r.gbVersion === gbParam)) {
    return gbParam;
  }
  return defaultVersion;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function GBReleaseSummaryStats({ releases, summary }: GBReleaseSummaryStatsProps) {
  // Releases are sorted newest to oldest
  const latestRelease = releases[0]?.gbVersion || '';
  const [selectedVersion, setSelectedVersion] = useState(() =>
    getInitialVersion(releases, latestRelease)
  );
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  // Load category config on mount
  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Update URL when version changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedVersion === latestRelease) {
      params.delete('gb');
    } else {
      params.set('gb', selectedVersion);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [selectedVersion, latestRelease]);

  const selectedRelease = releases.find((r) => r.gbVersion === selectedVersion);
  const isLatest = selectedVersion === latestRelease;

  // Check if contributor data is available
  const hasContributorData = selectedRelease ? selectedRelease.contributors > 0 : false;

  // Map category IDs to Summary field name suffixes
  const categoryToSummaryField: Record<string, string> = {
    features: 'Features',
    bugs: 'Bugs',
    codeQuality: 'CodeQuality',
    a11y: 'A11y',
    performance: 'Perf',
  };

  // Aggregate raw categories to config IDs
  const categoryTotals = useMemo(() => {
    if (!categoryConfig || !selectedRelease) return {};
    return aggregateCategories(selectedRelease.categories, categoryConfig);
  }, [categoryConfig, selectedRelease]);

  // Generate category stats dynamically from config
  const categoryStats = useMemo(() => {
    if (!categoryConfig || !selectedRelease) return { items: [] };

    // Only show categories that are marked as includeByDefault
    const defaultCategories = categoryConfig.aggregations.filter((agg) => agg.includeByDefault);

    const items: StatItem[] = defaultCategories.map((agg) => {
      const value = categoryTotals[agg.id] || 0;
      const hasData = value > 0;
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

    return { items };
  }, [categoryConfig, selectedRelease, categoryTotals, summary]);

  const stats: StatItem[] = selectedRelease
    ? [
        {
          label: 'All PRs',
          value: selectedRelease.totalPRs,
          total: summary.avgPRsTotal,
        },
        ...categoryStats.items,
        {
          label: 'Contributors',
          value: selectedRelease.contributors,
          total: summary.avgContributorsTotal,
          unavailable: !hasContributorData,
        },
        {
          label: 'New Contributors',
          value: selectedRelease.newContributors,
          total: summary.avgNewContributorsTotal,
          unavailable: !hasContributorData,
        },
      ]
    : [];

  const versionOptions = releases.map((release) => ({
    label: `Gutenberg ${release.gbVersion}`,
    value: release.gbVersion,
  }));

  // Navigation helpers (releases are sorted newest to oldest)
  const currentIndex = releases.findIndex((r) => r.gbVersion === selectedVersion);
  const hasPrevious = currentIndex < releases.length - 1;
  const hasNext = currentIndex > 0;

  const goToPrevious = useCallback(() => {
    if (hasPrevious) {
      setSelectedVersion(releases[currentIndex + 1].gbVersion);
    }
  }, [currentIndex, hasPrevious, releases]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setSelectedVersion(releases[currentIndex - 1].gbVersion);
    }
  }, [currentIndex, hasNext, releases]);

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
            label="Previous Gutenberg release"
          />
          <SelectControl
            __nextHasNoMarginBottom
            label="Gutenberg Version"
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
            label="Next Gutenberg release"
          />
        </div>
      </CardHeader>

      {selectedRelease && (
        <CardBody className="summary-card-body">
          <div className="summary-version-info">
            <Text className="summary-version-range">
              Released {formatDate(selectedRelease.date)}
              {selectedRelease.wpVersion && (
                <> &middot; Included in WordPress {selectedRelease.wpVersion}</>
              )}
              {!selectedRelease.wpVersion && <> &middot; Not yet in WordPress</>}
              {isLatest && <span className="summary-version-current">(latest)</span>}
            </Text>
          </div>

          <div className="summary-content">
            {categoryConfig && Object.keys(categoryTotals).length > 0 && (
              <CategoryPieChart
                categoryTotals={categoryTotals}
                categoryConfig={categoryConfig}
                size={200}
              />
            )}

            <div className="summary-stats-container">
              <div className="summary-stats">
                {stats.map((stat) => {
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
                })}
              </div>
            </div>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
