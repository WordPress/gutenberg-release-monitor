import { useMemo, useEffect, useState } from 'react';
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
import type { WPVersionStats, TimeSeriesPoint } from '../data/types';
import type { ViewMode, ChartType } from '../App';
import { loadCategoryConfig, type CategoryConfig } from '../utils/categories';

interface BaseTrendChartProps {
  viewMode: ViewMode;
  chartType: ChartType;
}

interface WPVersionTrendChartProps extends BaseTrendChartProps {
  dataSource: 'wp-version';
  data: WPVersionStats[];
}

interface GBReleaseTrendChartProps extends BaseTrendChartProps {
  dataSource: 'gb-release';
  data: TimeSeriesPoint[];
  /** Number of releases to show (default: all) */
  releaseCount?: number;
}

type TrendChartProps = WPVersionTrendChartProps | GBReleaseTrendChartProps;

// Fixed colors
const PRS_COLOR = '#3858e9';
const RELEASES_COLOR = '#757575';

export function TrendChart(props: TrendChartProps) {
  const { viewMode, chartType, dataSource, data } = props;
  const releaseCount = dataSource === 'gb-release' ? props.releaseCount : undefined;

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Get default categories for rendering
  const defaultCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
  }, [categoryConfig]);

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

        return baseData;
      });
    }

    // GB release data
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
  }, [data, categoryConfig, viewMode, defaultCategories, dataSource, releaseCount]);

  // Build legend items
  const legendItems = useMemo(() => {
    const items: Array<{ label: string; color: string; dashed?: boolean }> = [];
    defaultCategories.forEach((agg) => {
      items.push({ label: agg.label, color: agg.color });
    });
    // Show "All PRs" for line/bar in non-distribution mode
    if (viewMode !== 'distribution' && (chartType === 'line' || chartType === 'bar')) {
      items.push({ label: 'All PRs', color: PRS_COLOR });
    }
    // Show releases count for WP totals mode
    if (config.showReleasesLine) {
      items.push({ label: 'GB releases included', color: RELEASES_COLOR, dashed: true });
    }
    return items;
  }, [defaultCategories, chartType, viewMode, config.showReleasesLine]);

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
        <div className="trend-chart-legend">
          {legendItems.map((item) => (
            <div
              key={item.label}
              className="trend-chart-legend-item"
              style={{ '--legend-color': item.color } as React.CSSProperties}
            >
              <span className={`trend-chart-legend-line${item.dashed ? ' trend-chart-legend-line--dashed' : ''}`} />
              <span className="trend-chart-legend-label">{item.label}</span>
            </div>
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

    // Filter out "All PRs" for stacked/area
    const displayPayload = showTotalInTooltip ? categoryPayload : categoryPayload;

    // Calculate total for stacked charts
    const total = showTotalInTooltip
      ? categoryPayload.reduce((sum, entry) => sum + entry.value, 0)
      : null;

    const formatValue = (value: number) => {
      if (viewMode === 'distribution') {
        return `${value.toFixed(1)}%`;
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
            <span className="trend-chart-tooltip-value">{formatValue(entry.value)}</span>
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

  // Y-axis configuration based on view mode
  const yAxisProps =
    viewMode === 'distribution'
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
                value: `WP ${wpVersion}`,
                position: 'insideTopLeft',
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
