import type { Summary } from '../data/types';

interface SummaryStatsProps {
  summary: Summary;
}

function formatDiff(current: number, total: number): string {
  if (total === 0) return '';
  const diff = Math.round(((current - total) / total) * 100);
  if (diff === 0) return '';
  return diff > 0 ? `+${diff}%` : `${diff}%`;
}

function getDiffClass(current: number, total: number): string {
  if (total === 0) return 'neutral';
  const diff = current - total;
  if (diff > 0) return 'positive';
  if (diff < 0) return 'negative';
  return 'neutral';
}

export function SummaryStats({ summary }: SummaryStatsProps) {
  const stats = [
    {
      label: 'PRs',
      value: summary.avgPRsSinceCutoff,
      total: summary.avgPRsTotal,
    },
    {
      label: 'Features',
      value: summary.avgFeaturesSinceCutoff,
      total: summary.avgFeaturesTotal,
    },
    {
      label: 'Bug Fixes',
      value: summary.avgBugsSinceCutoff,
      total: summary.avgBugsTotal,
    },
    {
      label: 'Accessibility',
      value: summary.avgA11ySinceCutoff,
      total: summary.avgA11yTotal,
    },
    {
      label: 'Performance',
      value: summary.avgPerfSinceCutoff,
      total: summary.avgPerfTotal,
    },
    {
      label: 'Contributors',
      value: summary.avgContributorsSinceCutoff,
      total: summary.avgContributorsTotal,
    },
    {
      label: 'New Contributors',
      value: summary.avgNewContributorsSinceCutoff,
      total: summary.avgNewContributorsTotal,
    },
  ];

  return (
    <div className="summary-section">
      <div className="summary-disclaimer">
        Data is an estimation based on parsing release changelogs.
      </div>

      <div className="summary-stats">
        <div className="summary-stats-header">
          Averages per Gutenberg release in the current WordPress {summary.currentWPCycle} cycle ({summary.releasesSinceCutoff} releases since {summary.lastCutoffVersion})
        </div>
        {stats.map((stat) => {
          const diff = formatDiff(stat.value, stat.total);
          const diffClass = getDiffClass(stat.value, stat.total);
          return (
            <div key={stat.label} className="summary-stat">
              <div className="summary-stat-label">{stat.label}</div>
              <div className="summary-stat-value">
                {stat.value.toLocaleString()}
              </div>
              <div className="summary-stat-comparison">
                (vs {stat.total}{diff && <>, <span className={`summary-stat-diff ${diffClass}`}>{diff}</span></>})
              </div>
            </div>
          );
        })}
      </div>

      <div className="summary-meta">
        <span>
          {summary.totalReleases} releases: {summary.oldestRelease} – {summary.latestRelease}
        </span>
        <span>
          Last updated:{' '}
          {new Date(summary.lastUpdated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
}
