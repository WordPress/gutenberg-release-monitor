import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CategoryConfig } from '../utils/categories';

interface CategoryPieChartProps {
  categoryTotals: Record<string, number>;
  categoryConfig: CategoryConfig;
  size?: number;
}

interface PieDataPoint {
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
}: CategoryPieChartProps) {
  const chartData = useMemo((): PieDataPoint[] => {
    // Filter to includeByDefault categories only, keeping config order
    const defaultCategories = categoryConfig.aggregations.filter(
      (agg) => agg.includeByDefault
    );

    // Build data points for ALL categories (keep consistent order for pie positioning)
    const allData = defaultCategories.map((agg) => ({
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
  }, [categoryTotals, categoryConfig]);

  if (chartData.length === 0) {
    return null;
  }

  // Filter to non-zero values only - this is the legend order (original config order)
  const legendData = chartData.filter((item) => item.value > 0);

  // Reorder for pie slices: Bug Fixes first, Features last (so they appear near top)
  const pieData = [...legendData].sort((a, b) => {
    // Bug Fixes should be first (index 0)
    if (a.label === 'Bug Fixes') return -1;
    if (b.label === 'Bug Fixes') return 1;
    // Features should be last
    if (a.label === 'Features') return 1;
    if (b.label === 'Features') return -1;
    // Keep others in original order
    return 0;
  });

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
                      {data.value.toLocaleString()} PRs ({data.percentage}%)
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
                <div className="category-pie-legend category-pie-legend--side">
                  {legendData.map((item) => (
                    <div
                      key={item.label}
                      className="category-pie-legend-item"
                      // eslint-disable-next-line react/forbid-component-props -- dynamic color from data
                      style={{ '--legend-color': item.color } as React.CSSProperties}
                    >
                      <span className="category-pie-legend-color" />
                      <span className="category-pie-legend-label">{item.label}</span>
                      <span className="category-pie-legend-value">{item.percentage}%</span>
                    </div>
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
