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

interface TrendDistributionChartProps {
  wpVersionStats: WPVersionStats[];
  chartType: ChartType;
}

export function TrendDistributionChart({ wpVersionStats, chartType }: TrendDistributionChartProps) {
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Transform data for chart - reverse to show oldest to newest, calculate percentages
  const chartData = useMemo(() => {
    if (!categoryConfig) return [];

    const defaultCategories = categoryConfig.aggregations.filter((agg) => agg.includeByDefault);

    return [...wpVersionStats].reverse().map((stat) => {
      // Calculate total of all default categories for this version
      const totalCategorySum = defaultCategories.reduce((sum, agg) => {
        return sum + (stat.categoryTotals?.[agg.id] || 0);
      }, 0);

      const baseData: Record<string, string | number> = {
        wpVersion: stat.wpVersion,
      };

      // Add category percentages dynamically
      defaultCategories.forEach((agg) => {
        const value = stat.categoryTotals?.[agg.id] || 0;
        const percentage = totalCategorySum > 0 ? (value / totalCategorySum) * 100 : 0;
        baseData[`pct_${agg.id}`] = Math.round(percentage * 10) / 10; // Round to 1 decimal
      });

      return baseData;
    });
  }, [wpVersionStats, categoryConfig]);

  // Get default categories for rendering
  const defaultCategories = useMemo(() => {
    if (!categoryConfig) return [];
    return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
  }, [categoryConfig]);

  // Build legend items - no "All PRs" for distribution (always 100%)
  const legendItems = useMemo(() => {
    return defaultCategories.map((agg) => ({
      label: agg.label,
      color: agg.color,
    }));
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
              dataKey={`pct_${agg.id}`}
              name={agg.label}
              fill={agg.color}
              opacity={0.8}
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
              dataKey={`pct_${agg.id}`}
              name={agg.label}
              fill={agg.color}
              stackId="1"
            />
          ))}
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
              dataKey={`pct_${agg.id}`}
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
    // Default: line
    return (
      <>
        {defaultCategories.map((agg) => (
          <Line
            key={agg.id}
            type="monotone"
            dataKey={`pct_${agg.id}`}
            name={agg.label}
            stroke={agg.color}
            strokeWidth={2}
            dot={{ r: 3, fill: agg.color }}
            activeDot={{ r: 5, fill: agg.color }}
          />
        ))}
      </>
    );
  };

  const ChartComponent = chartType === 'bar' || chartType === 'stacked' ? BarChart : chartType === 'area' ? AreaChart : LineChart;

  // Show total in tooltip for stacked/area charts
  const showTotalInTooltip = chartType === 'stacked' || chartType === 'area';

  // Custom tooltip content that shows total for stacked charts
  const renderTooltipContent = ({ active, payload, label }: { active?: boolean; payload?: ReadonlyArray<{ name: string; value: number; color: string }>; label?: string | number }) => {
    if (!active || !payload || !payload.length) return null;

    // Keep original category order (no sorting)
    const total = showTotalInTooltip
      ? payload.reduce((sum, entry) => sum + entry.value, 0)
      : null;

    return (
      <div className="trend-chart-tooltip">
        <div className="trend-chart-tooltip-label">WordPress {label}</div>
        {payload.map((entry) => (
          <div key={entry.name} className="trend-chart-tooltip-item">
            <span
              className="trend-chart-tooltip-color"
              // eslint-disable-next-line react/forbid-component-props -- dynamic color from chart data
              style={{ backgroundColor: entry.color }}
            />
            <span className="trend-chart-tooltip-name">{entry.name}</span>
            <span className="trend-chart-tooltip-value">{entry.value.toFixed(1)}%</span>
          </div>
        ))}
        {total !== null && (
          <div className="trend-chart-tooltip-total">
            <span className="trend-chart-tooltip-name">Total</span>
            <span className="trend-chart-tooltip-value">{total.toFixed(0)}%</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="trend-distribution-chart">
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
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <Tooltip content={renderTooltipContent} />
          {renderLegend()}
          {renderDataSeries()}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
