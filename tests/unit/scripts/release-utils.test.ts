import { describe, it, expect } from 'vitest';
import { compareVersions, getMinorVersion, toNormalizedRelease } from '../../../scripts/utils/release-utils.js';
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
