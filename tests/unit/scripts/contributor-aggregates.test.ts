import { describe, expect, it } from 'vitest';
import { SponsorNormalizer } from '../../../scripts/utils/sponsor-normalization.js';
import type { ContributorData } from '../../../scripts/utils/contributor-data.js';
import type { Release, WPRelease } from '../../../scripts/types.js';
import {
  collectContributorUsernames,
  computeWPVersionContributorAggregates,
  getAffectedWPVersions,
  getReleasesForWPVersion,
} from '../../../scripts/utils/contributor-aggregates.js';

function createRelease(
  version: string,
  overrides: Partial<Release> = {}
): Release {
  return {
    gbVersion: version,
    wpVersion: null,
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

const schedule: WPRelease[] = [
  {
    wpVersion: '6.9',
    beta1Date: '2026-01-01',
    stableDate: '2026-02-01',
    lastGBVersion: '21.2',
    gbVersionRange: '21.0-21.2',
  },
  {
    wpVersion: '7.0',
    beta1Date: '2026-03-01',
    stableDate: '2026-04-01',
    lastGBVersion: '22.1',
    gbVersionRange: '22.0-22.1',
  },
];

describe('computeWPVersionContributorAggregates', () => {
  it('counts sponsor and country breakdowns by unique contributor across the WP cycle', () => {
    const releases = [
      createRelease('22.0', {
        contributorsList: ['alice', 'bob'],
        newContributorsList: ['alice'],
      }),
      createRelease('22.1', {
        contributorsList: ['Alice', 'charlie'],
        newContributorsList: ['CHARLIE'],
      }),
    ];
    const contributorData = new Map<string, ContributorData>([
      ['alice', { sponsor: 'Automattic', location: 'United States' }],
      ['bob', { sponsor: '10up', location: 'Germany' }],
      ['charlie', { sponsor: 'Automattic', location: 'Canada' }],
    ]);

    const result = computeWPVersionContributorAggregates(
      releases,
      contributorData,
      new SponsorNormalizer()
    );

    expect(result.stats).toEqual({ total: 3, newContributors: 2 });
    expect(result.sponsorBreakdown).toEqual({
      Automattic: 2,
      '10up': 1,
    });
    expect(result.countryBreakdown).toEqual({
      'United States': 1,
      Germany: 1,
      Canada: 1,
    });
    expect(
      Object.values(result.sponsorBreakdown).reduce((sum, count) => sum + count, 0)
    ).toBe(result.stats.total);
  });
});

describe('WP cycle targeting helpers', () => {
  it('detects cycles touched by releases needing aggregation', () => {
    const releasesNeedingAggregation = [
      createRelease('21.1', {
        contributorsList: ['alice'],
      }),
    ];

    expect(getAffectedWPVersions(releasesNeedingAggregation, schedule)).toEqual([
      '6.9',
    ]);
  });

  it('loads every release in an affected WP cycle, including already aggregated siblings', () => {
    const releases = [
      createRelease('21.0', {
        contributorsList: ['alice'],
        contributorAggregates: {
          stats: { total: 1, newContributors: 0 },
          sponsorBreakdown: { Automattic: 1 },
          countryBreakdown: { 'United States': 1 },
          aggregatedAt: '2026-01-01T00:00:00Z',
        },
      }),
      createRelease('21.1', {
        contributorsList: ['bob'],
      }),
      createRelease('22.0', {
        contributorsList: ['charlie'],
      }),
    ];

    const cycleReleases = getReleasesForWPVersion('6.9', releases, schedule);

    expect(cycleReleases.map((release) => release.gbVersion)).toEqual([
      '21.0',
      '21.1',
    ]);
    expect(collectContributorUsernames(cycleReleases)).toEqual([
      'alice',
      'bob',
    ]);
  });
});
