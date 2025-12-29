import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useTabData, useSummary } from './hooks/useReleases';
import { useDarkMode } from './hooks/useDarkMode';
import { useURLState } from './hooks/useURLState';
import { SummaryStats } from './components/SummaryStats';
import { DataTable } from './components/DataTable';
import { TrendChart } from './components/TrendChart';
import { getDefaultCategoryIds } from './components/CategoryFilter';
import { useConfig, useTabPanelTabs, useTabIds } from './config';
import type { ViewMode, ChartType, MetricType } from './config/types';

// Re-export types for backward compatibility
export type { ViewMode, ChartType, MetricType } from './config/types';

const VIEW_MODES: ViewMode[] = ['averages', 'totals', 'distribution', 'sponsors', 'countries'];
const CHART_TYPES: ChartType[] = ['stacked', 'area', 'bar', 'line'];
const METRIC_TYPES: MetricType[] = ['prs', 'contributors'];

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
  // Get configuration
  const config = useConfig();
  const tabIds = useTabIds();
  const tabPanelTabs = useTabPanelTabs();

  // URL-synced state using config defaults
  const [activeTab, setActiveTab] = useURLState('tab', config.defaults.tab, tabIds);
  const [viewModeStr, setViewMode] = useURLState('view', config.defaults.viewMode, VIEW_MODES);
  const [chartTypeStr, setChartType] = useURLState('chart', config.defaults.chartType, CHART_TYPES);
  const [metricStr, setMetric] = useURLState('metric', config.defaults.metric, METRIC_TYPES);
  const viewMode = viewModeStr as ViewMode;
  const chartType = chartTypeStr as ChartType;
  const metric = metricStr as MetricType;

  // Get current tab configuration
  const tabConfig = useMemo(
    () => config.tabs.find((t) => t.id === activeTab) || config.tabs[0],
    [config.tabs, activeTab]
  );

  // Category filter state (synced with URL)
  const [visibleCategories, setVisibleCategories] = useState<string[]>([]);
  const [defaultCategoryIds, setDefaultCategoryIds] = useState<string[]>([]);

  // Release count for trend chart (synced with URL)
  const defaultReleaseCount = config.defaults.releaseCount;
  const [releaseCount, setReleaseCount] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCount = params.get('releases');
    if (urlCount) {
      const parsed = parseInt(urlCount, 10);
      if (!isNaN(parsed) && parsed >= 10) return parsed;
    }
    return defaultReleaseCount;
  });

  // Sync releaseCount to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (releaseCount === defaultReleaseCount) {
      params.delete('releases');
    } else {
      params.set('releases', String(releaseCount));
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [releaseCount, defaultReleaseCount]);

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
  // Fetch data for the active tab - returns pre-normalized NormalizedRelease[]
  const {
    data: tabData,
    isLoading: tabDataLoading,
    error: tabDataError,
  } = useTabData(activeTab);
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useSummary();
  const { isDark, toggle } = useDarkMode();

  const isLoading = tabDataLoading || summaryLoading;
  const error = tabDataError || summaryError;

  // Data is already normalized from the JSON files - no transformation needed
  const normalizedData = tabData ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <a href={import.meta.env.BASE_URL} className="app-title-link">
            <Heading level={1}>{config.project.name}</Heading>
          </a>
          <Button
            variant="tertiary"
            onClick={toggle}
            label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            icon={isDark ? SunIcon : MoonIcon}
          />
        </div>
        <Text>
          Track{' '}
          <ExternalLink href={config.project.projectUrl}>
            {config.project.projectLabel}
          </ExternalLink>{' '}
          {config.project.description}
        </Text>
        <Text className="app-disclaimer">
          {config.project.disclaimer}{' '}
          <ExternalLink href={config.project.learnMoreUrl}>
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

      {!isLoading && !error && summary && normalizedData && (
        <>
          <main className="app-main">
            <TabPanel
              className="app-tabs"
              tabs={tabPanelTabs}
              initialTabName={activeTab}
              onSelect={(tabName) => setActiveTab(tabName)}
            >
              {() => {
                // Use config to determine supported modes
                const supportsTotals = tabConfig.supportedViewModes.includes('totals');
                const isContributorMetric = metric === 'contributors';
                // Adjust viewMode when switching metrics or tabs
                let effectiveViewMode = viewMode;
                // Handle unsupported view modes based on tab config
                if (!supportsTotals && viewMode === 'totals') {
                  effectiveViewMode = 'averages';
                }
                // Contributor mode doesn't have category distribution, PR mode doesn't have sponsors/countries
                if (isContributorMetric && viewMode === 'distribution') {
                  effectiveViewMode = 'sponsors';
                } else if (!isContributorMetric && (viewMode === 'sponsors' || viewMode === 'countries')) {
                  effectiveViewMode = 'distribution';
                }

                // Filter normalized data for items that have data for the current mode
                // This ensures the range slider max matches what TrendChart will display
                // Uses normalized field names - no raw data or isAggregated checks needed
                const filteredData = (normalizedData ?? []).filter((item) => {
                  if (effectiveViewMode === 'sponsors') {
                    return item.contributorAggregates?.sponsorBreakdown &&
                      Object.keys(item.contributorAggregates.sponsorBreakdown).length > 0;
                  }
                  if (effectiveViewMode === 'countries') {
                    return item.contributorAggregates?.countryBreakdown &&
                      Object.keys(item.contributorAggregates.countryBreakdown).length > 0;
                  }
                  // For PR modes, check category data (normalized uses categoryTotals or rawCategories)
                  if (metric === 'prs') {
                    const categoryData = item.categoryTotals || item.rawCategories;
                    return categoryData && Object.values(categoryData).some(v => v > 0);
                  }
                  // For contributor modes, data is always present
                  return true;
                });

                const totalItems = filteredData.length;
                // TrendChart also receives normalized data
                const trendChartProps = {
                  data: normalizedData ?? [],
                  releaseCount,
                  metric,
                  tabConfig,
                };

                // DataTable receives normalized data
                const dataTableProps = {
                  data: normalizedData ?? [],
                  viewMode: effectiveViewMode,
                  metric,
                  tabConfig,
                };

                return (
                  <div className="tab-content">
                    {/* Summary section - receives normalized data */}
                    <section id="version-summary">
                      <SummaryStats
                        data={normalizedData ?? []}
                        tabConfig={tabConfig}
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
                          value={supportsTotals ? viewMode : effectiveViewMode}
                          onChange={(value) => setViewMode(value as ViewMode)}
                        >
                          <ToggleGroupControlOption value="averages" label={tabConfig.labels.averagesToggle ?? (metric === 'prs' ? 'PRs' : 'Contributors')} />
                          {supportsTotals && <ToggleGroupControlOption value="totals" label="Totals" />}
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
                              <ToggleGroupControlOption value="bar" label="Bar" />
                              <ToggleGroupControlOption value="line" label="Line" />
                            </ToggleGroupControl>
                          </div>
                          {totalItems > 10 && (
                            <div className="release-count-control">
                              <span className="release-count-label">Show:</span>
                              <RangeControl
                                __nextHasNoMarginBottom
                                label="Items to show"
                                hideLabelFromVision
                                value={Math.min(releaseCount, totalItems)}
                                onChange={(value) => setReleaseCount(value ?? 50)}
                                min={10}
                                max={totalItems}
                                step={5}
                                marks={[
                                  { value: 10, label: '10' },
                                  ...(totalItems >= 25 ? [{ value: 25, label: '25' }] : []),
                                  ...(totalItems >= 50 ? [{ value: 50, label: '50' }] : []),
                                  { value: totalItems, label: 'All' },
                                ]}
                                withInputField={false}
                                __next40pxDefaultSize
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
                    <Card id="releases-table" className={tabConfig.tableCardClass || undefined}>
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
            <Text>
              @priethor -{' '}
              <a href="https://github.com/priethor/gutenberg-release-monitor" target="_blank" rel="noopener noreferrer">
                source code
              </a>
            </Text>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
