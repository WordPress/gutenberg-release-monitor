import { useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CategoryConfig } from '../utils/categories';

type BreakdownType = 'categories' | 'sponsors' | 'countries';

interface CategoryPieChartProps {
  /** Type of breakdown being displayed */
  breakdownType?: BreakdownType;
  /** Generic breakdown data (for sponsors/countries) */
  breakdownData?: Record<string, number>;
  /** Category totals (for categories breakdown) */
  categoryTotals: Record<string, number>;
  categoryConfig: CategoryConfig;
  size?: number;
  /** Number of releases (for computing averages in WP Version view) */
  releaseCount?: number;
  /** Currently visible category IDs (for clickable legend) - only applies to categories */
  visibleCategories?: string[];
  /** Callback when a category is toggled via legend click - only applies to categories */
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
  const remaining = 100 - floored.reduce((a, b) => a + b, 0);
  remainders.sort((a, b) => b.remainder - a.remainder);

  const result = [...floored];
  for (let i = 0; i < remaining; i++) {
    result[remainders[i].index]++;
  }

  return result;
}

// Predefined color palette for sponsor/country breakdowns
const BREAKDOWN_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#00BCD4', '#E91E63', '#8BC34A', '#FF5722', '#3F51B5',
  '#CDDC39', '#795548', '#607D8B', '#009688', '#FFC107',
];

export function CategoryPieChart({
  breakdownType = 'categories',
  breakdownData,
  categoryTotals,
  categoryConfig,
  size = 200,
  releaseCount,
  visibleCategories,
  onCategoryToggle,
}: CategoryPieChartProps) {
  // Determine if we're showing categories or sponsor/country breakdown
  const isCategories = breakdownType === 'categories';
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
    if (isCategories) {
      // Category breakdown: use categoryConfig for structure and colors
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
    }

    // Sponsor/Country breakdown: use breakdownData directly
    const data = breakdownData ?? {};
    const entries = Object.entries(data);
    if (entries.length === 0) return [];

    // Sort by value descending, but keep "Unknown" at the end
    const sorted = entries.sort(([aKey, aVal], [bKey, bVal]) => {
      if (aKey === 'Unknown') return 1;
      if (bKey === 'Unknown') return -1;
      return bVal - aVal;
    });

    // Limit to top N items + "Others" for readability (pie charts work best with 5-7 segments)
    const MAX_ITEMS = 8;
    let displayItems: Array<[string, number]>;
    let othersValue = 0;

    if (sorted.length > MAX_ITEMS) {
      displayItems = sorted.slice(0, MAX_ITEMS - 1);
      // Sum up the rest as "Others"
      othersValue = sorted.slice(MAX_ITEMS - 1).reduce((sum, [, val]) => sum + val, 0);
    } else {
      displayItems = sorted;
    }

    // Build data points with generated colors
    const allData = displayItems.map(([label, value], index) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      value,
      color: label === 'Unknown' ? '#9E9E9E' : BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
    }));

    // Add "Others" if needed
    if (othersValue > 0) {
      allData.push({
        id: 'others',
        label: 'Others',
        value: othersValue,
        color: '#BDBDBD',
      });
    }

    // Calculate percentages
    const nonZeroData = allData.filter((point) => point.value > 0);
    const percentages = distributePercentages(nonZeroData);

    let percentageIndex = 0;
    return allData.map((point) => ({
      ...point,
      percentage: point.value > 0 ? percentages[percentageIndex++] : 0,
    }));
  }, [isCategories, categoryTotals, effectiveCategories, breakdownData]);

  const handleLegendClick = useCallback(
    (itemId: string) => {
      // Only allow toggling for categories breakdown
      if (!isCategories || !onCategoryToggle) return;
      const isCurrentlyVisible = visibleCategories
        ? visibleCategories.includes(itemId)
        : categoryConfig.aggregations.find((a) => a.id === itemId)?.includeByDefault ?? false;
      onCategoryToggle(itemId, !isCurrentlyVisible);
    },
    [isCategories, onCategoryToggle, visibleCategories, categoryConfig]
  );

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

  // Build legend data - different structure for categories vs sponsor/country
  const legendData = useMemo(() => {
    if (isCategories) {
      // For categories: show ALL categories (to allow toggling hidden ones)
      return allCategories.map((agg) => {
        const isVisible = visibleCategories
          ? visibleCategories.includes(agg.id)
          : agg.includeByDefault;
        // Find percentage from chartData (which uses distributePercentages)
        const dataPoint = chartData.find((d) => d.id === agg.id);
        const total = categoryTotals[agg.id] || 0;
        return {
          id: agg.id,
          label: agg.label,
          color: agg.color,
          value: total,
          // Use chartData percentage if available (visible category), otherwise 0
          percentage: dataPoint?.percentage ?? 0,
          isVisible,
          hasData: total > 0,
        };
      });
    }

    // For sponsor/country: use chartData directly (already processed)
    return chartData.map((point) => ({
      id: point.id,
      label: point.label,
      color: point.color,
      value: point.value,
      percentage: point.percentage,
      isVisible: true, // All items are visible for sponsor/country
      hasData: point.value > 0,
    }));
  }, [isCategories, allCategories, visibleCategories, chartData, categoryTotals]);

  // Only categories support toggle filtering
  const isClickable = isCategories && !!onCategoryToggle;

  // Check if contributor data is unavailable for sponsor/country breakdown
  const isContributorDataUnavailable = !isCategories &&
    (!breakdownData || Object.keys(breakdownData).length === 0);

  // Show "Not available" state for sponsor/country when no data
  if (isContributorDataUnavailable) {
    return (
      <div className="category-pie-chart">
        <div className="category-pie-chart-unavailable">
          <span className="category-pie-chart-unavailable-text">Not available</span>
          <span className="category-pie-chart-unavailable-subtext">
            Contributor data not yet computed for this {breakdownType === 'sponsors' ? 'sponsor' : 'country'} breakdown
          </span>
        </div>
      </div>
    );
  }

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
              animationDuration={400}
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

                // Different labels for different breakdown types
                const unitLabel = isCategories ? 'PRs' : 'contributors';

                return (
                  <div className="category-pie-tooltip">
                    <div
                      className="category-pie-tooltip-label"
                      style={{ color: data.color }}
                    >
                      {data.label}
                    </div>
                    <div className="category-pie-tooltip-value">
                      {avg !== null && isCategories ? (
                        <>{avg.toLocaleString()} avg, {data.value.toLocaleString()} total ({data.percentage}%)</>
                      ) : (
                        <>{data.value.toLocaleString()} {unitLabel} ({data.percentage}%)</>
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
                      style={{ '--legend-color': item.color } as React.CSSProperties}
                      onClick={() => handleLegendClick(item.id)}
                      disabled={!isClickable}
                      title={isClickable ? `Click to ${item.isVisible ? 'hide' : 'show'} ${item.label}` : undefined}
                    >
                      <span className="category-pie-legend-color" />
                      <span className="category-pie-legend-label">{item.label}</span>
                      <span
                        className={`category-pie-legend-value${!item.isVisible || !item.hasData ? ' category-pie-legend-value--hidden' : ''}`}
                      >
                        {item.percentage}%
                      </span>
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
