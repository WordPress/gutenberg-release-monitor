import { useState, useEffect, useCallback } from 'react';
import '@wordpress/components/build-style/style.css';
import {
  Button,
  Card,
  CardBody,
  ExternalLink,
  Notice,
  RangeControl,
  Spinner,
  TabPanel,
  __experimentalText as Text,
  __experimentalHeading as Heading,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { useReleases, useSummary, useWPVersionStats } from './hooks/useReleases';
import { useTimeSeries } from './hooks/useTimeSeries';
import { useDarkMode } from './hooks/useDarkMode';
import { useURLState } from './hooks/useURLState';
import { SummaryStats } from './components/SummaryStats';
import { DataTable } from './components/DataTable';
import { TrendChart } from './components/TrendChart';
import { getDefaultCategoryIds } from './components/CategoryFilter';

export type ViewMode = 'averages' | 'totals' | 'distribution' | 'sponsors' | 'countries';
export type ChartType = 'line' | 'bar' | 'area' | 'stacked';
export type MetricType = 'prs' | 'contributors';

const VIEW_MODES: ViewMode[] = ['averages', 'totals', 'distribution', 'sponsors', 'countries'];
const CHART_TYPES: ChartType[] = ['line', 'bar', 'area', 'stacked'];
const METRIC_TYPES: MetricType[] = ['prs', 'contributors'];
const TABS = ['by-wp-version', 'by-gb-release'] as const;
type TabName = typeof TABS[number];

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

function App() {
  const [activeTabStr, setActiveTab] = useURLState('tab', 'by-wp-version', [...TABS]);
  const [viewModeStr, setViewMode] = useURLState('view', 'averages', VIEW_MODES);
  const [chartTypeStr, setChartType] = useURLState('chart', 'stacked', CHART_TYPES);
  const [metricStr, setMetric] = useURLState('metric', 'prs', METRIC_TYPES);
  const activeTab = activeTabStr as TabName;
  const viewMode = viewModeStr as ViewMode;
  const chartType = chartTypeStr as ChartType;
  const metric = metricStr as MetricType;

  // Category filter state (synced with URL)
  const [visibleCategories, setVisibleCategories] = useState<string[]>([]);
  const [defaultCategoryIds, setDefaultCategoryIds] = useState<string[]>([]);

  // Release count for trend chart (GB release tab, synced with URL)
  const [releaseCount, setReleaseCount] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCount = params.get('releases');
    if (urlCount) {
      const parsed = parseInt(urlCount, 10);
      if (!isNaN(parsed) && parsed >= 10) return parsed;
    }
    return 50; // default
  });

  // Sync releaseCount to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (releaseCount === 50) {
      params.delete('releases');
    } else {
      params.set('releases', String(releaseCount));
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [releaseCount]);

  // Initialize visible categories from URL or defaults
  useEffect(() => {
    getDefaultCategoryIds().then((ids) => {
      setDefaultCategoryIds(ids);
      // Check URL for saved categories
      const params = new URLSearchParams(window.location.search);
      const urlCategories = params.get('categories');
      if (urlCategories) {
        const parsedCategories = urlCategories.split(',').filter((c) => ids.includes(c));
        if (parsedCategories.length > 0) {
          setVisibleCategories(parsedCategories);
          return;
        }
      }
      setVisibleCategories(ids);
    });
  }, []);

  // Handle category toggle from clickable legends
  const handleCategoryToggle = useCallback(
    (categoryId: string, isVisible: boolean) => {
      setVisibleCategories((prev) => {
        let newCategories: string[];
        if (isVisible) {
          // Add category if not already present
          newCategories = prev.includes(categoryId) ? prev : [...prev, categoryId];
        } else {
          // Remove category, but don't allow unchecking the last one
          if (prev.length <= 1) return prev;
          newCategories = prev.filter((id) => id !== categoryId);
        }

        // Sync to URL
        const params = new URLSearchParams(window.location.search);
        if (newCategories.length === defaultCategoryIds.length) {
          params.delete('categories');
        } else {
          params.set('categories', newCategories.join(','));
        }
        const newUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        return newCategories;
      });
    },
    [defaultCategoryIds]
  );
  const {
    data: releases,
    isLoading: releasesLoading,
    error: releasesError,
  } = useReleases();
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useSummary();
  const {
    data: wpVersionStats,
    isLoading: wpVersionStatsLoading,
    error: wpVersionStatsError,
  } = useWPVersionStats();
  const {
    data: timeSeries,
    isLoading: timeSeriesLoading,
    error: timeSeriesError,
  } = useTimeSeries();
  const { isDark, toggle } = useDarkMode();

  const isLoading = releasesLoading || summaryLoading || wpVersionStatsLoading || timeSeriesLoading;
  const error = releasesError || summaryError || wpVersionStatsError || timeSeriesError;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <Heading level={1}>Gutenberg Release Monitor</Heading>
          <Button
            variant="tertiary"
            onClick={toggle}
            label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            icon={isDark ? SunIcon : MoonIcon}
          />
        </div>
        <Text>
          Track{' '}
          <ExternalLink href="https://github.com/WordPress/gutenberg">
            Gutenberg
          </ExternalLink>{' '}
          release statistics and changelog data.
        </Text>
        <Text className="app-disclaimer">
          This data is an approximation based on parsing Gutenberg release changelogs, and doesn't include cherry-picks to WordPress release branches after the Beta1 cutoff.{' '}
          <ExternalLink href="https://developer.wordpress.org/block-editor/contributors/versions-in-wordpress/">
            Learn more
          </ExternalLink>
        </Text>
      </header>

      {error && (
        <Notice status="error" isDismissible={false}>
          Failed to load data: {error.message}
        </Notice>
      )}

      {isLoading && (
        <div className="app-loading">
          <Spinner />
          <span>Loading releases...</span>
        </div>
      )}

      {!isLoading && !error && summary && wpVersionStats && releases && timeSeries && (
        <>
          <main className="app-main">
            <TabPanel
              className="app-tabs"
              tabs={[
                { name: 'by-wp-version', title: 'By WP Version' },
                { name: 'by-gb-release', title: 'By GB Release' },
              ]}
              initialTabName={activeTab}
              onSelect={(tabName) => setActiveTab(tabName as TabName)}
            >
              {() => {
                const isWPTab = activeTab === 'by-wp-version';
                const isContributorMetric = metric === 'contributors';
                // Adjust viewMode when switching metrics or tabs
                let effectiveViewMode = viewMode;
                // GB Release tab doesn't have totals mode
                if (!isWPTab && viewMode === 'totals') {
                  effectiveViewMode = 'averages';
                }
                // Contributor mode doesn't have category distribution, PR mode doesn't have sponsors/countries
                if (isContributorMetric && viewMode === 'distribution') {
                  effectiveViewMode = 'sponsors';
                } else if (!isContributorMetric && (viewMode === 'sponsors' || viewMode === 'countries')) {
                  effectiveViewMode = 'distribution';
                }

                // Compute props objects to avoid conditional JSX rendering
                // This keeps components mounted and animating on data changes
                const summaryProps = isWPTab
                  ? { dataSource: 'wp-version' as const, data: wpVersionStats }
                  : { dataSource: 'gb-release' as const, data: releases };

                // For GB release tab, use releases data for contributors (has contributor counts)
                // and timeSeries for PRs (optimized for chart)
                const gbChartData = metric === 'contributors' ? releases : timeSeries;
                const totalReleases = releases?.length || 0;
                const trendChartProps = isWPTab
                  ? { dataSource: 'wp-version' as const, data: wpVersionStats, metric }
                  : { dataSource: 'gb-release' as const, data: gbChartData, releaseCount, metric };

                const dataTableProps = isWPTab
                  ? { dataSource: 'wp-version' as const, data: wpVersionStats, viewMode, metric }
                  : { dataSource: 'gb-release' as const, data: releases, viewMode: effectiveViewMode, metric };

                return (
                  <div className="tab-content">
                    {/* Summary section - single instance, props switch */}
                    <section id="version-summary">
                      <SummaryStats
                        {...summaryProps}
                        summary={summary}
                        visibleCategories={visibleCategories}
                        onCategoryToggle={handleCategoryToggle}
                        viewMode={effectiveViewMode}
                        metric={metric}
                      />
                    </section>

                    {/* Metric and view mode toggles */}
                    <div className="view-controls">
                      <div className="metric-toggle">
                        <ToggleGroupControl
                          __nextHasNoMarginBottom
                          isBlock
                          label="Metric"
                          hideLabelFromVision
                          value={metric}
                          onChange={(value) => setMetric(value as MetricType)}
                        >
                          <ToggleGroupControlOption value="prs" label="PRs" />
                          <ToggleGroupControlOption value="contributors" label="Contributors" />
                        </ToggleGroupControl>
                      </div>
                      <div className="view-mode-toggle">
                        <ToggleGroupControl
                          __nextHasNoMarginBottom
                          isBlock
                          label="View mode"
                          hideLabelFromVision
                          value={isWPTab ? viewMode : effectiveViewMode}
                          onChange={(value) => setViewMode(value as ViewMode)}
                        >
                          <ToggleGroupControlOption value="averages" label={isWPTab ? 'Per GB Release' : (metric === 'prs' ? 'PRs' : 'Contributors')} />
                          {isWPTab && <ToggleGroupControlOption value="totals" label="Totals" />}
                          {metric === 'prs' ? (
                            <ToggleGroupControlOption value="distribution" label="Distribution" />
                          ) : (
                            <>
                              <ToggleGroupControlOption value="sponsors" label="Sponsors" />
                              <ToggleGroupControlOption value="countries" label="Countries" />
                            </>
                          )}
                        </ToggleGroupControl>
                      </div>
                    </div>

                    {/* Chart - single instance, props switch */}
                    <Card id="trend-chart" className="trend-chart-card">
                      <CardBody>
                        <div className="chart-controls">
                          <div className="chart-type-toggle">
                            <ToggleGroupControl
                              __nextHasNoMarginBottom
                              label="Chart type"
                              hideLabelFromVision
                              value={chartType}
                              onChange={(value) => setChartType(value as ChartType)}
                            >
                              <ToggleGroupControlOption value="stacked" label="Stacked" />
                              <ToggleGroupControlOption value="area" label="Area" />
                              <ToggleGroupControlOption value="line" label="Line" />
                              <ToggleGroupControlOption value="bar" label="Bar" />
                            </ToggleGroupControl>
                          </div>
                          {!isWPTab && totalReleases > 10 && (
                            <div className="release-count-control">
                              <RangeControl
                                __nextHasNoMarginBottom
                                label="Releases shown"
                                value={releaseCount}
                                onChange={(value) => setReleaseCount(value ?? 50)}
                                min={10}
                                max={totalReleases}
                                step={5}
                                marks={[
                                  { value: 10, label: '10' },
                                  { value: 50, label: '50' },
                                  { value: 100, label: '100' },
                                  { value: totalReleases, label: 'All' },
                                ]}
                                withInputField={false}
                              />
                            </div>
                          )}
                        </div>
                        <TrendChart
                          {...trendChartProps}
                          viewMode={effectiveViewMode}
                          chartType={chartType}
                          visibleCategories={visibleCategories}
                          onCategoryToggle={handleCategoryToggle}
                        />
                      </CardBody>
                    </Card>

                    {/* Table - single instance, props switch */}
                    <Card id="releases-table" className={isWPTab ? 'wp-version-table-card' : undefined}>
                      <CardBody>
                        <DataTable {...dataTableProps} />
                      </CardBody>
                    </Card>
                  </div>
                );
              }}
            </TabPanel>
          </main>
          <footer className="app-footer">
            <Text>
              {summary.totalReleases} releases: {summary.oldestRelease} – {summary.latestRelease}
            </Text>
            <Text>
              Last updated:{' '}
              {new Date(summary.lastUpdated).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
