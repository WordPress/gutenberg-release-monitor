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

interface TrendLineChartProps {
  wpVersionStats: WPVersionStats[];
  chartType: ChartType;
}

// Fixed color for PRs trend line
const PRS_COLOR = '#3858e9';

export function TrendLineChart({ wpVersionStats, chartType }: TrendLineChartProps) {
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Transform data for chart - reverse to show oldest to newest
  const chartData = useMemo(() => {
    return [...wpVersionStats].reverse().map((stat) => {
      const baseData: Record<string, string | number> = {
        wpVersion: stat.wpVersion,
        avgPRs: stat.avgPRsPerRelease,
      };

      // Add category averages dynamically
      if (categoryConfig) {
        categoryConfig.aggregations
          .filter((agg) => agg.includeByDefault)
          .forEach((agg) => {
            const total = stat.categoryTotals?.[agg.id] || 0;
            baseData[`avg_${agg.id}`] = total > 0 ? Math.round(total / stat.releaseCount) : 0;
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

  // Build legend items - no "All PRs" for stacked/area charts
  const legendItems = useMemo(() => {
    const items: Array<{ label: string; color: string }> = [];
    defaultCategories.forEach((agg) => {
      items.push({ label: agg.label, color: agg.color });
    });
    // Only include "All PRs" for line and bar charts (not stacked)
    if (chartType === 'line' || chartType === 'bar') {
      items.push({ label: 'All PRs', color: PRS_COLOR });
    }
    return items;
  }, [defaultCategories, chartType]);

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
              <span className="trend-chart-legend-line" />
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
              dataKey={`avg_${agg.id}`}
              name={agg.label}
              fill={agg.color}
              opacity={0.8}
            />
          ))}
          <Bar
            dataKey="avgPRs"
            name="All PRs"
            fill={PRS_COLOR}
            opacity={0.8}
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
              type="monotone"
              dataKey={`avg_${agg.id}`}
              name={agg.label}
              stroke={agg.color}
              fill={agg.color}
              fillOpacity={0.6}
              strokeWidth={2}
              stackId="1"
            />
          ))}
        </>
      );
    }
    if (chartType === 'stacked') {
      return (
        <>
          {defaultCategories.map((agg) => (
            <Bar
              key={agg.id}
              dataKey={`avg_${agg.id}`}
              name={agg.label}
              fill={agg.color}
              stackId="1"
            />
          ))}
        </>
      );
    }
    // Default: line
    return (
      <>
        {defaultCategories.map((agg) => (
          <Line
            key={agg.id}
            type="monotone"
            dataKey={`avg_${agg.id}`}
            name={agg.label}
            stroke={agg.color}
            strokeWidth={2}
            dot={{ r: 3, fill: agg.color }}
            activeDot={{ r: 5, fill: agg.color }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="avgPRs"
          name="All PRs"
          stroke={PRS_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: PRS_COLOR }}
          activeDot={{ r: 5, fill: PRS_COLOR }}
        />
      </>
    );
  };

  const ChartComponent = chartType === 'bar' || chartType === 'stacked' ? BarChart : chartType === 'area' ? AreaChart : LineChart;

  // Show total in tooltip for stacked/area charts
  const showTotalInTooltip = chartType === 'stacked' || chartType === 'area';

  // Custom tooltip content for stacked charts that shows total
  const renderTooltipContent = ({ active, payload, label }: { active?: boolean; payload?: ReadonlyArray<{ name: string; value: number; color: string }>; label?: string | number }) => {
    if (!active || !payload || !payload.length) return null;

    // Filter out avgPRs for stacked/area, keep original category order
    const filteredPayload = payload.filter((entry) => !(showTotalInTooltip && entry.name === 'All PRs'));

    // Calculate total for stacked charts
    const total = showTotalInTooltip
      ? filteredPayload.reduce((sum, entry) => sum + entry.value, 0)
      : null;

    return (
      <div className="trend-chart-tooltip">
        <div className="trend-chart-tooltip-label">WordPress {label}</div>
        {filteredPayload.map((entry) => (
          <div key={entry.name} className="trend-chart-tooltip-item">
            <span
              className="trend-chart-tooltip-color"
              // eslint-disable-next-line react/forbid-component-props -- dynamic color from chart data
              style={{ backgroundColor: entry.color }}
            />
            <span className="trend-chart-tooltip-name">{entry.name}</span>
            <span className="trend-chart-tooltip-value">{entry.value}</span>
          </div>
        ))}
        {total !== null && (
          <div className="trend-chart-tooltip-total">
            <span className="trend-chart-tooltip-name">Total</span>
            <span className="trend-chart-tooltip-value">{total}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="trend-line-chart">
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
            tick={{ fontSize: 12 }}
            label={{ value: 'PRs', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <Tooltip content={renderTooltipContent} />
          {renderLegend()}
          {renderDataSeries()}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
