import { describe, it, expect } from 'vitest';
import { sumCategories, getAggregatedPRs, loadCategoryConfig } from '../../../scripts/utils/category-utils.js';
import type { Release } from '../../../scripts/types.js';

describe('loadCategoryConfig', () => {
  it('should load category configuration from JSON file', () => {
    const config = loadCategoryConfig();

    expect(config).toBeDefined();
    expect(config.version).toBeDefined();
    expect(config.aggregations).toBeDefined();
    expect(Array.isArray(config.aggregations)).toBe(true);
  });

  it('should have valid aggregation structure', () => {
    const config = loadCategoryConfig();

    config.aggregations.forEach(agg => {
      expect(agg).toHaveProperty('id');
      expect(agg).toHaveProperty('labels');
      expect(agg).toHaveProperty('color');
      expect(agg).toHaveProperty('rawCategories');
      expect(agg).toHaveProperty('includeByDefault');
      expect(Array.isArray(agg.rawCategories)).toBe(true);
    });
  });

  it('should include expected aggregations', () => {
    const config = loadCategoryConfig();
    const ids = config.aggregations.map(a => a.id);

    expect(ids).toContain('features');
    expect(ids).toContain('bugs');
    expect(ids).toContain('codeQuality');
    expect(ids).toContain('a11y');
    expect(ids).toContain('performance');
    expect(ids).toContain('documentation');
    expect(ids).toContain('other');
  });

  it('should cache config after first load', () => {
    const config1 = loadCategoryConfig();
    const config2 = loadCategoryConfig();

    // Should return same reference (cached)
    expect(config1).toBe(config2);
  });
});

describe('sumCategories', () => {
  const mockCategories = {
    'Enhancements': 50,
    'Bug Fixes': 75,
    'Documentation': 25,
    'Performance': 10,
    'Accessibility': 5,
  };

  describe('basic summing', () => {
    it('should sum single category', () => {
      const result = sumCategories(mockCategories, ['Enhancements']);
      expect(result).toBe(50);
    });

    it('should sum multiple categories', () => {
      const result = sumCategories(mockCategories, ['Enhancements', 'Bug Fixes']);
      expect(result).toBe(125); // 50 + 75
    });

    it('should sum all specified categories', () => {
      const result = sumCategories(mockCategories, [
        'Enhancements',
        'Bug Fixes',
        'Documentation',
        'Performance',
        'Accessibility',
      ]);
      expect(result).toBe(165); // 50 + 75 + 25 + 10 + 5
    });
  });

  describe('missing categories', () => {
    it('should return 0 for non-existent category', () => {
      const result = sumCategories(mockCategories, ['NonExistent']);
      expect(result).toBe(0);
    });

    it('should skip non-existent categories in sum', () => {
      const result = sumCategories(mockCategories, ['Enhancements', 'NonExistent', 'Bug Fixes']);
      expect(result).toBe(125); // 50 + 0 + 75
    });

    it('should handle all non-existent categories', () => {
      const result = sumCategories(mockCategories, ['Foo', 'Bar', 'Baz']);
      expect(result).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty category list', () => {
      const result = sumCategories(mockCategories, []);
      expect(result).toBe(0);
    });

    it('should handle empty categories object', () => {
      const result = sumCategories({}, ['Enhancements']);
      expect(result).toBe(0);
    });

    it('should handle categories with 0 PRs', () => {
      const categoriesWithZero = {
        'Enhancements': 50,
        'Bug Fixes': 0,
        'Documentation': 25,
      };
      const result = sumCategories(categoriesWithZero, ['Enhancements', 'Bug Fixes', 'Documentation']);
      expect(result).toBe(75); // 50 + 0 + 25
    });
  });

  describe('real-world category variations', () => {
    it('should sum different enhancement variations', () => {
      const categories = {
        'Enhancements': 30,
        'Enhancement': 20,
        '**Enhancements**': 15,
        'Features': 10,
      };
      const result = sumCategories(categories, [
        'Enhancements',
        'Enhancement',
        '**Enhancements**',
        'Features',
      ]);
      expect(result).toBe(75);
    });

    it('should sum different bug fix variations', () => {
      const categories = {
        'Bug Fixes': 40,
        '**Bug Fixes**': 20,
        'Bug fixes': 15,
        'Bugs': 10,
      };
      const result = sumCategories(categories, [
        'Bug Fixes',
        '**Bug Fixes**',
        'Bug fixes',
        'Bugs',
      ]);
      expect(result).toBe(85);
    });
  });
});

describe('getAggregatedPRs', () => {
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
      'Performance': 10,
      'Accessibility': 5,
      'Code Quality': 15,
    },
    contributors: 42,
    newContributors: 8,
    contributorsList: [],
    newContributorsList: [],
    changelogUrl: 'https://github.com/WordPress/gutenberg/releases/tag/v20.1.0',
    parsedAt: '2024-12-01T12:00:00Z',
    parserVersion: '2.0.0',
  };

  describe('aggregation by ID', () => {
    it('should get aggregated PRs for features', () => {
      const result = getAggregatedPRs(mockRelease, 'features');
      expect(result).toBe(50); // Enhancements
    });

    it('should get aggregated PRs for bugs', () => {
      const result = getAggregatedPRs(mockRelease, 'bugs');
      expect(result).toBe(75); // Bug Fixes
    });

    it('should get aggregated PRs for code quality', () => {
      const result = getAggregatedPRs(mockRelease, 'codeQuality');
      expect(result).toBe(15); // Code Quality
    });

    it('should get aggregated PRs for accessibility', () => {
      const result = getAggregatedPRs(mockRelease, 'a11y');
      expect(result).toBe(5); // Accessibility
    });

    it('should get aggregated PRs for performance', () => {
      const result = getAggregatedPRs(mockRelease, 'performance');
      expect(result).toBe(10); // Performance
    });

    it('should get aggregated PRs for documentation', () => {
      const result = getAggregatedPRs(mockRelease, 'documentation');
      expect(result).toBe(25); // Documentation
    });
  });

  describe('multiple raw categories mapping to single aggregate', () => {
    it('should sum multiple enhancement variations', () => {
      const release: Release = {
        ...mockRelease,
        categories: {
          'Enhancements': 30,
          'Enhancement': 20,
          'Features': 15,
          'New APIs': 10,
        },
      };

      const result = getAggregatedPRs(release, 'features');
      expect(result).toBeGreaterThan(30); // Should sum all variants
    });

    it('should sum multiple bug fix variations', () => {
      const release: Release = {
        ...mockRelease,
        categories: {
          'Bug Fixes': 40,
          'Bug fixes': 20,
          'Bugs': 15,
        },
      };

      const result = getAggregatedPRs(release, 'bugs');
      expect(result).toBeGreaterThan(40); // Should sum all variants
    });

    it('should sum code quality categories', () => {
      const release: Release = {
        ...mockRelease,
        categories: {
          'Code Quality': 20,
          'Tools': 15,
          'Tooling': 10,
        },
      };

      const result = getAggregatedPRs(release, 'codeQuality');
      expect(result).toBeGreaterThan(20); // Should sum all variants
    });
  });

  describe('edge cases', () => {
    it('should return 0 for non-existent aggregation ID', () => {
      const result = getAggregatedPRs(mockRelease, 'nonexistent');
      expect(result).toBe(0);
    });

    it('should return 0 when release has no categories', () => {
      const release: Release = {
        ...mockRelease,
        categories: {},
      };

      const result = getAggregatedPRs(release, 'features');
      expect(result).toBe(0);
    });

    it('should handle release with null categories', () => {
      const release: Release = {
        ...mockRelease,
        categories: null as unknown as Record<string, number>,
      };

      const result = getAggregatedPRs(release, 'features');
      expect(result).toBe(0);
    });

    it('should handle release with undefined categories', () => {
      const release: Release = {
        ...mockRelease,
        categories: undefined as unknown as Record<string, number>,
      };

      const result = getAggregatedPRs(release, 'features');
      expect(result).toBe(0);
    });
  });

  describe('real-world scenarios', () => {
    it('should aggregate "other" category correctly', () => {
      const release: Release = {
        ...mockRelease,
        categories: {
          'Various': 10,
          'Uncategorized': 5,
          'Block Library': 8,
          'Components': 12,
          'Mobile': 7,
        },
      };

      const result = getAggregatedPRs(release, 'other');
      expect(result).toBeGreaterThan(0); // Should sum multiple "other" categories
    });

    it('should handle markdown-formatted category names', () => {
      const release: Release = {
        ...mockRelease,
        categories: {
          '**Enhancements**': 20,
          '**Bug Fixes**': 30,
          '**Documentation**': 10,
        },
      };

      expect(getAggregatedPRs(release, 'features')).toBe(20);
      expect(getAggregatedPRs(release, 'bugs')).toBe(30);
      expect(getAggregatedPRs(release, 'documentation')).toBe(10);
    });

    it('should handle mixed case and formatting', () => {
      const release: Release = {
        ...mockRelease,
        categories: {
          'Bug Fixes': 25,
          'Bug fixes': 15,
          'Bugs:': 10,
        },
      };

      const result = getAggregatedPRs(release, 'bugs');
      expect(result).toBeGreaterThan(25); // Should sum all variations
    });
  });

  describe('comprehensive aggregation', () => {
    it('should correctly aggregate all category types', () => {
      const release: Release = {
        ...mockRelease,
        categories: {
          // Features
          'Enhancements': 30,
          'New APIs': 10,
          // Bugs
          'Bug Fixes': 40,
          // Code Quality
          'Tools': 15,
          'Security': 5,
          // Accessibility
          'Accessibility': 8,
          // Performance
          'Performance': 12,
          // Documentation
          'Documentation': 20,
          // Other
          'Various': 10,
          'Mobile': 5,
        },
      };

      expect(getAggregatedPRs(release, 'features')).toBeGreaterThan(30);
      expect(getAggregatedPRs(release, 'bugs')).toBe(40);
      expect(getAggregatedPRs(release, 'codeQuality')).toBeGreaterThan(15);
      expect(getAggregatedPRs(release, 'a11y')).toBe(8);
      expect(getAggregatedPRs(release, 'performance')).toBe(12);
      expect(getAggregatedPRs(release, 'documentation')).toBe(20);
      expect(getAggregatedPRs(release, 'other')).toBeGreaterThan(10);
    });
  });
});
