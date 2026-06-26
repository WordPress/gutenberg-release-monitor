import { describe, expect, it } from 'vitest';
import {
  mergeReleases,
  selectStableReleasesForVersion,
} from '../../../scripts/build-gb-releases.js';
import { aggregatePatchReleases } from '../../../scripts/utils/release-utils.js';
import type { Release } from '../../../scripts/types.js';
import type { GitHubRelease } from '../../../scripts/utils/types.js';

function createGitHubRelease(version: string): GitHubRelease {
  const tagName = version.startsWith('v') ? version : `v${version}`;

  return {
    tag_name: tagName,
    name: tagName,
    body: '',
    published_at: '2026-01-01T00:00:00Z',
    html_url: `https://example.test/releases/${tagName}`,
  };
}

function createRelease(version: string, overrides: Partial<Release> = {}): Release {
  return {
    gbVersion: version,
    wpVersion: null,
    date: '2026-01-01',
    isLastBeforeWPBeta: false,
    totalPRs: 10,
    categories: { 'Bug Fixes': 10 },
    contributors: 0,
    newContributors: 0,
    contributorsList: [],
    newContributorsList: [],
    changelogUrl: `https://example.test/releases/v${version}`,
    parsedAt: '2026-01-01T00:00:00Z',
    parserVersion: '1.0.0',
    ...overrides,
  };
}

function releaseVersion(release: GitHubRelease): string {
  return release.tag_name.replace(/^v/, '');
}

describe('selectStableReleasesForVersion', () => {
  it('returns the stable minor line for a patch request', () => {
    const releases = [
      createGitHubRelease('20.0.0'),
      createGitHubRelease('20.0.1'),
      createGitHubRelease('20.0.2'),
      createGitHubRelease('20.0.3-rc.1'),
      createGitHubRelease('20.1.0'),
      createGitHubRelease('19.9.9'),
    ];

    const selected = selectStableReleasesForVersion(releases, '20.0.1');

    expect(selected.map((release) => release.tag_name)).toEqual([
      'v20.0.0',
      'v20.0.1',
      'v20.0.2',
    ]);
  });

  it('returns the stable minor line for an x.y.0 request', () => {
    const releases = [
      createGitHubRelease('20.0.0'),
      createGitHubRelease('20.0.1'),
      createGitHubRelease('20.1.0'),
    ];

    const selected = selectStableReleasesForVersion(releases, '20.0.0');

    expect(selected.map((release) => release.tag_name)).toEqual(['v20.0.0', 'v20.0.1']);
  });

  it('returns no releases when the requested stable tag is missing', () => {
    const releases = [
      createGitHubRelease('20.0.0'),
      createGitHubRelease('20.0.2'),
    ];

    const selected = selectStableReleasesForVersion(releases, '20.0.1');

    expect(selected).toEqual([]);
  });

  it('does not need an exact x.y tag for a minor request', () => {
    const releases = [
      createGitHubRelease('20.0.0'),
      createGitHubRelease('20.0.1'),
      createGitHubRelease('20.0.2-rc.1'),
      createGitHubRelease('20.1.0'),
    ];

    const selected = selectStableReleasesForVersion(releases, '20.0');

    expect(selected.map((release) => release.tag_name)).toEqual(['v20.0.0', 'v20.0.1']);
  });
});

describe('mergeReleases', () => {
  it('keeps patch requests from replacing an aggregate with patch-only totals', () => {
    const fetchedReleases = [
      createGitHubRelease('20.0.0'),
      createGitHubRelease('20.0.1'),
      createGitHubRelease('20.0.2'),
      createGitHubRelease('20.1.0'),
    ];
    const selected = selectStableReleasesForVersion(fetchedReleases, '20.0.1');
    const totalsByVersion: Record<string, number> = {
      '20.0.0': 100,
      '20.0.1': 20,
      '20.0.2': 5,
    };

    const aggregatedReleases = aggregatePatchReleases(
      selected.map((release) =>
        createRelease(releaseVersion(release), {
          totalPRs: totalsByVersion[releaseVersion(release)] ?? 0,
        })
      )
    );
    const contributorAggregates: Release['contributorAggregates'] = {
      stats: {
        total: 2,
        newContributors: 1,
      },
      sponsorBreakdown: {
        Automattic: 2,
      },
      countryBreakdown: {
        'United States': 2,
      },
      aggregatedAt: '2026-01-01T00:00:00Z',
    };

    const merged = mergeReleases(
      [
        createRelease('20.0', {
          totalPRs: 999,
          contributorAggregates,
        }),
      ],
      aggregatedReleases
    );

    const release = merged.find((item) => item.gbVersion === '20.0');

    expect(release?.totalPRs).toBe(125);
    expect(release?.totalPRs).not.toBe(20);
    expect(release?.contributorAggregates).toEqual(contributorAggregates);
  });
});
