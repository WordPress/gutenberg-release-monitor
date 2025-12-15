import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { WPVersionStats, TimeSeriesPoint, Release } from '../data/types';
import type { ViewMode, ChartType, MetricType } from '../App';
import { loadCategoryConfig, type CategoryConfig } from '../utils/categories';

interface BaseTrendChartProps {
  viewMode: ViewMode;
  chartType: ChartType;
  /** Metric type: PRs or Contributors */
  metric: MetricType;
  /** Category IDs to display (default: all default categories) */
  visibleCategories?: string[];
  /** Callback when a category is toggled via legend click */
  onCategoryToggle?: (categoryId: string, isVisible: boolean) => void;
}

interface WPVersionTrendChartProps extends BaseTrendChartProps {
  dataSource: 'wp-version';
  data: WPVersionStats[];
}

interface GBReleaseTrendChartProps extends BaseTrendChartProps {
  dataSource: 'gb-release';
  /** PR data (TimeSeriesPoint[]) or contributor data (Release[]) based on metric */
  data: TimeSeriesPoint[] | Release[];
  /** Number of releases to show (default: all) */
  releaseCount?: number;
}

type TrendChartProps = WPVersionTrendChartProps | GBReleaseTrendChartProps;

// Fixed colors
const PRS_COLOR = '#3858e9';
const RELEASES_COLOR = '#757575';
const CONTRIBUTORS_COLOR = '#4CAF50';
const NEW_CONTRIBUTORS_COLOR = '#FF9800';
const RETURNING_CONTRIBUTORS_COLOR = '#2196F3';

// Color palette for sponsor/country breakdown charts
const BREAKDOWN_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#00BCD4', '#E91E63', '#8BC34A', '#FF5722', '#3F51B5',
  '#CDDC39', '#795548', '#607D8B', '#009688', '#FFC107',
];
const UNKNOWN_COLOR = '#9E9E9E';
const OTHERS_COLOR = '#BDBDBD';
const MAX_BREAKDOWN_ITEMS = 10;

export function TrendChart(props: TrendChartProps) {
  const { viewMode, chartType, dataSource, data, visibleCategories, onCategoryToggle, metric } = props;
  const releaseCount = dataSource === 'gb-release' ? props.releaseCount : undefined;
  const isContributorMetric = metric === 'contributors';
  const isSponsorBreakdown = viewMode === 'sponsors';
  const isCountryBreakdown = viewMode === 'countries';
  const isBreakdownMode = isSponsorBreakdown || isCountryBreakdown;

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Get categories to render (filtered by visibleCategories if provided)
  const defaultCategories = useMemo(() => {
    if (!categoryConfig) return [];
    if (!visibleCategories || visibleCategories.length === 0) {
      // No filter: show includeByDefault categories
      return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
    }
    // Filter provided: show any category from visibleCategories (not just defaults)
    return categoryConfig.aggregations.filter((agg) => visibleCategories.includes(agg.id));
  }, [categoryConfig, visibleCategories]);

  // Compute top sponsors/countries for breakdown charts
  const topBreakdownItems = useMemo(() => {
    if (!isBreakdownMode) return [];

    // Aggregate totals across all data points
    const totals: Record<string, number> = {};
    const breakdownKey = isSponsorBreakdown ? 'sponsorBreakdown' : 'countryBreakdown';

    if (dataSource === 'wp-version') {
      const wpData = data as WPVersionStats[];
      wpData.forEach((stat) => {
        const breakdown = stat.contributorAggregates?.[breakdownKey];
        if (breakdown) {
          Object.entries(breakdown).forEach(([key, value]) => {
            totals[key] = (totals[key] || 0) + value;
          });
        }
      });
    } else {
      const releaseData = data as Release[];
      const displayedData = releaseCount ? releaseData.slice(0, releaseCount) : releaseData;
      displayedData.forEach((release) => {
        const breakdown = release.contributorAggregates?.[breakdownKey];
        if (breakdown) {
          Object.entries(breakdown).forEach(([key, value]) => {
            totals[key] = (totals[key] || 0) + value;
          });
        }
      });
    }

    // Sort by total, keep Unknown at end
    const sorted = Object.entries(totals).sort(([aKey, aVal], [bKey, bVal]) => {
      if (aKey === 'Unknown') return 1;
      if (bKey === 'Unknown') return -1;
      return bVal - aVal;
    });

    // Take top N items (excluding Unknown), add Others if needed
    const hasUnknown = totals['Unknown'] > 0;
    const nonUnknown = sorted.filter(([key]) => key !== 'Unknown');
    const topItems = nonUnknown.slice(0, MAX_BREAKDOWN_ITEMS - (hasUnknown ? 1 : 0));
    const othersItems = nonUnknown.slice(MAX_BREAKDOWN_ITEMS - (hasUnknown ? 1 : 0));
    const othersTotal = othersItems.reduce((sum, [, val]) => sum + val, 0);
    const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

    const result: Array<{ id: string; label: string; color: string; total: number; percentage: number }> = topItems.map(([label, total], index) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      color: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
      total,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0,
    }));

    if (othersTotal > 0) {
      result.push({
        id: 'others',
        label: 'Others',
        color: OTHERS_COLOR,
        total: othersTotal,
        percentage: grandTotal > 0 ? Math.round((othersTotal / grandTotal) * 1000) / 10 : 0,
      });
    }

    if (hasUnknown) {
      const unknownTotal = totals['Unknown'];
      result.push({
        id: 'unknown',
        label: 'Unknown',
        color: UNKNOWN_COLOR,
        total: unknownTotal,
        percentage: grandTotal > 0 ? Math.round((unknownTotal / grandTotal) * 1000) / 10 : 0,
      });
    }

    return result;
  }, [isBreakdownMode, isSponsorBreakdown, dataSource, data, releaseCount]);

  // Configuration based on data source
  const config = useMemo(() => {
    if (dataSource === 'wp-version') {
      return {
        xKey: 'wpVersion',
        xLabel: 'WP version',
        tooltipPrefix: 'WordPress',
        showReleasesLine: viewMode === 'totals',
        tickInterval: 0,
        xAxisAngle: 0,
        xAxisHeight: 30,
      };
    }
    return {
      xKey: 'gbVersion',
      xLabel: 'GB release',
      tooltipPrefix: 'Gutenberg',
      showReleasesLine: false,
      tickInterval: data.length > 50 ? Math.floor(data.length / 20) : 0,
      xAxisAngle: -45,
      xAxisHeight: 60,
    };
  }, [dataSource, viewMode, data.length]);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!categoryConfig) return [];

    if (dataSource === 'wp-version') {
      const wpData = data as WPVersionStats[];
      return [...wpData].reverse().map((stat) => {
        const baseData: Record<string, string | number> = {
          wpVersion: stat.wpVersion,
          releaseCount: stat.releaseCount,
        };

        if (isBreakdownMode) {
          // Sponsor/country breakdown
          const breakdownKey = isSponsorBreakdown ? 'sponsorBreakdown' : 'countryBreakdown';
          const breakdown = stat.contributorAggregates?.[breakdownKey] || {};

          // Add values for each top item
          const topLabels = topBreakdownItems.filter((item) => item.label !== 'Others' && item.label !== 'Unknown').map((item) => item.label);
          let othersTotal = 0;

          topBreakdownItems.forEach((item) => {
            if (item.label === 'Others') {
              // Sum up all items not in top items (excluding Unknown)
              Object.entries(breakdown).forEach(([key, value]) => {
                if (!topLabels.includes(key) && key !== 'Unknown') {
                  othersTotal += value;
                }
              });
              baseData[item.id] = othersTotal;
            } else if (item.label === 'Unknown') {
              baseData[item.id] = breakdown['Unknown'] || 0;
            } else {
              baseData[item.id] = breakdown[item.label] || 0;
            }
          });
        } else if (isContributorMetric) {
          // Contributor metrics (totals/averages)
          if (viewMode === 'totals') {
            baseData.contributors = stat.totalContributors;
            baseData.newContributors = stat.totalNewContributors;
            baseData.returningContributors = stat.totalContributors - stat.totalNewContributors;
          } else {
            // averages (default for contributors)
            baseData.contributors = stat.avgContributorsPerRelease;
            baseData.newContributors = stat.avgNewContributorsPerRelease;
            baseData.returningContributors = Math.round(stat.avgContributorsPerRelease - stat.avgNewContributorsPerRelease);
          }
        } else {
          // PR metrics (existing logic)
          if (viewMode === 'distribution') {
            const totalCategorySum = defaultCategories.reduce((sum, agg) => {
              return sum + (stat.categoryTotals?.[agg.id] || 0);
            }, 0);
            defaultCategories.forEach((agg) => {
              const value = stat.categoryTotals?.[agg.id] || 0;
              const percentage = totalCategorySum > 0 ? (value / totalCategorySum) * 100 : 0;
              baseData[`pct_${agg.id}`] = Math.round(percentage * 10) / 10;
            });
          } else if (viewMode === 'totals') {
            baseData.totalPRs = stat.totalPRs;
            defaultCategories.forEach((agg) => {
              baseData[agg.id] = stat.categoryTotals?.[agg.id] || 0;
            });
          } else {
            // averages
            baseData.totalPRs = stat.avgPRsPerRelease;
            defaultCategories.forEach((agg) => {
              const total = stat.categoryTotals?.[agg.id] || 0;
              baseData[agg.id] = total > 0 ? Math.round(total / stat.releaseCount) : 0;
            });
          }
        }

        return baseData;
      });
    }

    // GB release data
    if (isBreakdownMode) {
      // Sponsor/country breakdown - data is Release[]
      const releaseData = data as Release[];
      // Releases are sorted newest-first; reverse for chronological chart display
      const displayedData = releaseCount
        ? releaseData.slice(0, releaseCount).reverse()
        : [...releaseData].reverse();
      const breakdownKey = isSponsorBreakdown ? 'sponsorBreakdown' : 'countryBreakdown';
      const topLabels = topBreakdownItems.filter((item) => item.label !== 'Others' && item.label !== 'Unknown').map((item) => item.label);

      return displayedData.map((release) => {
        const baseData: Record<string, string | number | boolean> = {
          gbVersion: release.gbVersion,
          isLastBeforeWPBeta: release.isLastBeforeWPBeta,
          wpVersion: release.wpVersion || '',
        };

        const breakdown = release.contributorAggregates?.[breakdownKey] || {};
        let othersTotal = 0;

        topBreakdownItems.forEach((item) => {
          if (item.label === 'Others') {
            Object.entries(breakdown).forEach(([key, value]) => {
              if (!topLabels.includes(key) && key !== 'Unknown') {
                othersTotal += value;
              }
            });
            baseData[item.id] = othersTotal;
          } else if (item.label === 'Unknown') {
            baseData[item.id] = breakdown['Unknown'] || 0;
          } else {
            baseData[item.id] = breakdown[item.label] || 0;
          }
        });

        return baseData;
      });
    }

    if (isContributorMetric) {
      // Contributor metrics (totals/averages) - data is Release[]
      const releaseData = data as Release[];
      // Releases are sorted newest-first; reverse for chronological chart display
      const displayedData = releaseCount
        ? releaseData.slice(0, releaseCount).reverse()
        : [...releaseData].reverse();

      return displayedData.map((release) => ({
        gbVersion: release.gbVersion,
        contributors: release.contributors,
        newContributors: release.newContributors,
        returningContributors: release.contributors - release.newContributors,
        isLastBeforeWPBeta: release.isLastBeforeWPBeta,
        wpVersion: release.wpVersion || '',
      }));
    }

    // PR metrics - data is TimeSeriesPoint[]
    const gbData = data as TimeSeriesPoint[];
    const displayedData = releaseCount ? gbData.slice(-releaseCount) : gbData;

    return displayedData.map((point) => {
      const baseData: Record<string, string | number | boolean> = {
        gbVersion: point.gbVersion,
        totalPRs: point.totalPRs,
        isLastBeforeWPBeta: point.isLastBeforeWPBeta,
        wpVersion: point.wpVersion || '',
      };

      if (viewMode === 'distribution') {
        const totalCategorySum = defaultCategories.reduce((sum, agg) => {
          return sum + (point.categoryPRs[agg.id] || 0);
        }, 0);
        defaultCategories.forEach((agg) => {
          const value = point.categoryPRs[agg.id] || 0;
          const percentage = totalCategorySum > 0 ? (value / totalCategorySum) * 100 : 0;
          baseData[`pct_${agg.id}`] = Math.round(percentage * 10) / 10;
        });
      } else {
        defaultCategories.forEach((agg) => {
          baseData[agg.id] = point.categoryPRs[agg.id] || 0;
        });
      }

      return baseData;
    });
  }, [data, categoryConfig, viewMode, defaultCategories, dataSource, releaseCount, isContributorMetric, isBreakdownMode, isSponsorBreakdown, topBreakdownItems]);

  // Build legend items - include ALL categories for clickable legend
  const legendItems = useMemo(() => {
    const items: Array<{ id: string; label: string; color: string; dashed?: boolean; isVisible: boolean; isCategory: boolean }> = [];

    if (isBreakdownMode) {
      // Sponsor/country breakdown: show top items as legend
      topBreakdownItems.forEach((item) => {
        items.push({ id: item.id, label: item.label, color: item.color, isVisible: true, isCategory: false });
      });
    } else if (isContributorMetric) {
      // Contributor mode: show contributor legend items
      // For stacked/area, show returning + new; for line/bar, show total + new
      const isStackedChart = chartType === 'stacked' || chartType === 'area';
      if (isStackedChart) {
        items.push({ id: 'returningContributors', label: 'Returning Contributors', color: RETURNING_CONTRIBUTORS_COLOR, isVisible: true, isCategory: false });
        items.push({ id: 'newContributors', label: 'New Contributors', color: NEW_CONTRIBUTORS_COLOR, isVisible: true, isCategory: false });
      } else {
        items.push({ id: 'contributors', label: 'Total Contributors', color: CONTRIBUTORS_COLOR, isVisible: true, isCategory: false });
        items.push({ id: 'newContributors', label: 'New Contributors', color: NEW_CONTRIBUTORS_COLOR, isVisible: true, isCategory: false });
      }
    } else {
      // PR mode: show category legend items
      if (categoryConfig) {
        categoryConfig.aggregations.forEach((agg) => {
          const isVisible = visibleCategories
            ? visibleCategories.includes(agg.id)
            : agg.includeByDefault;
          items.push({ id: agg.id, label: agg.label, color: agg.color, isVisible, isCategory: true });
        });
      }

      // Show "All PRs" for line/bar in non-distribution mode
      if (viewMode !== 'distribution' && (chartType === 'line' || chartType === 'bar')) {
        items.push({ id: 'allPRs', label: 'All PRs', color: PRS_COLOR, isVisible: true, isCategory: false });
      }
    }

    // Show releases count for WP totals mode (both modes)
    if (config.showReleasesLine) {
      items.push({ id: 'releases', label: 'GB releases included', color: RELEASES_COLOR, dashed: true, isVisible: true, isCategory: false });
    }
    return items;
  }, [categoryConfig, visibleCategories, chartType, viewMode, config.showReleasesLine, isContributorMetric, isBreakdownMode, topBreakdownItems]);

  const handleLegendClick = useCallback(
    (categoryId: string) => {
      if (!onCategoryToggle) return;
      const item = legendItems.find((i) => i.id === categoryId);
      if (item && item.isCategory) {
        onCategoryToggle(categoryId, !item.isVisible);
      }
    },
    [onCategoryToggle, legendItems]
  );

  const isClickable = !!onCategoryToggle;

  // Get cutoff versions for reference lines (GB release tab only)
  // Must be before early return to maintain consistent hook order
  const cutoffVersions = useMemo(() => {
    if (dataSource !== 'gb-release') return [];
    return chartData
      .filter((point) => point.isLastBeforeWPBeta)
      .map((point) => ({
        version: point.gbVersion as string,
        wpVersion: point.wpVersion as string,
      }));
  }, [chartData, dataSource]);

  if (!categoryConfig || chartData.length === 0) {
    return null;
  }

  const commonProps = {
    data: chartData,
    margin: { top: 20, right: config.showReleasesLine ? 50 : 30, left: 20, bottom: 5 },
  };

  const renderLegend = () => (
    <Legend
      content={() => (
        <div className={`trend-chart-legend${isClickable ? ' trend-chart-legend--clickable' : ''}`}>
          {legendItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`trend-chart-legend-item${!item.isVisible ? ' trend-chart-legend-item--hidden' : ''}${!item.isCategory ? ' trend-chart-legend-item--fixed' : ''}`}
              style={{ '--legend-color': item.color } as React.CSSProperties}
              onClick={() => handleLegendClick(item.id)}
              disabled={!isClickable || !item.isCategory}
              title={isClickable && item.isCategory ? `Click to ${item.isVisible ? 'hide' : 'show'} ${item.label}` : undefined}
            >
              <span className={`trend-chart-legend-line${item.dashed ? ' trend-chart-legend-line--dashed' : ''}`} />
              <span className="trend-chart-legend-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    />
  );

  const getDataKey = (categoryId: string) => {
    return viewMode === 'distribution' ? `pct_${categoryId}` : categoryId;
  };

  const usesDualAxis = config.showReleasesLine;

  const renderDataSeries = () => {
    // Always use 'left' yAxisId for consistent DOM structure (prevents remounting)
    const yAxisId = 'left' as const;

    // Sponsor/country breakdown mode
    if (isBreakdownMode) {
      const releasesLine = config.showReleasesLine && (
        <Line
          yAxisId="right"
          type="linear"
          dataKey="releaseCount"
          name="GB releases included"
          stroke={RELEASES_COLOR}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: RELEASES_COLOR }}
        />
      );

      if (chartType === 'bar') {
        return (
          <>
            {topBreakdownItems.map((item) => (
              <Bar key={item.id} yAxisId={yAxisId} dataKey={item.id} name={item.label} fill={item.color} opacity={0.8} />
            ))}
            {releasesLine}
          </>
        );
      }
      if (chartType === 'stacked') {
        return (
          <>
            {topBreakdownItems.map((item) => (
              <Bar key={item.id} yAxisId={yAxisId} dataKey={item.id} name={item.label} fill={item.color} stackId="breakdown" />
            ))}
            {releasesLine}
          </>
        );
      }
      if (chartType === 'area') {
        return (
          <>
            {topBreakdownItems.map((item) => (
              <Area key={item.id} yAxisId={yAxisId} type="monotone" dataKey={item.id} name={item.label} stroke={item.color} fill={item.color} fillOpacity={0.6} strokeWidth={2} stackId="breakdown" />
            ))}
            {releasesLine}
          </>
        );
      }
      // Default: line
      return (
        <>
          {topBreakdownItems.map((item) => (
            <Line
              key={item.id}
              yAxisId={yAxisId}
              type="monotone"
              dataKey={item.id}
              name={item.label}
              stroke={item.color}
              strokeWidth={2}
              dot={{ r: 3, fill: item.color }}
              activeDot={{ r: 5, fill: item.color }}
            />
          ))}
          {releasesLine}
        </>
      );
    }

    // Contributor metrics - render based on chart type
    if (isContributorMetric) {
      const releasesLine = config.showReleasesLine && (
        <Line
          yAxisId="right"
          type="linear"
          dataKey="releaseCount"
          name="GB releases included"
          stroke={RELEASES_COLOR}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: RELEASES_COLOR }}
        />
      );

      if (chartType === 'bar') {
        return (
          <>
            <Bar yAxisId={yAxisId} dataKey="contributors" name="Total Contributors" fill={CONTRIBUTORS_COLOR} opacity={0.8} />
            <Bar yAxisId={yAxisId} dataKey="newContributors" name="New Contributors" fill={NEW_CONTRIBUTORS_COLOR} opacity={0.8} />
            {releasesLine}
          </>
        );
      }
      if (chartType === 'stacked') {
        return (
          <>
            <Bar yAxisId={yAxisId} dataKey="returningContributors" name="Returning Contributors" fill={RETURNING_CONTRIBUTORS_COLOR} stackId="contrib" />
            <Bar yAxisId={yAxisId} dataKey="newContributors" name="New Contributors" fill={NEW_CONTRIBUTORS_COLOR} stackId="contrib" />
            {releasesLine}
          </>
        );
      }
      if (chartType === 'area') {
        return (
          <>
            <Area yAxisId={yAxisId} type="monotone" dataKey="returningContributors" name="Returning Contributors" stroke={RETURNING_CONTRIBUTORS_COLOR} fill={RETURNING_CONTRIBUTORS_COLOR} fillOpacity={0.6} strokeWidth={2} stackId="contrib" />
            <Area yAxisId={yAxisId} type="monotone" dataKey="newContributors" name="New Contributors" stroke={NEW_CONTRIBUTORS_COLOR} fill={NEW_CONTRIBUTORS_COLOR} fillOpacity={0.6} strokeWidth={2} stackId="contrib" />
            {releasesLine}
          </>
        );
      }
      // Default: line
      return (
        <>
          <Line
            yAxisId={yAxisId}
            type="monotone"
            dataKey="contributors"
            name="Total Contributors"
            stroke={CONTRIBUTORS_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: CONTRIBUTORS_COLOR }}
            activeDot={{ r: 5, fill: CONTRIBUTORS_COLOR }}
          />
          <Line
            yAxisId={yAxisId}
            type="monotone"
            dataKey="newContributors"
            name="New Contributors"
            stroke={NEW_CONTRIBUTORS_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: NEW_CONTRIBUTORS_COLOR }}
            activeDot={{ r: 5, fill: NEW_CONTRIBUTORS_COLOR }}
          />
          {releasesLine}
        </>
      );
    }

    // PR metrics - existing logic with chart type variations
    if (chartType === 'bar') {
      return (
        <>
          {defaultCategories.map((agg) => (
            <Bar
              key={agg.id}
              yAxisId={yAxisId}
              dataKey={getDataKey(agg.id)}
              name={agg.label}
              fill={agg.color}
              opacity={0.8}
            />
          ))}
          {viewMode !== 'distribution' && (
            <Bar yAxisId={yAxisId} dataKey="totalPRs" name="All PRs" fill={PRS_COLOR} opacity={0.8} />
          )}
          {config.showReleasesLine && (
            <Line
              yAxisId="right"
              type="linear"
              dataKey="releaseCount"
              name="GB releases included"
              stroke={RELEASES_COLOR}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: RELEASES_COLOR }}
            />
          )}
        </>
      );
    }
    if (chartType === 'stacked') {
      return (
        <>
          {defaultCategories.map((agg) => (
            <Bar
              key={agg.id}
              yAxisId={yAxisId}
              dataKey={getDataKey(agg.id)}
              name={agg.label}
              fill={agg.color}
              stackId="1"
            />
          ))}
          {config.showReleasesLine && (
            <Line
              yAxisId="right"
              type="linear"
              dataKey="releaseCount"
              name="GB releases included"
              stroke={RELEASES_COLOR}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: RELEASES_COLOR }}
            />
          )}
        </>
      );
    }
    if (chartType === 'area') {
      return (
        <>
          {defaultCategories.map((agg) => (
            <Area
              key={agg.id}
              yAxisId={yAxisId}
              type="monotone"
              dataKey={getDataKey(agg.id)}
              name={agg.label}
              stroke={agg.color}
              fill={agg.color}
              fillOpacity={0.6}
              strokeWidth={2}
              stackId="1"
            />
          ))}
          {config.showReleasesLine && (
            <Line
              yAxisId="right"
              type="linear"
              dataKey="releaseCount"
              name="GB releases included"
              stroke={RELEASES_COLOR}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: RELEASES_COLOR }}
            />
          )}
        </>
      );
    }
    // Default: line
    return (
      <>
        {defaultCategories.map((agg) => (
          <Line
            key={agg.id}
            yAxisId={yAxisId}
            type="monotone"
            dataKey={getDataKey(agg.id)}
            name={agg.label}
            stroke={agg.color}
            strokeWidth={2}
            dot={{ r: 3, fill: agg.color }}
            activeDot={{ r: 5, fill: agg.color }}
          />
        ))}
        {viewMode !== 'distribution' && (
          <Line
            yAxisId={yAxisId}
            type="monotone"
            dataKey="totalPRs"
            name="All PRs"
            stroke={PRS_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: PRS_COLOR }}
            activeDot={{ r: 5, fill: PRS_COLOR }}
          />
        )}
        {config.showReleasesLine && (
          <Line
            yAxisId="right"
            type="linear"
            dataKey="releaseCount"
            name="GB releases included"
            stroke={RELEASES_COLOR}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: RELEASES_COLOR }}
          />
        )}
      </>
    );
  };

  // Show total in tooltip for stacked/area charts
  const showTotalInTooltip = chartType === 'stacked' || chartType === 'area';

  const renderTooltipContent = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ name: string; value: number; color: string; payload?: Record<string, unknown> }>;
    label?: string | number;
  }) => {
    if (!active || !payload || !payload.length) return null;

    // Get metadata from the data point (for GB release tab)
    const dataPoint = payload[0]?.payload;
    const isLastBeforeWPBeta = dataPoint?.isLastBeforeWPBeta as boolean | undefined;
    const wpVersion = dataPoint?.wpVersion as string | undefined;

    // Separate category data from special entries
    const categoryPayload = payload.filter(
      (entry) => entry.name !== 'All PRs' && entry.name !== 'GB releases included'
    );
    const allPRsEntry = payload.find((entry) => entry.name === 'All PRs');
    const releasesEntry = payload.find((entry) => entry.name === 'GB releases included');

    // For breakdown mode, sort by value descending; otherwise keep original order
    const displayPayload = isBreakdownMode
      ? [...categoryPayload].sort((a, b) => b.value - a.value)
      : categoryPayload;

    // Calculate total for stacked charts or breakdown mode
    const total = (showTotalInTooltip || isBreakdownMode)
      ? categoryPayload.reduce((sum, entry) => sum + entry.value, 0)
      : null;

    const formatValue = (value: number, showPercentage = false) => {
      if (viewMode === 'distribution') {
        return `${value.toFixed(1)}%`;
      }
      if (showPercentage && total && total > 0) {
        const pct = Math.round((value / total) * 1000) / 10;
        return `${value.toLocaleString()} (${pct}%)`;
      }
      return value.toLocaleString();
    };

    return (
      <div className="trend-chart-tooltip">
        <div className="trend-chart-tooltip-label">
          {config.tooltipPrefix} {label}
          {isLastBeforeWPBeta && <span className="trend-chart-tooltip-cutoff" title={`WP ${wpVersion} Beta Cutoff`}> ⚑</span>}
        </div>
        {displayPayload.map((entry) => (
          <div key={entry.name} className="trend-chart-tooltip-item">
            <span
              className="trend-chart-tooltip-color"
              style={{ backgroundColor: entry.color }}
            />
            <span className="trend-chart-tooltip-name">{entry.name}</span>
            <span className="trend-chart-tooltip-value">{formatValue(entry.value, isBreakdownMode)}</span>
          </div>
        ))}
        {!showTotalInTooltip && allPRsEntry && (
          <div className="trend-chart-tooltip-item">
            <span
              className="trend-chart-tooltip-color"
              style={{ backgroundColor: allPRsEntry.color }}
            />
            <span className="trend-chart-tooltip-name">{allPRsEntry.name}</span>
            <span className="trend-chart-tooltip-value">{formatValue(allPRsEntry.value)}</span>
          </div>
        )}
        {total !== null && (
          <div className="trend-chart-tooltip-total">
            <span className="trend-chart-tooltip-name">Total</span>
            <span className="trend-chart-tooltip-value">
              {viewMode === 'distribution' ? `${total.toFixed(0)}%` : total.toLocaleString()}
            </span>
          </div>
        )}
        {releasesEntry && (
          <div className="trend-chart-tooltip-item trend-chart-tooltip-item--secondary">
            <span
              className="trend-chart-tooltip-color trend-chart-tooltip-color--dashed"
              style={{ backgroundColor: releasesEntry.color }}
            />
            <span className="trend-chart-tooltip-name">{releasesEntry.name}</span>
            <span className="trend-chart-tooltip-value">{releasesEntry.value}</span>
          </div>
        )}
      </div>
    );
  };

  // Y-axis configuration based on view mode and metric
  const yAxisProps = isBreakdownMode
    ? {
        label: { value: 'Contributors', angle: -90, position: 'insideLeft' as const, fontSize: 12 },
      }
    : isContributorMetric
      ? {
          label: { value: 'Contributors', angle: -90, position: 'insideLeft' as const, fontSize: 12 },
        }
      : viewMode === 'distribution'
        ? {
            domain: [0, 100] as [number, number],
            tickFormatter: (value: number) => `${Math.round(value)}%`,
            label: { value: '%', angle: -90, position: 'insideLeft' as const, fontSize: 12 },
          }
        : {
            label: { value: 'PRs', angle: -90, position: 'insideLeft' as const, fontSize: 12 },
          };

  return (
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey={config.xKey}
            tick={{ fontSize: config.xAxisAngle ? 10 : 12 }}
            tickMargin={8}
            interval={config.tickInterval}
            angle={config.xAxisAngle}
            textAnchor={config.xAxisAngle ? 'end' : 'middle'}
            height={config.xAxisHeight}
            label={{ value: config.xLabel, position: 'insideBottom', offset: -5, fontSize: 12 }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            {...yAxisProps}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            hide={!usesDualAxis}
            label={usesDualAxis ? { value: 'GB releases', angle: 90, position: 'insideRight', fontSize: 12 } : undefined}
          />
          <Tooltip content={renderTooltipContent} />
          {renderLegend()}
          {cutoffVersions.map(({ version, wpVersion }) => (
            <ReferenceLine
              key={version}
              yAxisId="left"
              x={version}
              stroke="var(--trend-chart-reference-line, #9b8bb8)"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: `WP ${wpVersion} beta`,
                position: 'top',
                offset: 5,
                fontSize: 9,
                fill: 'var(--trend-chart-reference-label, #7a6a9a)',
                fontWeight: 500,
              }}
            />
          ))}
          {renderDataSeries()}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
