import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
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
import type { NormalizedRelease } from '../data/normalized';
import type { ViewMode, ChartType, MetricType, TabConfig } from '../config/types';
import { useConfig } from '../config';
import { loadCategoryConfig, aggregateCategories, type CategoryConfig } from '../utils/categories';

interface TrendChartProps {
  viewMode: ViewMode;
  chartType: ChartType;
  /** Metric type: PRs or Contributors */
  metric: MetricType;
  /** Category IDs to display (default: all default categories) */
  visibleCategories?: string[];
  /** Callback when a category is toggled via legend click */
  onCategoryToggle?: (categoryId: string, isVisible: boolean) => void;
  /** Tab configuration for display labels and data behavior */
  tabConfig: TabConfig;
  /** Normalized release data */
  data: NormalizedRelease[];
  /** Number of releases to show (default: all) */
  releaseCount?: number;
}

// Fixed colors
const PRS_COLOR = '#3858e9';
const RELEASES_COLOR = '#757575';
const CONTRIBUTORS_COLOR = '#4CAF50';
const NEW_CONTRIBUTORS_COLOR = '#FF9800';
const RETURNING_CONTRIBUTORS_COLOR = '#2196F3';

// Color palette for sponsor/country breakdown charts
// Note: Blue shades excluded since Automattic uses blue (#3499CD)
const BREAKDOWN_COLORS = [
  '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4',
  '#E91E63', '#8BC34A', '#FF5722', '#CDDC39', '#795548',
  '#607D8B', '#009688', '#FFC107', '#673AB7', '#3F51B5',
];
const UNKNOWN_COLOR = '#757575'; // Dark gray - distinct from "Other" (#9E9E9E)

// Fixed colors for specific sponsors
const SPONSOR_COLORS: Record<string, string> = {
  Automattic: '#3499CD', // Automattic logo blue
  Unknown: UNKNOWN_COLOR,
};
const OTHER_COLOR = '#9E9E9E'; // Same as "Other" category
const MAX_BREAKDOWN_ITEMS = 10;

export function TrendChart(props: TrendChartProps) {
  const { viewMode, chartType, data, visibleCategories, onCategoryToggle, metric, releaseCount, tabConfig } = props;
  const config = useConfig();
  const isContributorMetric = metric === 'contributors';
  const isSponsorBreakdown = viewMode === 'sponsors';
  const isCountryBreakdown = viewMode === 'countries';
  const isBreakdownMode = isSponsorBreakdown || isCountryBreakdown;

  // Get labels from config (no domain-specific inference)
  const versionPrefix = tabConfig?.versionPrefix ?? config.project.projectLabel;
  const childItemLabel = tabConfig?.labels?.childItem ?? `${config.project.projectLabel} release`;
  const parentVersionPrefix = tabConfig?.labels?.parentVersionPrefix ?? '';

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);
  // Local state for hidden breakdown items (resets when view mode changes)
  const [hiddenBreakdownItems, setHiddenBreakdownItems] = useState<Set<string>>(new Set());
  // Local state for hiding "All PRs" line
  const [showAllPRs, setShowAllPRs] = useState(true);
  const prevViewModeRef = useRef(viewMode);

  useEffect(() => {
    loadCategoryConfig().then(setCategoryConfig);
  }, []);

  // Reset hidden items when view mode changes
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      prevViewModeRef.current = viewMode;
      /* eslint-disable react-hooks/set-state-in-effect -- Intentional reset on prop change, safe with ref guard */
      setHiddenBreakdownItems(new Set());
      setShowAllPRs(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [viewMode]);

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

    const displayedData = releaseCount ? data.slice(0, releaseCount) : data;
    displayedData.forEach((item) => {
      const breakdown = item.contributorAggregates?.[breakdownKey];
      if (breakdown) {
        Object.entries(breakdown).forEach(([key, value]) => {
          totals[key] = (totals[key] || 0) + value;
        });
      }
    });

    // Separate Unknown from other items BEFORE processing
    const unknownTotal = totals['Unknown'] || 0;
    const hasUnknown = unknownTotal > 0;

    // Sort non-Unknown items by value descending
    const nonUnknownEntries = Object.entries(totals).filter(([key]) => key !== 'Unknown');
    const sortedNonUnknown = nonUnknownEntries.sort(([, aVal], [, bVal]) => bVal - aVal);

    // Calculate available slots: MAX minus reserved for Unknown
    const availableForNonUnknown = MAX_BREAKDOWN_ITEMS - (hasUnknown ? 1 : 0);

    // Determine if we need "Others" and how many top items to show
    const needsOthers = sortedNonUnknown.length > availableForNonUnknown;
    const topItemsCount = needsOthers ? availableForNonUnknown - 1 : sortedNonUnknown.length;

    const topItems = sortedNonUnknown.slice(0, topItemsCount);
    const othersTotal = needsOthers
      ? sortedNonUnknown.slice(topItemsCount).reduce((sum, [, val]) => sum + val, 0)
      : 0;
    const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

    const result: Array<{ id: string; label: string; color: string; total: number; percentage: number }> = topItems.map(([label, total], index) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      color: SPONSOR_COLORS[label] ?? BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
      total,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0,
    }));

    if (othersTotal > 0) {
      result.push({
        id: 'other',
        label: 'Other',
        color: OTHER_COLOR,
        total: othersTotal,
        percentage: grandTotal > 0 ? Math.round((othersTotal / grandTotal) * 1000) / 10 : 0,
      });
    }

    if (hasUnknown) {
      result.push({
        id: 'unknown',
        label: 'Unknown',
        color: SPONSOR_COLORS['Unknown'],
        total: unknownTotal,
        percentage: grandTotal > 0 ? Math.round((unknownTotal / grandTotal) * 1000) / 10 : 0,
      });
    }

    return result;
  }, [isBreakdownMode, isSponsorBreakdown, data, releaseCount]);

  // Configuration based on tabConfig (no isAggregated checks)
  const chartConfig = useMemo(() => {
    // Use chartSecondaryLabel from config if available, otherwise compute from childItemLabel
    const childReleasesLabel = tabConfig?.labels?.chartSecondaryLabel ?? `${childItemLabel}s included`;

    return {
      // Use version field directly (already in display format)
      xKey: 'version',
      xLabel: `${versionPrefix} version`,
      tooltipPrefix: versionPrefix,
      // Show releases line only for totals view when data has groupedCount (determined at render time)
      showReleasesLine: viewMode === 'totals',
      childReleasesLabel,
      tickInterval: 0,
      xAxisAngle: 0,
      xAxisHeight: 30,
    };
  }, [viewMode, versionPrefix, childItemLabel, tabConfig?.labels?.chartSecondaryLabel]);

  // Transform normalized data for chart
  const chartData = useMemo(() => {
    if (!categoryConfig) return [];

    // Filter items that don't have data for the current mode
    const filteredData = data.filter((item) => {
      if (isSponsorBreakdown) {
        return item.contributorAggregates?.sponsorBreakdown &&
          Object.keys(item.contributorAggregates.sponsorBreakdown).length > 0;
      }
      if (isBreakdownMode) { // countries
        return item.contributorAggregates?.countryBreakdown &&
          Object.keys(item.contributorAggregates.countryBreakdown).length > 0;
      }
      // For PR modes, check category data
      if (!isContributorMetric) {
        const categories = item.categoryTotals || item.rawCategories;
        return categories && Object.values(categories).some(v => v > 0);
      }
      return true;
    });

    // Data is sorted newest-first; reverse for chronological display, then slice
    const displayedData = releaseCount
      ? [...filteredData].slice(0, releaseCount).reverse()
      : [...filteredData].reverse();

    return displayedData.map((item) => {
      const baseData: Record<string, string | number | boolean> = {
        [chartConfig.xKey]: item.version,
        isSpecialMarker: item.isSpecialMarker ?? false,
        memberOf: item.memberOf ?? '',
      };

      // Add groupedCount for aggregated items (used for secondary axis)
      if (item.groupedCount !== undefined) {
        baseData.releaseCount = item.groupedCount;
      }

      if (isBreakdownMode) {
        // Sponsor/country breakdown
        const breakdownKey = isSponsorBreakdown ? 'sponsorBreakdown' : 'countryBreakdown';
        const breakdown = item.contributorAggregates?.[breakdownKey] || {};
        const topLabels = topBreakdownItems.filter((i) => i.label !== 'Other' && i.label !== 'Unknown').map((i) => i.label);
        let othersTotal = 0;

        topBreakdownItems.forEach((breakdownItem) => {
          if (breakdownItem.label === 'Other') {
            Object.entries(breakdown).forEach(([key, value]) => {
              if (!topLabels.includes(key) && key !== 'Unknown') {
                othersTotal += value;
              }
            });
            baseData[breakdownItem.id] = othersTotal;
          } else if (breakdownItem.label === 'Unknown') {
            baseData[breakdownItem.id] = breakdown['Unknown'] || 0;
          } else {
            baseData[breakdownItem.id] = breakdown[breakdownItem.label] || 0;
          }
        });
      } else if (isContributorMetric) {
        // Contributor metrics - use pre-computed fields from normalization layer
        const contributors = viewMode === 'totals' ? item.contributors : item.avgContributors;
        const newContributors = viewMode === 'totals' ? item.newContributors : item.avgNewContributors;
        baseData.contributors = contributors;
        baseData.newContributors = newContributors;
        baseData.returningContributors = Math.round(contributors - newContributors);
      } else {
        // PR metrics - aggregate categories (normalization handles raw vs pre-aggregated)
        const categories = item.categoryTotals
          ? item.categoryTotals
          : item.rawCategories
            ? aggregateCategories(item.rawCategories, categoryConfig)
            : {};

        if (viewMode === 'distribution') {
          const totalCategorySum = defaultCategories.reduce((sum, agg) => {
            return sum + (categories[agg.id] || 0);
          }, 0);
          defaultCategories.forEach((agg) => {
            const value = categories[agg.id] || 0;
            const percentage = totalCategorySum > 0 ? (value / totalCategorySum) * 100 : 0;
            baseData[`pct_${agg.id}`] = Math.round(percentage * 10) / 10;
          });
        } else if (viewMode === 'totals') {
          baseData.totalPRs = item.totalPRs;
          defaultCategories.forEach((agg) => {
            baseData[agg.id] = categories[agg.id] || 0;
          });
        } else {
          // Averages: use pre-computed avgPRs, compute category avg using groupedCount
          baseData.totalPRs = item.avgPRs;
          defaultCategories.forEach((agg) => {
            const total = categories[agg.id] || 0;
            // groupedCount only exists for aggregated items; individual items use totals
            baseData[agg.id] = item.groupedCount ? Math.round(total / item.groupedCount) : total;
          });
        }
      }

      return baseData;
    });
  }, [data, categoryConfig, viewMode, defaultCategories, releaseCount, isContributorMetric, isBreakdownMode, isSponsorBreakdown, topBreakdownItems, chartConfig.xKey]);

  // Automatically filter X-axis to show only X.0 versions when there are many data points
  const XAXIS_DENSITY_THRESHOLD = 15;
  const shouldFilterToMinorZero = chartData.length > XAXIS_DENSITY_THRESHOLD;

  const xAxisTicks = useMemo(() => {
    if (!shouldFilterToMinorZero || chartData.length === 0) {
      return undefined; // Let Recharts auto-calculate
    }
    // Filter to only X.0 and X.5 versions for cleaner display
    return chartData
      .map((point) => (point as Record<string, unknown>)[chartConfig.xKey] as string)
      .filter((version) => version.endsWith('.0') || version.endsWith('.5'));
  }, [chartData, shouldFilterToMinorZero, chartConfig.xKey]);

  // Build legend items - include ALL categories for clickable legend
  const legendItems = useMemo(() => {
    const items: Array<{ id: string; label: string; color: string; dashed?: boolean; isVisible: boolean; isCategory: boolean; isBreakdown: boolean; isAllPRs?: boolean }> = [];

    if (isBreakdownMode) {
      // Sponsor/country breakdown: show top items as legend (toggleable)
      topBreakdownItems.forEach((item) => {
        const isVisible = !hiddenBreakdownItems.has(item.id);
        items.push({ id: item.id, label: item.label, color: item.color, isVisible, isCategory: false, isBreakdown: true });
      });
    } else if (isContributorMetric) {
      // Contributor mode: show contributor legend items
      // For stacked/area, show returning + new; for line/bar, show total + new
      const isStackedChart = chartType === 'stacked' || chartType === 'area';
      if (isStackedChart) {
        items.push({ id: 'returningContributors', label: 'Returning Contributors', color: RETURNING_CONTRIBUTORS_COLOR, isVisible: true, isCategory: false, isBreakdown: false });
        items.push({ id: 'newContributors', label: 'New Contributors', color: NEW_CONTRIBUTORS_COLOR, isVisible: true, isCategory: false, isBreakdown: false });
      } else {
        items.push({ id: 'contributors', label: 'Total Contributors', color: CONTRIBUTORS_COLOR, isVisible: true, isCategory: false, isBreakdown: false });
        items.push({ id: 'newContributors', label: 'New Contributors', color: NEW_CONTRIBUTORS_COLOR, isVisible: true, isCategory: false, isBreakdown: false });
      }
    } else {
      // PR mode: show category legend items
      if (categoryConfig) {
        categoryConfig.aggregations.forEach((agg) => {
          const isVisible = visibleCategories
            ? visibleCategories.includes(agg.id)
            : agg.includeByDefault;
          items.push({ id: agg.id, label: agg.labels.full, color: agg.color, isVisible, isCategory: true, isBreakdown: false });
        });
      }

      // Show "All PRs" for line/bar in non-distribution mode (toggleable)
      if (viewMode !== 'distribution' && (chartType === 'line' || chartType === 'bar')) {
        items.push({ id: 'allPRs', label: 'All PRs', color: PRS_COLOR, isVisible: showAllPRs, isCategory: false, isBreakdown: false, isAllPRs: true });
      }
    }

    // Show releases count for aggregated totals mode
    if (chartConfig.showReleasesLine) {
      items.push({ id: 'releases', label: chartConfig.childReleasesLabel, color: RELEASES_COLOR, dashed: true, isVisible: true, isCategory: false, isBreakdown: false });
    }
    return items;
  }, [categoryConfig, visibleCategories, chartType, viewMode, chartConfig.showReleasesLine, chartConfig.childReleasesLabel, isContributorMetric, isBreakdownMode, topBreakdownItems, hiddenBreakdownItems, showAllPRs]);

  const handleLegendClick = useCallback(
    (itemId: string) => {
      const item = legendItems.find((i) => i.id === itemId);
      if (!item) return;

      // Handle category toggle (via parent callback)
      if (item.isCategory && onCategoryToggle) {
        onCategoryToggle(itemId, !item.isVisible);
        return;
      }

      // Handle "All PRs" toggle (local state)
      if (item.isAllPRs) {
        setShowAllPRs((prev) => !prev);
        return;
      }

      // Handle breakdown item toggle (local state)
      if (item.isBreakdown) {
        setHiddenBreakdownItems((prev) => {
          const next = new Set(prev);
          if (next.has(itemId)) {
            next.delete(itemId);
          } else {
            // Don't allow hiding the last visible item
            const visibleCount = topBreakdownItems.filter((i) => !prev.has(i.id)).length;
            if (visibleCount > 1) {
              next.add(itemId);
            }
          }
          return next;
        });
      }
    },
    [onCategoryToggle, legendItems, topBreakdownItems]
  );

  // Legend items are clickable when there's a category toggle callback, breakdown mode, or All PRs is shown
  const hasAllPRsToggle = legendItems.some((item) => item.isAllPRs);
  const isClickable = !!onCategoryToggle || isBreakdownMode || hasAllPRsToggle;

  // Get marked versions for reference lines (controlled by config)
  // Must be before early return to maintain consistent hook order
  const referenceMarkers = useMemo((): Array<{ version: string; label: string }> => {
    if (!tabConfig.showReferenceLines) return [];
    return chartData
      .filter((point) => point.isSpecialMarker)
      .map((point) => ({
        version: point[chartConfig.xKey] as string,
        label: point.memberOf as string,
      }));
  }, [chartData, tabConfig.showReferenceLines, chartConfig.xKey]);

  if (!categoryConfig || chartData.length === 0) {
    return null;
  }

  const commonProps = {
    data: chartData,
    margin: { top: 20, right: chartConfig.showReleasesLine ? 50 : 30, left: 20, bottom: 5 },
  };

  const renderLegend = () => (
    <Legend
      content={() => (
        <div className={`trend-chart-legend${isClickable ? ' trend-chart-legend--clickable' : ''}`}>
          {legendItems.map((item) => {
            const isToggleable = item.isCategory || item.isBreakdown || item.isAllPRs;
            const isItemClickable = isClickable && isToggleable;
            return (
              <button
                type="button"
                key={item.id}
                className={`trend-chart-legend-item${!item.isVisible ? ' trend-chart-legend-item--hidden' : ''}${!isToggleable ? ' trend-chart-legend-item--fixed' : ''}`}
                style={{ '--legend-color': item.color } as React.CSSProperties}
                onClick={() => handleLegendClick(item.id)}
                disabled={!isItemClickable}
                title={isItemClickable ? `Click to ${item.isVisible ? 'hide' : 'show'} ${item.label}` : undefined}
              >
                <span className={`trend-chart-legend-line${item.dashed ? ' trend-chart-legend-line--dashed' : ''}`} />
                <span className="trend-chart-legend-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    />
  );

  const getDataKey = (categoryId: string) => {
    return viewMode === 'distribution' ? `pct_${categoryId}` : categoryId;
  };

  const usesDualAxis = chartConfig.showReleasesLine;

  const renderDataSeries = () => {
    // Always use 'left' yAxisId for consistent DOM structure (prevents remounting)
    const yAxisId = 'left' as const;

    // Sponsor/country breakdown mode
    if (isBreakdownMode) {
      // Filter out hidden breakdown items
      const visibleBreakdownItems = topBreakdownItems.filter((item) => !hiddenBreakdownItems.has(item.id));

      const releasesLine = chartConfig.showReleasesLine && (
        <Line
          yAxisId="right"
          type="linear"
          dataKey="releaseCount"
          name={chartConfig.childReleasesLabel}
          stroke={RELEASES_COLOR}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: RELEASES_COLOR }}
        />
      );

      if (chartType === 'bar') {
        return (
          <>
            {visibleBreakdownItems.map((item) => (
              <Bar key={item.id} yAxisId={yAxisId} dataKey={item.id} name={item.label} fill={item.color} opacity={0.8} />
            ))}
            {releasesLine}
          </>
        );
      }
      if (chartType === 'stacked') {
        return (
          <>
            {visibleBreakdownItems.map((item) => (
              <Bar key={item.id} yAxisId={yAxisId} dataKey={item.id} name={item.label} fill={item.color} stackId="breakdown" />
            ))}
            {releasesLine}
          </>
        );
      }
      if (chartType === 'area') {
        return (
          <>
            {visibleBreakdownItems.map((item) => (
              <Area key={item.id} yAxisId={yAxisId} type="monotone" dataKey={item.id} name={item.label} stroke={item.color} fill={item.color} fillOpacity={0.6} strokeWidth={2} stackId="breakdown" />
            ))}
            {releasesLine}
          </>
        );
      }
      // Default: line
      return (
        <>
          {visibleBreakdownItems.map((item) => (
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
      const releasesLine = chartConfig.showReleasesLine && (
        <Line
          yAxisId="right"
          type="linear"
          dataKey="releaseCount"
          name={chartConfig.childReleasesLabel}
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
              name={agg.labels.full}
              fill={agg.color}
              opacity={0.8}
            />
          ))}
          {viewMode !== 'distribution' && showAllPRs && (
            <Bar yAxisId={yAxisId} dataKey="totalPRs" name="All PRs" fill={PRS_COLOR} opacity={0.8} />
          )}
          {chartConfig.showReleasesLine && (
            <Line
              yAxisId="right"
              type="linear"
              dataKey="releaseCount"
              name={chartConfig.childReleasesLabel}
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
              name={agg.labels.full}
              fill={agg.color}
              stackId="1"
            />
          ))}
          {chartConfig.showReleasesLine && (
            <Line
              yAxisId="right"
              type="linear"
              dataKey="releaseCount"
              name={chartConfig.childReleasesLabel}
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
              name={agg.labels.full}
              stroke={agg.color}
              fill={agg.color}
              fillOpacity={0.6}
              strokeWidth={2}
              stackId="1"
            />
          ))}
          {chartConfig.showReleasesLine && (
            <Line
              yAxisId="right"
              type="linear"
              dataKey="releaseCount"
              name={chartConfig.childReleasesLabel}
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
            name={agg.labels.full}
            stroke={agg.color}
            strokeWidth={2}
            dot={{ r: 3, fill: agg.color }}
            activeDot={{ r: 5, fill: agg.color }}
          />
        ))}
        {viewMode !== 'distribution' && showAllPRs && (
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
        {chartConfig.showReleasesLine && (
          <Line
            yAxisId="right"
            type="linear"
            dataKey="releaseCount"
            name={chartConfig.childReleasesLabel}
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

    // Get metadata from the data point for special markers
    const dataPoint = payload[0]?.payload;
    const isSpecialMarker = dataPoint?.isSpecialMarker as boolean | undefined;
    const memberOf = dataPoint?.memberOf as string | undefined;

    // Separate category data from special entries
    const categoryPayload = payload.filter(
      (entry) => entry.name !== 'All PRs' && entry.name !== chartConfig.childReleasesLabel
    );
    const allPRsEntry = payload.find((entry) => entry.name === 'All PRs');
    const releasesEntry = payload.find((entry) => entry.name === chartConfig.childReleasesLabel);

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
          {chartConfig.tooltipPrefix} {label}
          {isSpecialMarker && <span className="trend-chart-tooltip-cutoff" title={`${parentVersionPrefix} ${memberOf} Beta Cutoff`}> ⚑</span>}
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
            dataKey={chartConfig.xKey}
            tick={{ fontSize: 12 }}
            tickMargin={8}
            interval={chartConfig.tickInterval}
            ticks={xAxisTicks}
            height={chartConfig.xAxisHeight}
            label={{ value: chartConfig.xLabel, position: 'insideBottom', offset: -5, fontSize: 12 }}
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
            label={usesDualAxis ? { value: `${childItemLabel}s`, angle: 90, position: 'insideRight', fontSize: 12 } : undefined}
          />
          <Tooltip content={renderTooltipContent} />
          {renderLegend()}
          {referenceMarkers.map(({ version, label }) => (
            <ReferenceLine
              key={version}
              yAxisId="left"
              x={version}
              stroke="var(--trend-chart-reference-line, #9b8bb8)"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: `${parentVersionPrefix} ${label} beta`,
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
