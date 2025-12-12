import { useState } from 'react';
import '@wordpress/components/build-style/style.css';
import {
  Button,
  Card,
  CardBody,
  ExternalLink,
  Notice,
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
import { ReleasesTable } from './components/ReleasesTable';
import { SummaryStats } from './components/SummaryStats';
import { GBReleaseSummaryStats } from './components/GBReleaseSummaryStats';
import { WPVersionTable } from './components/WPVersionTable';
import { TrendChart } from './components/TrendChart';

export type ViewMode = 'averages' | 'totals' | 'distribution';
export type ChartType = 'line' | 'bar' | 'area' | 'stacked';

const VIEW_MODES: ViewMode[] = ['averages', 'totals', 'distribution'];
const CHART_TYPES: ChartType[] = ['line', 'bar', 'area', 'stacked'];
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
  const activeTab = activeTabStr as TabName;
  const viewMode = viewModeStr as ViewMode;
  const chartType = chartTypeStr as ChartType;
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
                const effectiveViewMode = !isWPTab && viewMode === 'totals' ? 'averages' : viewMode;

                return (
                  <div className="tab-content">
                    {/* Summary section - different component per tab */}
                    <section id="version-summary">
                      {isWPTab ? (
                        <SummaryStats summary={summary} wpVersionStats={wpVersionStats} />
                      ) : (
                        <GBReleaseSummaryStats releases={releases} summary={summary} />
                      )}
                    </section>

                    {/* View mode toggle - different options per tab */}
                    <div className="view-mode-toggle">
                      {isWPTab ? (
                        <ToggleGroupControl
                          __nextHasNoMarginBottom
                          isBlock
                          label="View mode"
                          hideLabelFromVision
                          value={viewMode}
                          onChange={(value) => setViewMode(value as ViewMode)}
                        >
                          <ToggleGroupControlOption value="averages" label="Per Release" />
                          <ToggleGroupControlOption value="totals" label="Totals" />
                          <ToggleGroupControlOption value="distribution" label="Distribution" />
                        </ToggleGroupControl>
                      ) : (
                        <ToggleGroupControl
                          __nextHasNoMarginBottom
                          isBlock
                          label="View mode"
                          hideLabelFromVision
                          value={effectiveViewMode}
                          onChange={(value) => setViewMode(value as ViewMode)}
                        >
                          <ToggleGroupControlOption value="averages" label="PRs" />
                          <ToggleGroupControlOption value="distribution" label="Distribution" />
                        </ToggleGroupControl>
                      )}
                    </div>

                    {/* Chart - single instance, adapts via props */}
                    <Card id="trend-chart" className="trend-chart-card">
                      <CardBody>
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
                        {isWPTab ? (
                          <TrendChart
                            dataSource="wp-version"
                            data={wpVersionStats}
                            viewMode={effectiveViewMode}
                            chartType={chartType}
                          />
                        ) : (
                          <TrendChart
                            dataSource="gb-release"
                            data={timeSeries}
                            viewMode={effectiveViewMode}
                            chartType={chartType}
                            releaseCount={50}
                          />
                        )}
                      </CardBody>
                    </Card>

                    {/* Table - different component per tab */}
                    <Card id="releases-table" className={isWPTab ? 'wp-version-table-card' : undefined}>
                      <CardBody>
                        {isWPTab ? (
                          <WPVersionTable wpVersionStats={wpVersionStats} viewMode={viewMode} />
                        ) : (
                          <ReleasesTable releases={releases} viewMode={effectiveViewMode} />
                        )}
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
