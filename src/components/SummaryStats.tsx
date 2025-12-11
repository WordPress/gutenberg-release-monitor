import type { Summary } from '../data/types';

interface SummaryStatsProps {
  summary: Summary;
}

export function SummaryStats({ summary }: SummaryStatsProps) {
  const stats = [
    {
      label: 'Total Releases',
      value: summary.totalReleases.toLocaleString(),
    },
    {
      label: 'Total PRs',
      value: summary.totalPRs.toLocaleString(),
    },
    {
      label: 'Avg PRs/Release',
      value: summary.avgPRsPerRelease.toLocaleString(),
    },
    {
      label: 'Total Contributors',
      value: summary.totalContributors.toLocaleString(),
    },
  ];

  return (
    <div className="summary-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="summary-stat">
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
