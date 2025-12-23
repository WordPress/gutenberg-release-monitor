import { describe, it, expect } from 'vitest';
import {
  sumCategories,
  aggregateCategories,
  calculateCategoryPercentages,
  getAggregatedPRs,
  getCategoryColor,
  getDefaultSelectedCategories,
  type CategoryConfig,
} from '../../../src/utils/categories.js';

describe('sumCategories', () => {
  it('should sum values from multiple categories', () => {
    const categories = {
      'Enhancements': 50,
      'Bug Fixes': 75,
      'Documentation': 25,
    };
    const rawCategoryNames = ['Enhancements', 'Bug Fixes'];

    expect(sumCategories(categories, rawCategoryNames)).toBe(125);
  });

  it('should handle missing categories as zero', () => {
    const categories = {
      'Enhancements': 50,
    };
    const rawCategoryNames = ['Enhancements', 'Missing Category'];

    expect(sumCategories(categories, rawCategoryNames)).toBe(50);
  });

  it('should return 0 for empty input', () => {
    const categories = {};
    const rawCategoryNames: string[] = [];

    expect(sumCategories(categories, rawCategoryNames)).toBe(0);
  });

  it('should return 0 when all categories are missing', () => {
    const categories = {
      'Enhancements': 50,
    };
    const rawCategoryNames = ['Missing1', 'Missing2'];

    expect(sumCategories(categories, rawCategoryNames)).toBe(0);
  });

  it('should handle single category', () => {
    const categories = {
      'Enhancements': 100,
    };
    const rawCategoryNames = ['Enhancements'];

    expect(sumCategories(categories, rawCategoryNames)).toBe(100);
  });
});

describe('aggregateCategories', () => {
  const mockConfig: CategoryConfig = {
    version: '1.0',
    aggregations: [
      {
        id: 'features',
        labels: { full: 'Features', short: 'Feat' },
        color: '#4CAF50',
        rawCategories: ['Enhancements', 'New APIs'],
        includeByDefault: true,
      },
      {
        id: 'bugs',
        labels: { full: 'Bug Fixes', short: 'Bugs' },
        color: '#F44336',
        rawCategories: ['Bug Fixes'],
        includeByDefault: true,
      },
      {
        id: 'docs',
        labels: { full: 'Documentation', short: 'Docs' },
        color: '#2196F3',
        rawCategories: ['Documentation'],
        includeByDefault: false,
      },
    ],
  };

  it('should aggregate multiple raw categories into single aggregate', () => {
    const categories = {
      'Enhancements': 30,
      'New APIs': 20,
      'Bug Fixes': 50,
      'Documentation': 10,
    };

    const result = aggregateCategories(categories, mockConfig);

    expect(result).toEqual({
      features: 50, // Enhancements (30) + New APIs (20)
      bugs: 50,     // Bug Fixes (50)
      docs: 10,     // Documentation (10)
    });
  });

  it('should handle missing categories', () => {
    const categories = {
      'Bug Fixes': 50,
    };

    const result = aggregateCategories(categories, mockConfig);

    expect(result).toEqual({
      features: 0, // Missing Enhancements and New APIs
      bugs: 50,
      docs: 0,     // Missing Documentation
    });
  });

  it('should return correct structure with all zeros for empty categories', () => {
    const categories = {};

    const result = aggregateCategories(categories, mockConfig);

    expect(result).toEqual({
      features: 0,
      bugs: 0,
      docs: 0,
    });
  });

  it('should handle config with single aggregation', () => {
    const singleConfig: CategoryConfig = {
      version: '1.0',
      aggregations: [
        {
          id: 'all',
          labels: { full: 'All', short: 'All' },
          color: '#000000',
          rawCategories: ['Everything'],
          includeByDefault: true,
        },
      ],
    };

    const categories = { 'Everything': 100 };
    const result = aggregateCategories(categories, singleConfig);

    expect(result).toEqual({ all: 100 });
  });
});

describe('calculateCategoryPercentages', () => {
  it('should calculate percentages accurately', () => {
    const aggregated = {
      features: 50,
      bugs: 30,
      docs: 20,
    };
    const selectedIds = ['features', 'bugs', 'docs'];

    const result = calculateCategoryPercentages(aggregated, selectedIds);

    expect(result).toEqual({
      features: 50, // 50/100 * 100 = 50%
      bugs: 30,     // 30/100 * 100 = 30%
      docs: 20,     // 20/100 * 100 = 20%
    });
  });

  it('should handle zero total by returning empty object', () => {
    const aggregated = {
      features: 0,
      bugs: 0,
      docs: 0,
    };
    const selectedIds = ['features', 'bugs', 'docs'];

    const result = calculateCategoryPercentages(aggregated, selectedIds);

    expect(result).toEqual({});
  });

  it('should calculate percentages for subset of categories', () => {
    const aggregated = {
      features: 60,
      bugs: 40,
      docs: 100,
    };
    const selectedIds = ['features', 'bugs']; // Only selecting features and bugs

    const result = calculateCategoryPercentages(aggregated, selectedIds);

    // Total of selected: 60 + 40 = 100
    expect(result).toEqual({
      features: 60, // 60/100 * 100 = 60%
      bugs: 40,     // 40/100 * 100 = 40%
    });
  });

  it('should handle single category as 100%', () => {
    const aggregated = {
      features: 75,
      bugs: 25,
    };
    const selectedIds = ['features'];

    const result = calculateCategoryPercentages(aggregated, selectedIds);

    expect(result).toEqual({
      features: 100, // 75/75 * 100 = 100%
    });
  });

  it('should round percentages to whole numbers', () => {
    const aggregated = {
      features: 33,
      bugs: 33,
      docs: 34,
    };
    const selectedIds = ['features', 'bugs', 'docs'];

    const result = calculateCategoryPercentages(aggregated, selectedIds);

    // Total: 100, each should be rounded
    expect(result).toEqual({
      features: 33, // 33/100 * 100 = 33%
      bugs: 33,     // 33/100 * 100 = 33%
      docs: 34,     // 34/100 * 100 = 34%
    });
  });

  it('should handle missing categories in aggregated data', () => {
    const aggregated = {
      features: 50,
    };
    const selectedIds = ['features', 'missing'];

    const result = calculateCategoryPercentages(aggregated, selectedIds);

    // Total: 50 + 0 = 50
    expect(result).toEqual({
      features: 100, // 50/50 * 100 = 100%
      missing: 0,    // 0/50 * 100 = 0%
    });
  });
});

describe('getAggregatedPRs', () => {
  const mockConfig: CategoryConfig = {
    version: '1.0',
    aggregations: [
      {
        id: 'features',
        labels: { full: 'Features', short: 'Feat' },
        color: '#4CAF50',
        rawCategories: ['Enhancements', 'New APIs'],
        includeByDefault: true,
      },
      {
        id: 'bugs',
        labels: { full: 'Bug Fixes', short: 'Bugs' },
        color: '#F44336',
        rawCategories: ['Bug Fixes'],
        includeByDefault: true,
      },
    ],
  };

  it('should return total PRs for specific aggregation', () => {
    const categories = {
      'Enhancements': 30,
      'New APIs': 20,
      'Bug Fixes': 50,
    };

    const featuresCount = getAggregatedPRs(categories, mockConfig, 'features');
    const bugsCount = getAggregatedPRs(categories, mockConfig, 'bugs');

    expect(featuresCount).toBe(50); // Enhancements (30) + New APIs (20)
    expect(bugsCount).toBe(50);     // Bug Fixes (50)
  });

  it('should return 0 for unknown aggregation ID', () => {
    const categories = {
      'Enhancements': 30,
    };

    const result = getAggregatedPRs(categories, mockConfig, 'unknown');

    expect(result).toBe(0);
  });

  it('should handle missing raw categories', () => {
    const categories = {
      'Enhancements': 30,
      // Missing 'New APIs'
    };

    const result = getAggregatedPRs(categories, mockConfig, 'features');

    expect(result).toBe(30); // Only counts Enhancements
  });

  it('should return 0 when all raw categories are missing', () => {
    const categories = {
      'Other': 100,
    };

    const result = getAggregatedPRs(categories, mockConfig, 'features');

    expect(result).toBe(0);
  });
});

describe('getCategoryColor', () => {
  const mockConfig: CategoryConfig = {
    version: '1.0',
    aggregations: [
      {
        id: 'features',
        labels: { full: 'Features', short: 'Feat' },
        color: '#4CAF50',
        rawCategories: ['Enhancements'],
        includeByDefault: true,
      },
      {
        id: 'bugs',
        labels: { full: 'Bug Fixes', short: 'Bugs' },
        color: '#F44336',
        rawCategories: ['Bug Fixes'],
        includeByDefault: true,
      },
    ],
  };

  it('should return correct color for known category', () => {
    expect(getCategoryColor(mockConfig, 'features')).toBe('#4CAF50');
    expect(getCategoryColor(mockConfig, 'bugs')).toBe('#F44336');
  });

  it('should return fallback color for unknown category', () => {
    const result = getCategoryColor(mockConfig, 'unknown');

    expect(result).toBe('#9E9E9E'); // Default gray
  });

  it('should be case-sensitive for category IDs', () => {
    const result = getCategoryColor(mockConfig, 'Features'); // Wrong case

    expect(result).toBe('#9E9E9E'); // Should return default
  });
});

describe('getDefaultSelectedCategories', () => {
  it('should filter based on includeByDefault flag', () => {
    const mockConfig: CategoryConfig = {
      version: '1.0',
      aggregations: [
        {
          id: 'features',
          labels: { full: 'Features', short: 'Feat' },
          color: '#4CAF50',
          rawCategories: ['Enhancements'],
          includeByDefault: true,
        },
        {
          id: 'bugs',
          labels: { full: 'Bug Fixes', short: 'Bugs' },
          color: '#F44336',
          rawCategories: ['Bug Fixes'],
          includeByDefault: true,
        },
        {
          id: 'docs',
          labels: { full: 'Documentation', short: 'Docs' },
          color: '#2196F3',
          rawCategories: ['Documentation'],
          includeByDefault: false,
        },
      ],
    };

    const result = getDefaultSelectedCategories(mockConfig);

    expect(result).toEqual(['features', 'bugs']);
    expect(result).not.toContain('docs');
  });

  it('should return empty array when no categories are default', () => {
    const mockConfig: CategoryConfig = {
      version: '1.0',
      aggregations: [
        {
          id: 'features',
          labels: { full: 'Features', short: 'Feat' },
          color: '#4CAF50',
          rawCategories: ['Enhancements'],
          includeByDefault: false,
        },
        {
          id: 'bugs',
          labels: { full: 'Bug Fixes', short: 'Bugs' },
          color: '#F44336',
          rawCategories: ['Bug Fixes'],
          includeByDefault: false,
        },
      ],
    };

    const result = getDefaultSelectedCategories(mockConfig);

    expect(result).toEqual([]);
  });

  it('should return all IDs when all are default', () => {
    const mockConfig: CategoryConfig = {
      version: '1.0',
      aggregations: [
        {
          id: 'features',
          labels: { full: 'Features', short: 'Feat' },
          color: '#4CAF50',
          rawCategories: ['Enhancements'],
          includeByDefault: true,
        },
        {
          id: 'bugs',
          labels: { full: 'Bug Fixes', short: 'Bugs' },
          color: '#F44336',
          rawCategories: ['Bug Fixes'],
          includeByDefault: true,
        },
      ],
    };

    const result = getDefaultSelectedCategories(mockConfig);

    expect(result).toEqual(['features', 'bugs']);
  });

  it('should handle empty aggregations array', () => {
    const mockConfig: CategoryConfig = {
      version: '1.0',
      aggregations: [],
    };

    const result = getDefaultSelectedCategories(mockConfig);

    expect(result).toEqual([]);
  });
});
