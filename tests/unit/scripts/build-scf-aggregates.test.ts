import { describe, expect, it } from 'vitest';
import { generateMinorVersionStats } from '../../../scripts/build-scf-aggregates.js';
import type { Release } from '../../../scripts/types.js';

function createRelease(version: string, overrides: Partial<Release> = {}): Release {
  return {
    gbVersion: version,
    wpVersion: null,
    date: '2026-01-01',
    isLastBeforeWPBeta: false,
    totalPRs: 10,
    categories: {},
    contributors: 2,
    newContributors: 1,
    contributorsList: ['alice', 'bob'],
    newContributorsList: ['alice'],
    changelogUrl: `https://example.test/${version}`,
    parsedAt: '2026-01-01T00:00:00Z',
    parserVersion: '1.0.0',
    ...overrides,
  };
}

describe('generateMinorVersionStats', () => {
  it('marks SCF by-major rows as aggregated patch-release groups', () => {
    const stats = generateMinorVersionStats([
      createRelease('6.7.0', {
        totalPRs: 10,
        contributors: 2,
        newContributors: 1,
        contributorsList: ['alice', 'bob'],
        newContributorsList: ['alice'],
      }),
      createRelease('6.7.2', {
        date: '2026-01-03',
        totalPRs: 20,
        contributors: 2,
        newContributors: 0,
        contributorsList: ['alice', 'charlie'],
        newContributorsList: [],
      }),
    ]);

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      version: '6.7',
      isAggregated: true,
      totalPRs: 30,
      contributors: 3,
      newContributors: 1,
      avgPRs: 15,
      avgContributors: 2,
      avgNewContributors: 1,
      groupedCount: 2,
      groupedRange: '6.7.0-6.7.2',
      date: '2026-01-03',
    });
  });

  it('does not sum release-level contributor breakdowns into by-major rows', () => {
    const stats = generateMinorVersionStats([
      createRelease('6.7.0', {
        contributorAggregates: {
          stats: { total: 2, newContributors: 0 },
          sponsorBreakdown: { Automattic: 2 },
          countryBreakdown: { 'United States': 2 },
          aggregatedAt: '2026-01-01T00:00:00Z',
        },
      }),
      createRelease('6.7.1', {
        contributorsList: ['alice', 'charlie'],
        contributorAggregates: {
          stats: { total: 2, newContributors: 0 },
          sponsorBreakdown: { Automattic: 1, Google: 1 },
          countryBreakdown: { 'United States': 1, Canada: 1 },
          aggregatedAt: '2026-01-02T00:00:00Z',
        },
      }),
    ]);

    expect(stats[0].contributors).toBe(3);
    expect(stats[0].contributorAggregates).toBeUndefined();
  });
});
