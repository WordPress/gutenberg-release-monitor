import { useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CategoryConfig } from '../utils/categories';

interface CategoryPieChartProps {
  categoryTotals: Record<string, number>;
  categoryConfig: CategoryConfig;
  size?: number;
  /** Number of releases (for computing averages in WP Version view) */
  releaseCount?: number;
  /** Currently visible category IDs (for clickable legend) */
  visibleCategories?: string[];
  /** Callback when a category is toggled via legend click */
  onCategoryToggle?: (categoryId: string, isVisible: boolean) => void;
}

interface PieDataPoint {
  id: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
  [key: string]: string | number;
}

/**
 * Distribute percentages ensuring they sum to exactly 100.
 * Uses the "largest remainder" method to handle rounding errors.
 */
function distributePercentages(items: { value: number; [key: string]: unknown }[]): number[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return items.map(() => 0);

  // Calculate exact percentages and their floor values
  const exact = items.map((item) => (item.value / total) * 100);
  const floored = exact.map(Math.floor);
  const remainders = exact.map((e, i) => ({ index: i, remainder: e - floored[i] }));

  // Distribute the remaining percentage points to items with largest remainders
  let remaining = 100 - floored.reduce((a, b) => a + b, 0);
  remainders.sort((a, b) => b.remainder - a.remainder);

  const result = [...floored];
  for (let i = 0; i < remaining; i++) {
    result[remainders[i].index]++;
  }

  return result;
}

export function CategoryPieChart({
  categoryTotals,
  categoryConfig,
  size = 200,
  releaseCount,
  visibleCategories,
  onCategoryToggle,
}: CategoryPieChartProps) {
  // Determine which categories to show based on visibleCategories prop
  const effectiveCategories = useMemo(() => {
    if (visibleCategories && visibleCategories.length > 0) {
      return categoryConfig.aggregations.filter((agg) =>
        visibleCategories.includes(agg.id)
      );
    }
    // Default: show includeByDefault categories
    return categoryConfig.aggregations.filter((agg) => agg.includeByDefault);
  }, [categoryConfig, visibleCategories]);

  // All categories for legend (to allow toggling hidden ones back on)
  const allCategories = useMemo(() => {
    return categoryConfig.aggregations;
  }, [categoryConfig]);

  const chartData = useMemo((): PieDataPoint[] => {
    // Build data points for visible categories only
    const allData = effectiveCategories.map((agg) => ({
      id: agg.id,
      label: agg.label,
      value: categoryTotals[agg.id] || 0,
      color: agg.color,
    }));

    // Check if we have any data
    const hasData = allData.some((point) => point.value > 0);
    if (!hasData) return [];

    // Filter to non-zero for percentage calculation only
    const nonZeroData = allData.filter((point) => point.value > 0);
    const percentages = distributePercentages(nonZeroData);

    // Map percentages back, keeping all categories in order
    let percentageIndex = 0;
    return allData.map((point) => ({
      ...point,
      percentage: point.value > 0 ? percentages[percentageIndex++] : 0,
    }));
  }, [categoryTotals, effectiveCategories]);

  const handleLegendClick = useCallback(
    (categoryId: string) => {
      if (!onCategoryToggle) return;
      const isCurrentlyVisible = visibleCategories
        ? visibleCategories.includes(categoryId)
        : categoryConfig.aggregations.find((a) => a.id === categoryId)?.includeByDefault ?? false;
      onCategoryToggle(categoryId, !isCurrentlyVisible);
    },
    [onCategoryToggle, visibleCategories, categoryConfig]
  );

  if (chartData.length === 0) {
    return null;
  }

  // Filter to non-zero values only for the pie chart
  const pieSliceData = chartData.filter((item) => item.value > 0);

  // Reorder for pie slices: Bug Fixes first, Features last (so they appear near top)
  const pieData = [...pieSliceData].sort((a, b) => {
    // Bug Fixes should be first (index 0)
    if (a.label === 'Bug Fixes') return -1;
    if (b.label === 'Bug Fixes') return 1;
    // Features should be last
    if (a.label === 'Features') return 1;
    if (b.label === 'Features') return -1;
    // Keep others in original order
    return 0;
  });

  // Build legend data from ALL categories (to allow toggling hidden ones)
  const legendData = useMemo(() => {
    return allCategories.map((agg) => {
      const isVisible = visibleCategories
        ? visibleCategories.includes(agg.id)
        : agg.includeByDefault;
      const dataPoint = chartData.find((d) => d.id === agg.id);
      const total = categoryTotals[agg.id] || 0;
      // Calculate percentage from visible categories only
      const visibleTotal = effectiveCategories.reduce(
        (sum, cat) => sum + (categoryTotals[cat.id] || 0),
        0
      );
      const percentage = visibleTotal > 0 ? Math.round((total / visibleTotal) * 100) : 0;
      return {
        id: agg.id,
        label: agg.label,
        color: agg.color,
        value: total,
        percentage: dataPoint?.percentage ?? percentage,
        isVisible,
        hasData: total > 0,
      };
    });
  }, [allCategories, visibleCategories, chartData, categoryTotals, effectiveCategories]);

  const isClickable = !!onCategoryToggle;

  return (
    <div className="category-pie-chart">
      <div className="category-pie-chart-recharts">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="label"
              cx="40%"
              cy="50%"
              innerRadius={0}
              outerRadius={size / 2 - 10}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationBegin={0}
              animationDuration={150}
              stroke="none"
            >
              {pieData.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload as PieDataPoint;
                const avg = releaseCount ? Math.round(data.value / releaseCount) : null;
                return (
                  <div className="category-pie-tooltip">
                    <div
                      className="category-pie-tooltip-label"
                      // eslint-disable-next-line react/forbid-component-props -- dynamic color from data
                      style={{ color: data.color }}
                    >
                      {data.label}
                    </div>
                    <div className="category-pie-tooltip-value">
                      {avg !== null ? (
                        <>{avg.toLocaleString()} avg, {data.value.toLocaleString()} total ({data.percentage}%)</>
                      ) : (
                        <>{data.value.toLocaleString()} PRs ({data.percentage}%)</>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              content={() => (
                <div className={`category-pie-legend category-pie-legend--side${isClickable ? ' category-pie-legend--clickable' : ''}`}>
                  {legendData.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`category-pie-legend-item${!item.isVisible ? ' category-pie-legend-item--hidden' : ''}${!item.hasData ? ' category-pie-legend-item--no-data' : ''}`}
                      // eslint-disable-next-line react/forbid-component-props -- dynamic color from data
                      style={{ '--legend-color': item.color } as React.CSSProperties}
                      onClick={() => handleLegendClick(item.id)}
                      disabled={!isClickable}
                      title={isClickable ? `Click to ${item.isVisible ? 'hide' : 'show'} ${item.label}` : undefined}
                    >
                      <span className="category-pie-legend-color" />
                      <span className="category-pie-legend-label">{item.label}</span>
                      {item.isVisible && item.hasData && (
                        <span className="category-pie-legend-value">{item.percentage}%</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
