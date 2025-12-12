import { useMemo, useEffect, useState } from 'react';
import {
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { WPVersionStats } from '../data/types';
import type { ChartType } from '../App';
import { loadCategoryConfig, type CategoryConfig } from '../utils/categories';

interface TrendBarChartProps {
  wpVersionStats: WPVersionStats[];
  chartType: ChartType;
}

// Fixed color for releases line
const RELEASES_COLOR = '#757575';

export function TrendBarChart({ wpVersionStats, chartType }: TrendBarChartProps) {
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Transform data for chart - reverse to show oldest to newest
  const chartData = useMemo(() => {
    return [...wpVersionStats].reverse().map((stat) => {
      const baseData: Record<string, string | number> = {
        wpVersion: stat.wpVersion,
        totalPRs: stat.totalPRs,
        releaseCount: stat.releaseCount,
      };

      // Add category totals dynamically
      if (categoryConfig) {
        categoryConfig.aggregations
          .filter((agg) => agg.includeByDefault)
          .forEach((agg) => {
            baseData[`total_${agg.id}`] = stat.categoryTotals?.[agg.id] || 0;
          });
      }

      return baseData;
    });
  }, [wpVersionStats, categoryConfig]);

  // Get default categories for rendering
  const defaultCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
  }, [categoryConfig]);

  // Build legend items
  const legendItems = useMemo(() => {
    const items: Array<{ label: string; color: string; dashed?: boolean }> = [];
    defaultCategories.forEach((agg) => {
      items.push({ label: agg.label, color: agg.color });
    });
    items.push({ label: 'GB releases included', color: RELEASES_COLOR, dashed: true });
    return items;
  }, [defaultCategories]);

  if (!categoryConfig || chartData.length === 0) {
    return null;
  }

  const commonProps = {
    data: chartData,
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
  };

  const renderLegend = () => (
    <Legend
      content={() => (
        <div className="trend-chart-legend">
          {legendItems.map((item) => (
            <div
              key={item.label}
              className="trend-chart-legend-item"
              // eslint-disable-next-line react/forbid-component-props -- dynamic color from data
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

  const renderDataSeries = () => {
    if (chartType === 'bar') {
      return (
        <>
          {defaultCategories.map((agg) => (
            <Bar
              key={agg.id}
              yAxisId="left"
              dataKey={`total_${agg.id}`}
              name={agg.label}
              fill={agg.color}
              opacity={0.8}
            />
          ))}
          <Line
            yAxisId="right"
            type="linear"
            dataKey="releaseCount"
            name="GB releases included"
            stroke={RELEASES_COLOR}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: RELEASES_COLOR }}
            activeDot={{ r: 5, fill: RELEASES_COLOR }}
          />
        </>
      );
    }
    if (chartType === 'stacked') {
      return (
        <>
          {defaultCategories.map((agg) => (
            <Bar
              key={agg.id}
              yAxisId="left"
              dataKey={`total_${agg.id}`}
              name={agg.label}
              fill={agg.color}
              stackId="1"
            />
          ))}
          <Line
            yAxisId="right"
            type="linear"
            dataKey="releaseCount"
            name="GB releases included"
            stroke={RELEASES_COLOR}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: RELEASES_COLOR }}
            activeDot={{ r: 5, fill: RELEASES_COLOR }}
          />
        </>
      );
    }
    if (chartType === 'area') {
      return (
        <>
          {defaultCategories.map((agg) => (
            <Area
              key={agg.id}
              yAxisId="left"
              type="monotone"
              dataKey={`total_${agg.id}`}
              name={agg.label}
              stroke={agg.color}
              fill={agg.color}
              fillOpacity={0.6}
              strokeWidth={2}
              stackId="1"
            />
          ))}
          <Line
            yAxisId="right"
            type="linear"
            dataKey="releaseCount"
            name="GB releases included"
            stroke={RELEASES_COLOR}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: RELEASES_COLOR }}
            activeDot={{ r: 5, fill: RELEASES_COLOR }}
          />
        </>
      );
    }
    // Default: line
    return (
      <>
        {defaultCategories.map((agg) => (
          <Line
            key={agg.id}
            yAxisId="left"
            type="monotone"
            dataKey={`total_${agg.id}`}
            name={agg.label}
            stroke={agg.color}
            strokeWidth={2}
            dot={{ r: 3, fill: agg.color }}
            activeDot={{ r: 5, fill: agg.color }}
          />
        ))}
        <Line
          yAxisId="right"
          type="linear"
          dataKey="releaseCount"
          name="GB releases included"
          stroke={RELEASES_COLOR}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: RELEASES_COLOR }}
          activeDot={{ r: 5, fill: RELEASES_COLOR }}
        />
      </>
    );
  };

  // For bar/stacked chart, we need BarChart to render bars
  // For others, we can use the specific chart type
  const ChartComponent = chartType === 'bar' || chartType === 'stacked' ? BarChart : chartType === 'area' ? AreaChart : LineChart;

  // Show total in tooltip for stacked/area charts
  const showTotalInTooltip = chartType === 'stacked' || chartType === 'area';

  // Custom tooltip content that shows total for stacked charts
  const renderTooltipContent = ({ active, payload, label }: { active?: boolean; payload?: ReadonlyArray<{ name: string; value: number; color: string }>; label?: string | number }) => {
    if (!active || !payload || !payload.length) return null;

    // Separate category data from GB releases count, keep original order
    const categoryPayload = payload.filter((entry) => entry.name !== 'GB releases included');
    const releasesEntry = payload.find((entry) => entry.name === 'GB releases included');

    // Calculate total for stacked charts
    const total = showTotalInTooltip
      ? categoryPayload.reduce((sum, entry) => sum + entry.value, 0)
      : null;

    return (
      <div className="trend-chart-tooltip">
        <div className="trend-chart-tooltip-label">WordPress {label}</div>
        {categoryPayload.map((entry) => (
          <div key={entry.name} className="trend-chart-tooltip-item">
            <span
              className="trend-chart-tooltip-color"
              // eslint-disable-next-line react/forbid-component-props -- dynamic color from chart data
              style={{ backgroundColor: entry.color }}
            />
            <span className="trend-chart-tooltip-name">{entry.name}</span>
            <span className="trend-chart-tooltip-value">{entry.value.toLocaleString()}</span>
          </div>
        ))}
        {total !== null && (
          <div className="trend-chart-tooltip-total">
            <span className="trend-chart-tooltip-name">Total</span>
            <span className="trend-chart-tooltip-value">{total.toLocaleString()}</span>
          </div>
        )}
        {releasesEntry && (
          <div className="trend-chart-tooltip-item trend-chart-tooltip-item--secondary">
            <span
              className="trend-chart-tooltip-color trend-chart-tooltip-color--dashed"
              // eslint-disable-next-line react/forbid-component-props -- dynamic color from chart data
              style={{ backgroundColor: releasesEntry.color }}
            />
            <span className="trend-chart-tooltip-name">{releasesEntry.name}</span>
            <span className="trend-chart-tooltip-value">{releasesEntry.value}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="trend-bar-chart">
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="wpVersion"
            tick={{ fontSize: 12 }}
            tickMargin={8}
            label={{ value: 'WP version', position: 'insideBottom', offset: -5, fontSize: 12 }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            label={{ value: 'PRs', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            label={{ value: 'GB releases', angle: 90, position: 'insideRight', fontSize: 12 }}
          />
          <Tooltip content={renderTooltipContent} />
          {renderLegend()}
          {renderDataSeries()}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
