import { describe, expect, it } from 'vitest';
import type { NormalizedRelease } from '../../../src/data/normalized.js';
import type { Release } from '../../../scripts/types.js';
import {
  generateWPVersionStats,
  preserveContributorAggregates,
} from '../../../scripts/build-wp-cycles.js';

function createRelease(
  version: string,
  overrides: Partial<Release> = {}
): Release {
  return {
    gbVersion: version,
    wpVersion: '7.0',
    date: '2026-01-01',
    isLastBeforeWPBeta: false,
    totalPRs: 10,
    categories: {},
    contributors: 0,
    newContributors: 0,
    contributorsList: [],
    newContributorsList: [],
    changelogUrl: `https://example.test/${version}`,
    parsedAt: '2026-01-01T00:00:00Z',
    parserVersion: '1.0.0',
    ...overrides,
  };
}

describe('generateWPVersionStats', () => {
  it('does not synthesize cycle contributorAggregates from per-release breakdowns', () => {
    const stats = generateWPVersionStats([
      createRelease('22.0', {
        contributors: 2,
        contributorsList: ['alice', 'bob'],
        contributorAggregates: {
          stats: { total: 2, newContributors: 0 },
          sponsorBreakdown: { Automattic: 2 },
          countryBreakdown: { 'United States': 2 },
          aggregatedAt: '2026-01-01T00:00:00Z',
        },
      }),
      createRelease('22.1', {
        contributors: 2,
        contributorsList: ['alice', 'charlie'],
        contributorAggregates: {
          stats: { total: 2, newContributors: 0 },
          sponsorBreakdown: { Automattic: 2 },
          countryBreakdown: { 'United States': 2 },
          aggregatedAt: '2026-01-02T00:00:00Z',
        },
      }),
    ]);

    const cycle = stats.find((stat) => stat.version === '7.0');

    expect(cycle?.contributors).toBe(3);
    expect(cycle?.contributorAggregates).toBeUndefined();
  });
});

describe('preserveContributorAggregates', () => {
  it('preserves existing unique cycle contributorAggregates after rebuilding core stats', () => {
    const stats = generateWPVersionStats([
      createRelease('22.0', {
        contributors: 2,
        contributorsList: ['alice', 'bob'],
      }),
      createRelease('22.1', {
        contributors: 2,
        contributorsList: ['alice', 'charlie'],
      }),
    ]);
    const existingAggregate = {
      sponsorBreakdown: { Automattic: 3 },
      countryBreakdown: { 'United States': 3 },
    };
    const existingCycles: NormalizedRelease[] = [
      {
        ...stats[0],
        contributorAggregates: existingAggregate,
      },
    ];

    const preserved = preserveContributorAggregates(stats, existingCycles);

    expect(preserved[0].contributorAggregates).toEqual(existingAggregate);
  });
});
