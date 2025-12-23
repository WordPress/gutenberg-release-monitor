import { describe, it, expect } from 'vitest';
import { compareVersions, getMinorVersion, isPatchRelease, aggregatePatchReleases, toNormalizedRelease } from '../../../scripts/utils/release-utils.js';
import type { Release } from '../../../scripts/types.js';

describe('compareVersions', () => {
  describe('basic comparisons', () => {
    it('should return negative when a < b', () => {
      expect(compareVersions('20.1', '20.2')).toBeLessThan(0);
      expect(compareVersions('5.0', '20.0')).toBeLessThan(0);
      expect(compareVersions('19.9', '20.0')).toBeLessThan(0);
    });

    it('should return positive when a > b', () => {
      expect(compareVersions('20.2', '20.1')).toBeGreaterThan(0);
      expect(compareVersions('20.0', '5.0')).toBeGreaterThan(0);
      expect(compareVersions('20.0', '19.9')).toBeGreaterThan(0);
    });

    it('should return 0 when a equals b', () => {
      expect(compareVersions('20.1', '20.1')).toBe(0);
      expect(compareVersions('5.0', '5.0')).toBe(0);
      expect(compareVersions('19.9.5', '19.9.5')).toBe(0);
    });
  });

  describe('three-part versions', () => {
    it('should compare patch versions correctly', () => {
      expect(compareVersions('20.1.0', '20.1.1')).toBeLessThan(0);
      expect(compareVersions('20.1.1', '20.1.0')).toBeGreaterThan(0);
      expect(compareVersions('20.1.0', '20.1.0')).toBe(0);
    });

    it('should compare major.minor.patch correctly', () => {
      expect(compareVersions('19.9.9', '20.0.0')).toBeLessThan(0);
      expect(compareVersions('20.0.1', '20.0.0')).toBeGreaterThan(0);
      expect(compareVersions('5.2.3', '5.2.4')).toBeLessThan(0);
    });
  });

  describe('mixed version formats', () => {
    it('should handle two-part vs three-part versions', () => {
      // 20.1 should be treated as 20.1.0
      expect(compareVersions('20.1', '20.1.0')).toBe(0);
      expect(compareVersions('20.1', '20.1.1')).toBeLessThan(0);
      expect(compareVersions('20.1.1', '20.1')).toBeGreaterThan(0);
    });

    it('should handle single digit versions', () => {
      expect(compareVersions('5', '20')).toBeLessThan(0);
      expect(compareVersions('5', '5.0')).toBe(0);
      expect(compareVersions('5', '5.0.0')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle leading zeros', () => {
      expect(compareVersions('20.01', '20.1')).toBe(0);
      expect(compareVersions('20.01', '20.02')).toBeLessThan(0);
    });

    it('should handle large version numbers', () => {
      expect(compareVersions('99.99.99', '100.0.0')).toBeLessThan(0);
      expect(compareVersions('100.0.0', '99.99.99')).toBeGreaterThan(0);
    });

    it('should handle very different lengths', () => {
      expect(compareVersions('1', '1.0.0.0')).toBe(0);
      expect(compareVersions('1.0', '1.0.0.0')).toBe(0);
    });
  });
});

describe('getMinorVersion', () => {
  it('should extract minor version from three-part version', () => {
    expect(getMinorVersion('20.1.0')).toBe('20.1');
    expect(getMinorVersion('19.5.2')).toBe('19.5');
    expect(getMinorVersion('5.9.3')).toBe('5.9');
  });

  it('should handle two-part version', () => {
    expect(getMinorVersion('20.1')).toBe('20.1');
    expect(getMinorVersion('19.5')).toBe('19.5');
  });

  it('should handle single digit version', () => {
    expect(getMinorVersion('20')).toBe('20.0');
    expect(getMinorVersion('5')).toBe('5.0');
  });

  it('should handle version with many parts', () => {
    expect(getMinorVersion('20.1.0.0')).toBe('20.1');
    expect(getMinorVersion('19.5.2.1')).toBe('19.5');
  });

  it('should handle edge cases', () => {
    expect(getMinorVersion('0.0.0')).toBe('0.0');
    expect(getMinorVersion('1.0')).toBe('1.0');
    expect(getMinorVersion('100.99.88')).toBe('100.99');
  });
});

describe('isPatchRelease', () => {
  it('should return true for patch versions (x.y.z where z > 0)', () => {
    expect(isPatchRelease('21.1.1')).toBe(true);
    expect(isPatchRelease('21.1.2')).toBe(true);
    expect(isPatchRelease('20.0.1')).toBe(true);
    expect(isPatchRelease('5.9.3')).toBe(true);
  });

  it('should return false for base versions (x.y.0)', () => {
    expect(isPatchRelease('21.1.0')).toBe(false);
    expect(isPatchRelease('20.0.0')).toBe(false);
    expect(isPatchRelease('5.9.0')).toBe(false);
  });

  it('should return false for two-part versions (treated as x.y.0)', () => {
    expect(isPatchRelease('21.1')).toBe(false);
    expect(isPatchRelease('20.0')).toBe(false);
  });

  it('should handle v prefix', () => {
    expect(isPatchRelease('v21.1.1')).toBe(true);
    expect(isPatchRelease('v21.1.0')).toBe(false);
    expect(isPatchRelease('v21.1')).toBe(false);
  });
});

describe('aggregatePatchReleases', () => {
  const createMockRelease = (version: string, overrides: Partial<Release> = {}): Release => ({
    gbVersion: version,
    wpVersion: null,
    date: '2024-12-01',
    isLastBeforeWPBeta: false,
    totalPRs: 10,
    categories: { 'Bug Fixes': 5, 'Enhancements': 5 },
    contributors: 5,
    newContributors: 1,
    contributorsList: [`user-${version}`],
    newContributorsList: [`new-${version}`],
    changelogUrl: `https://example.com/${version}`,
    parsedAt: '2024-12-01T00:00:00Z',
    parserVersion: '1.0.0',
    ...overrides,
  });

  it('should aggregate patch releases into base version', () => {
    const releases = [
      createMockRelease('21.1.0', { totalPRs: 100, categories: { 'Bug Fixes': 50, 'Enhancements': 50 } }),
      createMockRelease('21.1.1', { totalPRs: 20, categories: { 'Bug Fixes': 20 } }),
      createMockRelease('21.1.2', { totalPRs: 15, categories: { 'Bug Fixes': 10, 'Security': 5 } }),
    ];

    const result = aggregatePatchReleases(releases);

    expect(result).toHaveLength(1);
    expect(result[0].gbVersion).toBe('21.1');
    expect(result[0].totalPRs).toBe(135); // 100 + 20 + 15
    expect(result[0].categories).toEqual({
      'Bug Fixes': 80, // 50 + 20 + 10
      'Enhancements': 50,
      'Security': 5,
    });
  });

  it('should deduplicate contributors across patch releases', () => {
    const releases = [
      createMockRelease('21.1.0', {
        contributorsList: ['alice', 'bob'],
        newContributorsList: ['alice'],
      }),
      createMockRelease('21.1.1', {
        contributorsList: ['bob', 'charlie'], // bob is duplicate
        newContributorsList: ['charlie'],
      }),
      createMockRelease('21.1.2', {
        contributorsList: ['alice', 'dave'], // alice is duplicate
        newContributorsList: [],
      }),
    ];

    const result = aggregatePatchReleases(releases);

    expect(result[0].contributorsList).toHaveLength(4); // alice, bob, charlie, dave
    expect(result[0].contributorsList).toContain('alice');
    expect(result[0].contributorsList).toContain('bob');
    expect(result[0].contributorsList).toContain('charlie');
    expect(result[0].contributorsList).toContain('dave');
    expect(result[0].contributors).toBe(4);

    expect(result[0].newContributorsList).toHaveLength(2); // alice, charlie
    expect(result[0].newContributors).toBe(2);
  });

  it('should handle releases without patch versions (single release)', () => {
    const releases = [
      createMockRelease('21.1.0'),
      createMockRelease('21.2.0'),
    ];

    const result = aggregatePatchReleases(releases);

    expect(result).toHaveLength(2);
    expect(result.map(r => r.gbVersion).sort()).toEqual(['21.1', '21.2']);
  });

  it('should normalize version to minor format (x.y)', () => {
    const releases = [createMockRelease('21.1.0')];

    const result = aggregatePatchReleases(releases);

    expect(result[0].gbVersion).toBe('21.1'); // Not 21.1.0
  });

  it('should use base release metadata when aggregating', () => {
    const releases = [
      createMockRelease('21.1.0', {
        date: '2024-12-01',
        wpVersion: '6.8',
        isLastBeforeWPBeta: true,
        changelogUrl: 'https://example.com/v21.1.0',
      }),
      createMockRelease('21.1.1', {
        date: '2024-12-15', // Later date
        wpVersion: '6.8',
        isLastBeforeWPBeta: false,
        changelogUrl: 'https://example.com/v21.1.1',
      }),
    ];

    const result = aggregatePatchReleases(releases);

    // Should use base release (21.1.0) metadata
    expect(result[0].date).toBe('2024-12-01');
    expect(result[0].wpVersion).toBe('6.8');
    expect(result[0].isLastBeforeWPBeta).toBe(true);
    expect(result[0].changelogUrl).toBe('https://example.com/v21.1.0');
  });

  it('should handle only patch releases (no base x.y.0)', () => {
    const releases = [
      createMockRelease('21.1.1', { totalPRs: 20 }),
      createMockRelease('21.1.2', { totalPRs: 15 }),
    ];

    const result = aggregatePatchReleases(releases);

    // Should use first release as base
    expect(result).toHaveLength(1);
    expect(result[0].gbVersion).toBe('21.1');
    expect(result[0].totalPRs).toBe(35); // 20 + 15
  });

  it('should handle multiple minor versions with patches', () => {
    const releases = [
      createMockRelease('21.1.0', { totalPRs: 100 }),
      createMockRelease('21.1.1', { totalPRs: 10 }),
      createMockRelease('21.2.0', { totalPRs: 80 }),
      createMockRelease('21.2.1', { totalPRs: 5 }),
      createMockRelease('21.3.0', { totalPRs: 120 }),
    ];

    const result = aggregatePatchReleases(releases);

    expect(result).toHaveLength(3);

    const v21_1 = result.find(r => r.gbVersion === '21.1');
    const v21_2 = result.find(r => r.gbVersion === '21.2');
    const v21_3 = result.find(r => r.gbVersion === '21.3');

    expect(v21_1?.totalPRs).toBe(110); // 100 + 10
    expect(v21_2?.totalPRs).toBe(85);  // 80 + 5
    expect(v21_3?.totalPRs).toBe(120); // No patches
  });

  it('should handle empty categories', () => {
    const releases = [
      createMockRelease('21.1.0', { categories: {} }),
      createMockRelease('21.1.1', { categories: { 'Bug Fixes': 5 } }),
    ];

    const result = aggregatePatchReleases(releases);

    expect(result[0].categories).toEqual({ 'Bug Fixes': 5 });
  });

  it('should handle empty contributor lists', () => {
    const releases = [
      createMockRelease('21.1.0', { contributorsList: [], newContributorsList: [] }),
      createMockRelease('21.1.1', { contributorsList: ['alice'], newContributorsList: ['alice'] }),
    ];

    const result = aggregatePatchReleases(releases);

    expect(result[0].contributorsList).toEqual(['alice']);
    expect(result[0].newContributorsList).toEqual(['alice']);
    expect(result[0].contributors).toBe(1);
    expect(result[0].newContributors).toBe(1);
  });

  it('should return empty array for empty input', () => {
    const result = aggregatePatchReleases([]);
    expect(result).toEqual([]);
  });
});

describe('toNormalizedRelease', () => {
  const mockRelease: Release = {
    gbVersion: '20.1.0',
    wpVersion: '6.5',
    date: '2024-12-01',
    isLastBeforeWPBeta: false,
    totalPRs: 150,
    categories: {
      'Enhancements': 50,
      'Bug Fixes': 75,
      'Documentation': 25,
    },
    contributors: 42,
    newContributors: 8,
    contributorsList: ['user1', 'user2', 'user3'],
    newContributorsList: ['newuser1', 'newuser2'],
    contributorAggregates: {
      stats: {
        total: 42,
        newContributors: 8,
      },
      sponsorBreakdown: {
        'Automattic': 15,
        'Unknown': 10,
      },
      countryBreakdown: {
        'US': 20,
        'UK': 10,
      },
      aggregatedAt: '2024-12-01T10:00:00Z',
    },
    changelogUrl: 'https://github.com/WordPress/gutenberg/releases/tag/v20.1.0',
    parsedAt: '2024-12-01T12:00:00Z',
    parserVersion: '2.0.0',
  };

  it('should convert Release to NormalizedRelease format', () => {
    const result = toNormalizedRelease(mockRelease);

    expect(result).toMatchObject({
      id: '20.1',
      version: '20.1',
      displayLabel: 'Gutenberg 20.1',
      isAggregated: false,
      totalPRs: 150,
      contributors: 42,
      newContributors: 8,
      hasContributorData: true,
      avgPRs: 150,
      avgContributors: 42,
      avgNewContributors: 8,
      date: '2024-12-01',
      memberOf: '6.5',
      changelogUrl: 'https://github.com/WordPress/gutenberg/releases/tag/v20.1.0',
    });
  });

  it('should extract minor version for id and version', () => {
    const result = toNormalizedRelease(mockRelease);

    expect(result.id).toBe('20.1');
    expect(result.version).toBe('20.1');
  });

  it('should preserve rawCategories', () => {
    const result = toNormalizedRelease(mockRelease);

    expect(result.rawCategories).toEqual({
      'Enhancements': 50,
      'Bug Fixes': 75,
      'Documentation': 25,
    });
  });

  it('should include contributor lists for internal use', () => {
    const result = toNormalizedRelease(mockRelease);

    expect(result.contributorsList).toEqual(['user1', 'user2', 'user3']);
    expect(result.newContributorsList).toEqual(['newuser1', 'newuser2']);
  });

  it('should handle release without WP version', () => {
    const releaseWithoutWP = {
      ...mockRelease,
      wpVersion: null,
    };

    const result = toNormalizedRelease(releaseWithoutWP);

    expect(result.memberOf).toBeUndefined();
  });

  it('should handle isLastBeforeWPBeta flag', () => {
    const releaseWithMarker = {
      ...mockRelease,
      isLastBeforeWPBeta: true,
    };

    const result = toNormalizedRelease(releaseWithMarker);

    expect(result.isSpecialMarker).toBe(true);
  });

  it('should set hasContributorData based on contributors count', () => {
    const releaseWithContributors = {
      ...mockRelease,
      contributors: 10,
    };
    const releaseWithoutContributors = {
      ...mockRelease,
      contributors: 0,
    };

    expect(toNormalizedRelease(releaseWithContributors).hasContributorData).toBe(true);
    expect(toNormalizedRelease(releaseWithoutContributors).hasContributorData).toBe(false);
  });

  it('should include contributor aggregates when present', () => {
    const result = toNormalizedRelease(mockRelease);

    expect(result.contributorAggregates).toMatchObject({
      sponsorBreakdown: {
        'Automattic': 15,
        'Unknown': 10,
      },
      countryBreakdown: {
        'US': 20,
        'UK': 10,
      },
    });
  });

  it('should handle release without contributor aggregates', () => {
    const releaseWithoutAggregates = {
      ...mockRelease,
      contributorAggregates: undefined,
    };

    const result = toNormalizedRelease(releaseWithoutAggregates);

    expect(result.contributorAggregates).toBeUndefined();
  });

  it('should use default endpoint for displayLabel', () => {
    const result = toNormalizedRelease(mockRelease);
    expect(result.displayLabel).toBe('Gutenberg 20.1');
  });

  it('should use custom endpoint for displayLabel', () => {
    const result = toNormalizedRelease(mockRelease, 'wp-cycles.json');
    expect(result.displayLabel).toBe('WordPress 20.1');
  });

  describe('average values', () => {
    it('should set avgPRs equal to totalPRs for non-aggregated releases', () => {
      const result = toNormalizedRelease(mockRelease);

      expect(result.avgPRs).toBe(result.totalPRs);
      expect(result.avgPRs).toBe(150);
    });

    it('should set avgContributors equal to contributors for non-aggregated releases', () => {
      const result = toNormalizedRelease(mockRelease);

      expect(result.avgContributors).toBe(result.contributors);
      expect(result.avgContributors).toBe(42);
    });

    it('should set avgNewContributors equal to newContributors for non-aggregated releases', () => {
      const result = toNormalizedRelease(mockRelease);

      expect(result.avgNewContributors).toBe(result.newContributors);
      expect(result.avgNewContributors).toBe(8);
    });
  });

  describe('edge cases', () => {
    it('should handle release with zero values', () => {
      const emptyRelease: Release = {
        ...mockRelease,
        totalPRs: 0,
        contributors: 0,
        newContributors: 0,
        contributorsList: [],
        newContributorsList: [],
        categories: {},
      };

      const result = toNormalizedRelease(emptyRelease);

      expect(result.totalPRs).toBe(0);
      expect(result.contributors).toBe(0);
      expect(result.newContributors).toBe(0);
      expect(result.hasContributorData).toBe(false);
      expect(result.rawCategories).toEqual({});
    });

    it('should handle release with minimal data', () => {
      const minimalRelease: Release = {
        gbVersion: '15.0.0',
        wpVersion: null,
        date: '2024-01-01',
        isLastBeforeWPBeta: false,
        totalPRs: 0,
        categories: {},
        contributors: 0,
        newContributors: 0,
        contributorsList: [],
        newContributorsList: [],
        changelogUrl: 'https://example.com',
        parsedAt: '2024-01-01T00:00:00Z',
        parserVersion: '1.0.0',
      };

      const result = toNormalizedRelease(minimalRelease);

      expect(result.id).toBe('15.0');
      expect(result.version).toBe('15.0');
      expect(result.memberOf).toBeUndefined();
      expect(result.isSpecialMarker).toBeUndefined();
    });
  });
});
