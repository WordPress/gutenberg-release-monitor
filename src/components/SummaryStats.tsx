import type { Summary } from '../data/types';

interface SummaryStatsProps {
  summary: Summary;
}

export function SummaryStats({ summary }: SummaryStatsProps) {
  const stats = [
    {
      label: 'Minor Releases',
      value: summary.totalReleases.toLocaleString(),
      tooltip: 'Number of minor releases (x.y.0). Patch releases are aggregated into their minor version.',
    },
    {
      label: 'Total PRs',
      value: summary.totalPRs.toLocaleString(),
      tooltip: 'Total pull requests merged across all releases, parsed from release changelogs.',
    },
    {
      label: 'Avg PRs/Release',
      value: summary.recentAvgPRsPerRelease.toLocaleString(),
      tooltip: 'Average PRs per release, calculated from the last 10 releases.',
    },
    {
      label: 'Unique Contributors',
      value: summary.uniqueContributors.toLocaleString(),
      tooltip: 'Unique contributors mentioned in release changelogs (deduplicated across releases).',
    },
  ];

  return (
    <div className="summary-stats">
      <div className="summary-disclaimer">
        This data is an estimation based on parsing release changelogs.
        Numbers may not match exact GitHub statistics.
      </div>
      {stats.map((stat) => (
        <div key={stat.label} className="summary-stat" title={stat.tooltip}>
          <div className="summary-stat-value">{stat.value}</div>
          <div className="summary-stat-label">{stat.label}</div>
        </div>
      ))}
      <div className="summary-meta">
        <span>
          Versions {summary.oldestRelease} – {summary.latestRelease}
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
