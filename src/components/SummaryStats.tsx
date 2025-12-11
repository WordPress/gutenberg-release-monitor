import { useState, useEffect, useCallback } from 'react';
import { Button } from '@wordpress/components';
import type { Summary, WPVersionStats } from '../data/types';

interface SummaryStatsProps {
  summary: Summary;
  wpVersionStats: WPVersionStats[];
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

function getInitialVersion(wpVersionStats: WPVersionStats[], defaultVersion: string): string {
  const params = new URLSearchParams(window.location.search);
  const wpParam = params.get('wp');
  if (wpParam && wpVersionStats.some((s) => s.wpVersion === wpParam)) {
    return wpParam;
  }
  return defaultVersion;
}

export function SummaryStats({ summary, wpVersionStats }: SummaryStatsProps) {
  const [selectedVersion, setSelectedVersion] = useState(() =>
    getInitialVersion(wpVersionStats, summary.currentWPCycle)
  );

  // Update URL when version changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedVersion === summary.currentWPCycle) {
      params.delete('wp');
    } else {
      params.set('wp', selectedVersion);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [selectedVersion, summary.currentWPCycle]);

  const selectedStats = wpVersionStats.find(
    (stats) => stats.wpVersion === selectedVersion
  );
  const isCurrentCycle = selectedVersion === summary.currentWPCycle;

  // Check if data is available (0 means no data for these categories in older releases)
  const hasContributorData = selectedStats ? selectedStats.totalContributors > 0 : false;
  const hasA11yData = selectedStats ? selectedStats.totalA11yPRs > 0 : false;

  // Calculate averages from the selected version's totals
  const avgA11y = selectedStats && hasA11yData
    ? Math.round(selectedStats.totalA11yPRs / selectedStats.releaseCount)
    : 0;
  const avgPerf = selectedStats
    ? Math.round(selectedStats.totalPerformancePRs / selectedStats.releaseCount)
    : 0;
  const avgContributors = selectedStats && hasContributorData
    ? Math.round(selectedStats.totalContributors / selectedStats.releaseCount)
    : 0;
  const avgNewContributors = selectedStats && hasContributorData
    ? Math.round(selectedStats.totalNewContributors / selectedStats.releaseCount)
    : 0;

  const avgStats: StatItem[] = selectedStats
    ? [
        {
          label: 'PRs',
          value: selectedStats.avgPRsPerRelease,
          total: summary.avgPRsTotal,
        },
        {
          label: 'Features',
          value: selectedStats.avgFeaturePRsPerRelease,
          total: summary.avgFeaturesTotal,
        },
        {
          label: 'Bug Fixes',
          value: selectedStats.avgBugPRsPerRelease,
          total: summary.avgBugsTotal,
        },
        {
          label: 'Accessibility',
          value: avgA11y,
          total: summary.avgA11yTotal,
          unavailable: !hasA11yData,
        },
        {
          label: 'Performance',
          value: avgPerf,
          total: summary.avgPerfTotal,
        },
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
        { label: 'PRs', value: selectedStats.totalPRs },
        { label: 'Features', value: selectedStats.totalFeaturePRs },
        { label: 'Bug Fixes', value: selectedStats.totalBugPRs },
        { label: 'Accessibility', value: selectedStats.totalA11yPRs, unavailable: !hasA11yData },
        { label: 'Performance', value: selectedStats.totalPerformancePRs },
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

  const getReleaseRangeText = () => {
    if (!selectedStats || !versionRange) return '';

    if (isCurrentCycle) {
      return `${selectedStats.releaseCount} releases since ${versionRange.start}, included`;
    }

    return `${selectedStats.releaseCount} releases between ${versionRange.start} and ${versionRange.end}, included`;
  };

  return (
    <div className="summary-section">
      <div className="summary-disclaimer">
        Data is an estimation based on parsing release changelogs.
      </div>

      <div className="summary-version-selector">
        <label htmlFor="wp-version-select" className="summary-version-label">
          WordPress Version
        </label>
        <div className="summary-version-nav">
          <Button
            variant="secondary"
            size="small"
            onClick={goToPrevious}
            disabled={!hasPrevious}
            aria-label="Previous WordPress version"
          >
            «
          </Button>
          <select
            id="wp-version-select"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="summary-version-select"
          >
            {versionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="small"
            onClick={goToNext}
            disabled={!hasNext}
            aria-label="Next WordPress version"
          >
            »
          </Button>
        </div>
      </div>

      {selectedStats && (
        <>
          <div className="summary-version-info">
            <div className="summary-version-title">
              WordPress {selectedVersion}
              {isCurrentCycle && <span className="summary-version-current">(current)</span>}
            </div>
            <div className="summary-version-range">{getReleaseRangeText()}</div>
          </div>

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
                  {!stat.unavailable && (
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
            <div className="summary-stats-header">Totals in all Gutenberg releases</div>
            {totalStats.map((stat) => (
              <div key={stat.label} className="summary-stat">
                <div className="summary-stat-label">{stat.label}</div>
                <div className={`summary-stat-value${stat.unavailable ? ' unavailable' : ''}`}>
                  {stat.unavailable ? 'N/A' : stat.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="summary-meta">
        <span>
          {summary.totalReleases} releases: {summary.oldestRelease} – {summary.latestRelease}
        </span>
        <span>
          Last updated:{' '}
          {new Date(summary.lastUpdated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
}
