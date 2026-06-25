import { describe, it, expect } from 'vitest';
import {
  LABEL_CATEGORY_MAP,
  getCategoryFromLabels,
  isValidVersion,
  parseWPOrgReleaseDate,
  groupByMinorVersion,
  aggregateRawCategories,
  aggregateBreakdown,
  getLatestDate,
  deduplicateContributors,
} from '../../../scripts/utils/scf-utils.js';

describe('LABEL_CATEGORY_MAP', () => {
  it('should map [Type] Bug to Bug Fixes', () => {
    expect(LABEL_CATEGORY_MAP['[Type] Bug']).toBe('Bug Fixes');
  });

  it('should map [Type] Enhancement to Enhancements', () => {
    expect(LABEL_CATEGORY_MAP['[Type] Enhancement']).toBe('Enhancements');
  });

  it('should map [Type] Code Quality to Code Quality', () => {
    expect(LABEL_CATEGORY_MAP['[Type] Code Quality']).toBe('Code Quality');
  });

  it('should map documentation to Documentation', () => {
    expect(LABEL_CATEGORY_MAP['documentation']).toBe('Documentation');
  });
});

describe('getCategoryFromLabels', () => {
  it('should return Bug Fixes for [Type] Bug label', () => {
    const labels = [{ name: '[Type] Bug' }];
    expect(getCategoryFromLabels(labels)).toBe('Bug Fixes');
  });

  it('should return Enhancements for [Type] Enhancement label', () => {
    const labels = [{ name: '[Type] Enhancement' }];
    expect(getCategoryFromLabels(labels)).toBe('Enhancements');
  });

  it('should return Code Quality for [Type] Code Quality label', () => {
    const labels = [{ name: '[Type] Code Quality' }];
    expect(getCategoryFromLabels(labels)).toBe('Code Quality');
  });

  it('should return Documentation for documentation label', () => {
    const labels = [{ name: 'documentation' }];
    expect(getCategoryFromLabels(labels)).toBe('Documentation');
  });

  it('should return Other for unknown labels', () => {
    const labels = [{ name: 'unknown-label' }];
    expect(getCategoryFromLabels(labels)).toBe('Other');
  });

  it('should return Other for empty labels array', () => {
    expect(getCategoryFromLabels([])).toBe('Other');
  });

  it('should return first matching category when multiple labels present', () => {
    const labels = [
      { name: 'some-other-label' },
      { name: '[Type] Bug' },
      { name: '[Type] Enhancement' },
    ];
    expect(getCategoryFromLabels(labels)).toBe('Bug Fixes');
  });

  it('should handle labels with additional properties', () => {
    const labels = [
      { name: '[Type] Enhancement', color: 'blue', description: 'test' },
    ];
    expect(getCategoryFromLabels(labels)).toBe('Enhancements');
  });
});

describe('isValidVersion', () => {
  describe('valid versions', () => {
    it('should accept two-part version (6.7)', () => {
      expect(isValidVersion('6.7')).toBe(true);
    });

    it('should accept three-part version (6.7.0)', () => {
      expect(isValidVersion('6.7.0')).toBe(true);
    });

    it('should accept three-part version with patch (6.7.1)', () => {
      expect(isValidVersion('6.7.1')).toBe(true);
    });

    it('should accept larger version numbers', () => {
      expect(isValidVersion('10.20.30')).toBe(true);
    });

    it('should accept single digit versions', () => {
      expect(isValidVersion('1.2')).toBe(true);
      expect(isValidVersion('1.2.3')).toBe(true);
    });
  });

  describe('invalid versions', () => {
    it('should reject single number', () => {
      expect(isValidVersion('6')).toBe(false);
    });

    it('should reject four-part version', () => {
      expect(isValidVersion('6.7.0.1')).toBe(false);
    });

    it('should reject version with prefix', () => {
      expect(isValidVersion('v6.7')).toBe(false);
    });

    it('should reject version with text', () => {
      expect(isValidVersion('6.7-beta')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidVersion('')).toBe(false);
    });

    it('should reject non-numeric parts', () => {
      expect(isValidVersion('a.b')).toBe(false);
      expect(isValidVersion('6.a')).toBe(false);
    });

    it('should reject version with spaces', () => {
      expect(isValidVersion('6. 7')).toBe(false);
    });
  });
});

describe('parseWPOrgReleaseDate', () => {
  it('parses abbreviated WordPress.org dates', () => {
    expect(parseWPOrgReleaseDate('30 Dec 2025')).toBe('2025-12-30');
  });

  it('parses full month names', () => {
    expect(parseWPOrgReleaseDate('5 September 2025')).toBe('2025-09-05');
  });

  it('returns null for invalid dates', () => {
    expect(parseWPOrgReleaseDate('31 Feb 2025')).toBeNull();
    expect(parseWPOrgReleaseDate('30 Nope 2025')).toBeNull();
    expect(parseWPOrgReleaseDate('2025-12-30')).toBeNull();
  });
});

describe('groupByMinorVersion', () => {
  it('should group single version correctly', () => {
    const items = [{ version: '6.7.0', data: 'a' }];
    const result = groupByMinorVersion(items);

    expect(result.size).toBe(1);
    expect(result.get('6.7')).toEqual([{ version: '6.7.0', data: 'a' }]);
  });

  it('should group multiple patch versions under same minor', () => {
    const items = [
      { version: '6.7.0', data: 'a' },
      { version: '6.7.1', data: 'b' },
      { version: '6.7.2', data: 'c' },
    ];
    const result = groupByMinorVersion(items);

    expect(result.size).toBe(1);
    expect(result.get('6.7')?.length).toBe(3);
  });

  it('should separate different minor versions', () => {
    const items = [
      { version: '6.7.0', data: 'a' },
      { version: '6.8.0', data: 'b' },
      { version: '6.9.0', data: 'c' },
    ];
    const result = groupByMinorVersion(items);

    expect(result.size).toBe(3);
    expect(result.has('6.7')).toBe(true);
    expect(result.has('6.8')).toBe(true);
    expect(result.has('6.9')).toBe(true);
  });

  it('should handle two-part versions', () => {
    const items = [{ version: '6.7', data: 'a' }];
    const result = groupByMinorVersion(items);

    expect(result.size).toBe(1);
    expect(result.get('6.7')).toEqual([{ version: '6.7', data: 'a' }]);
  });

  it('should handle empty array', () => {
    const result = groupByMinorVersion([]);
    expect(result.size).toBe(0);
  });

  it('should preserve item properties', () => {
    const items = [
      { version: '6.7.0', totalPRs: 10, contributors: 5 },
      { version: '6.7.1', totalPRs: 20, contributors: 8 },
    ];
    const result = groupByMinorVersion(items);
    const group = result.get('6.7');

    expect(group?.[0].totalPRs).toBe(10);
    expect(group?.[1].totalPRs).toBe(20);
  });
});

describe('aggregateRawCategories', () => {
  it('should aggregate single source', () => {
    const sources = [{ 'Bug Fixes': 5, 'Enhancements': 10 }];
    const result = aggregateRawCategories(sources);

    expect(result).toEqual({ 'Bug Fixes': 5, 'Enhancements': 10 });
  });

  it('should sum categories across multiple sources', () => {
    const sources = [
      { 'Bug Fixes': 5, 'Enhancements': 10 },
      { 'Bug Fixes': 3, 'Enhancements': 7 },
    ];
    const result = aggregateRawCategories(sources);

    expect(result['Bug Fixes']).toBe(8);
    expect(result['Enhancements']).toBe(17);
  });

  it('should handle categories present in only some sources', () => {
    const sources = [
      { 'Bug Fixes': 5 },
      { 'Enhancements': 10 },
      { 'Bug Fixes': 3, 'Code Quality': 2 },
    ];
    const result = aggregateRawCategories(sources);

    expect(result['Bug Fixes']).toBe(8);
    expect(result['Enhancements']).toBe(10);
    expect(result['Code Quality']).toBe(2);
  });

  it('should return empty object for empty sources', () => {
    const result = aggregateRawCategories([]);
    expect(result).toEqual({});
  });

  it('should handle sources with empty objects', () => {
    const sources = [{}, { 'Bug Fixes': 5 }, {}];
    const result = aggregateRawCategories(sources);

    expect(result).toEqual({ 'Bug Fixes': 5 });
  });
});

describe('aggregateBreakdown', () => {
  it('should aggregate and sort by value descending', () => {
    const sources = [
      { 'Automattic': 5, 'Google': 2 },
      { 'Automattic': 3, 'Unknown': 1 },
    ];
    const result = aggregateBreakdown(sources);

    const keys = Object.keys(result);
    expect(keys[0]).toBe('Automattic'); // 8 total, highest
    expect(result['Automattic']).toBe(8);
    expect(result['Google']).toBe(2);
    expect(result['Unknown']).toBe(1);
  });

  it('should handle single source', () => {
    const sources = [{ 'Spain': 5, 'Finland': 3, 'USA': 2 }];
    const result = aggregateBreakdown(sources);

    const keys = Object.keys(result);
    expect(keys[0]).toBe('Spain');
    expect(keys[1]).toBe('Finland');
    expect(keys[2]).toBe('USA');
  });

  it('should handle empty sources', () => {
    const result = aggregateBreakdown([]);
    expect(result).toEqual({});
  });

  it('should maintain descending order after aggregation', () => {
    const sources = [
      { 'A': 1, 'B': 10 },
      { 'A': 20, 'B': 5 },
    ];
    const result = aggregateBreakdown(sources);

    const keys = Object.keys(result);
    expect(keys[0]).toBe('A'); // 21 total
    expect(keys[1]).toBe('B'); // 15 total
  });
});

describe('getLatestDate', () => {
  it('should return the latest date from array', () => {
    const dates = ['2025-01-01', '2025-06-15', '2025-03-20'];
    expect(getLatestDate(dates)).toBe('2025-06-15');
  });

  it('should handle single date', () => {
    const dates = ['2025-01-01'];
    expect(getLatestDate(dates)).toBe('2025-01-01');
  });

  it('should return empty string for empty array', () => {
    expect(getLatestDate([])).toBe('');
  });

  it('should filter out empty strings', () => {
    const dates = ['', '2025-01-01', '', '2025-06-15', ''];
    expect(getLatestDate(dates)).toBe('2025-06-15');
  });

  it('should return empty string if all dates are empty', () => {
    const dates = ['', '', ''];
    expect(getLatestDate(dates)).toBe('');
  });

  it('should handle ISO date strings', () => {
    const dates = ['2025-01-01T10:00:00Z', '2025-06-15T08:00:00Z'];
    expect(getLatestDate(dates)).toBe('2025-06-15T08:00:00Z');
  });
});

describe('deduplicateContributors', () => {
  it('should deduplicate across multiple lists', () => {
    const lists = [
      ['alice', 'bob'],
      ['bob', 'charlie'],
      ['alice', 'dave'],
    ];
    const result = deduplicateContributors(lists);

    expect(result).toHaveLength(4);
    expect(result).toContain('alice');
    expect(result).toContain('bob');
    expect(result).toContain('charlie');
    expect(result).toContain('dave');
  });

  it('should be case-insensitive', () => {
    const lists = [
      ['Alice', 'BOB'],
      ['alice', 'bob'],
      ['ALICE', 'Bob'],
    ];
    const result = deduplicateContributors(lists);

    expect(result).toHaveLength(2);
  });

  it('should preserve original case of first occurrence', () => {
    const lists = [
      ['Alice'],
      ['alice'],
      ['ALICE'],
    ];
    const result = deduplicateContributors(lists);

    expect(result).toEqual(['Alice']);
  });

  it('should handle empty lists', () => {
    const lists: string[][] = [[], [], []];
    const result = deduplicateContributors(lists);

    expect(result).toEqual([]);
  });

  it('should handle single list', () => {
    const lists = [['alice', 'bob', 'alice']];
    const result = deduplicateContributors(lists);

    expect(result).toEqual(['alice', 'bob']);
  });

  it('should handle empty input array', () => {
    const result = deduplicateContributors([]);
    expect(result).toEqual([]);
  });

  it('should maintain order of first appearance', () => {
    const lists = [
      ['charlie', 'alice'],
      ['bob', 'alice'],
    ];
    const result = deduplicateContributors(lists);

    expect(result[0]).toBe('charlie');
    expect(result[1]).toBe('alice');
    expect(result[2]).toBe('bob');
  });
});
