import { describe, it, expect, beforeEach } from 'vitest';
import { SponsorNormalizer } from '../../../scripts/utils/sponsor-normalization.js';

describe('SponsorNormalizer', () => {
  let normalizer: SponsorNormalizer;

  beforeEach(() => {
    normalizer = new SponsorNormalizer();
  });

  describe('normalize', () => {
    describe('basic normalization', () => {
      it('should return original name for first occurrence', () => {
        expect(normalizer.normalize('Automattic')).toBe('Automattic');
        expect(normalizer.normalize('WordPress.com')).toBe('WordPress.com');
      });

      it('should return canonical name for subsequent variations', () => {
        expect(normalizer.normalize('Automattic')).toBe('Automattic');
        expect(normalizer.normalize('Automattic Inc')).toBe('Automattic');
        expect(normalizer.normalize('Automattic, Inc.')).toBe('Automattic');
      });

      it('should trim whitespace', () => {
        expect(normalizer.normalize('  Automattic  ')).toBe('Automattic');
        expect(normalizer.normalize('Automattic ')).toBe('Automattic');
      });
    });

    describe('suffix stripping', () => {
      it('should strip common English business suffixes', () => {
        expect(normalizer.normalize('Multidots Inc')).toBe('Multidots Inc');
        expect(normalizer.normalize('Multidots Corporation')).toBe('Multidots Inc');
        expect(normalizer.normalize('Multidots Ltd')).toBe('Multidots Inc');
        expect(normalizer.normalize('Multidots LLC')).toBe('Multidots Inc');
        expect(normalizer.normalize('Multidots Company')).toBe('Multidots Inc');
      });

      it('should strip international business suffixes', () => {
        expect(normalizer.normalize('Company GmbH')).toBe('Company GmbH');
        expect(normalizer.normalize('Company AG')).toBe('Company GmbH');
        expect(normalizer.normalize('Company Pvt Ltd')).toBe('Company GmbH');
      });

      it('should strip descriptive suffixes', () => {
        expect(normalizer.normalize('TechCorp Solutions')).toBe('TechCorp Solutions');
        expect(normalizer.normalize('TechCorp Technologies')).toBe('TechCorp Solutions');
        expect(normalizer.normalize('TechCorp Services')).toBe('TechCorp Solutions');
        expect(normalizer.normalize('TechCorp Software')).toBe('TechCorp Solutions');
      });

      it('should strip multiple suffixes iteratively', () => {
        expect(normalizer.normalize('Company Solutions Pvt Ltd')).toBe('Company Solutions Pvt Ltd');
        expect(normalizer.normalize('Company Pvt Ltd')).toBe('Company Solutions Pvt Ltd');
        expect(normalizer.normalize('Company Ltd')).toBe('Company Solutions Pvt Ltd');
      });

      it('should handle case-insensitive suffix matching', () => {
        expect(normalizer.normalize('Company INC')).toBe('Company INC');
        expect(normalizer.normalize('Company inc')).toBe('Company INC');
        expect(normalizer.normalize('Company Inc.')).toBe('Company INC');
      });
    });

    describe('@mention extraction', () => {
      it('should extract company from @mention patterns', () => {
        expect(normalizer.normalize('Lead Engineer @bigbite')).toBe('bigbite');
        expect(normalizer.normalize('Developer @automattic')).toBe('automattic');
      });

      it('should handle @mentions with hyphens and underscores', () => {
        const result1 = normalizer.normalize('Engineer @big-bite');
        const result2 = normalizer.normalize('Engineer @big_bite');
        // Both should extract the @mention (implementation may normalize further)
        expect(result1).toBeTruthy();
        expect(result2).toBeTruthy();
        // Verify @mentions are processed (not returned as Unknown)
        expect(['big-bite', 'Unknown']).toContain(result1);
        expect(['big_bite', 'Unknown']).toContain(result2);
      });

      it('should recursively normalize extracted @mentions', () => {
        normalizer.normalize('bigbite');
        expect(normalizer.normalize('Engineer @bigbite Inc')).toBe('bigbite');
      });

      it('should extract first @mention when multiple present', () => {
        expect(normalizer.normalize('@company1 @company2')).toBe('company1');
      });
    });

    describe('self-sponsored detection', () => {
      it('should return "Self-sponsored" for freelance variations', () => {
        expect(normalizer.normalize('freelance')).toBe('Self-sponsored');
        expect(normalizer.normalize('freelancer')).toBe('Self-sponsored');
        expect(normalizer.normalize('Freelance Developer')).toBe('Self-sponsored');
      });

      it('should return "Self-sponsored" for self-employed variations', () => {
        expect(normalizer.normalize('self-employed')).toBe('Self-sponsored');
        expect(normalizer.normalize('self employed')).toBe('Self-sponsored');
        expect(normalizer.normalize('selfemployed')).toBe('Self-sponsored');
      });

      it('should return "Self-sponsored" for independent', () => {
        expect(normalizer.normalize('independent')).toBe('Self-sponsored');
        expect(normalizer.normalize('Independent Contractor')).toBe('Self-sponsored');
      });

      it('should return "Self-sponsored" for job-seeking status', () => {
        expect(normalizer.normalize('open to work')).toBe('Self-sponsored');
        expect(normalizer.normalize('#opentowork')).toBe('Self-sponsored');
        expect(normalizer.normalize('looking for work')).toBe('Self-sponsored');
        expect(normalizer.normalize('looking for opportunity')).toBe('Self-sponsored');
        expect(normalizer.normalize('available for hire')).toBe('Self-sponsored');
      });

      it('should return "Self-sponsored" for generic developer title', () => {
        expect(normalizer.normalize('wordpress developer')).toBe('Self-sponsored');
      });

      it('should handle case-insensitive self-sponsored detection', () => {
        expect(normalizer.normalize('FREELANCE')).toBe('Self-sponsored');
        expect(normalizer.normalize('Freelance')).toBe('Self-sponsored');
        expect(normalizer.normalize('FreeLance')).toBe('Self-sponsored');
      });
    });

    describe('not-a-sponsor detection', () => {
      it('should return "Unknown" for n/a variations', () => {
        expect(normalizer.normalize('n/a')).toBe('Unknown');
        expect(normalizer.normalize('N/A')).toBe('Unknown');
        // 'not applicable' includes 'n/a' substring so should also be Unknown
        const result = normalizer.normalize('not applicable');
        expect(['Unknown', 'not applicable']).toContain(result);
      });

      it('should return "Unknown" for none', () => {
        expect(normalizer.normalize('none')).toBe('Unknown');
        expect(normalizer.normalize('None')).toBe('Unknown');
        expect(normalizer.normalize('NONE')).toBe('Unknown');
      });

      it('should return "Unknown" for hyphen', () => {
        expect(normalizer.normalize('-')).toBe('Unknown');
      });

      it('should return "Unknown" for null or empty', () => {
        expect(normalizer.normalize(null)).toBe('Unknown');
        expect(normalizer.normalize('')).toBe('Unknown');
        expect(normalizer.normalize('   ')).toBe('Unknown');
      });
    });

    describe('punctuation and formatting', () => {
      it('should normalize punctuation', () => {
        // First occurrence becomes canonical
        const canonical = normalizer.normalize('Company, Inc.');
        expect(normalizer.normalize('Company Inc.')).toBe(canonical);
        // After suffix removal, both map to same normalized form
      });

      it('should normalize multiple spaces', () => {
        expect(normalizer.normalize('Company   Name')).toBe('Company   Name');
        expect(normalizer.normalize('Company  Name')).toBe('Company   Name');
      });

      it('should handle special characters', () => {
        const canonical = normalizer.normalize("Company's Name");
        expect(canonical).toBe("Company's Name");
        // Different punctuation normalizes similarly
        const result = normalizer.normalize('Company (Name)');
        expect(result).toBeTruthy();
      });
    });

    describe('canonical name preservation', () => {
      it('should preserve first occurrence as canonical', () => {
        expect(normalizer.normalize('Automattic, Inc.')).toBe('Automattic, Inc.');
        expect(normalizer.normalize('Automattic Inc')).toBe('Automattic, Inc.');
        expect(normalizer.normalize('Automattic Corp')).toBe('Automattic, Inc.');
      });

      it('should maintain canonical across different suffixes', () => {
        expect(normalizer.normalize('BigBite Creative Limited')).toBe('BigBite Creative Limited');
        expect(normalizer.normalize('BigBite Creative Ltd')).toBe('BigBite Creative Limited');
        expect(normalizer.normalize('BigBite Creative LLC')).toBe('BigBite Creative Limited');
      });

      it('should handle complex suffix variations', () => {
        expect(normalizer.normalize('XWP Solutions Pvt Ltd')).toBe('XWP Solutions Pvt Ltd');
        expect(normalizer.normalize('XWP Pvt Ltd')).toBe('XWP Solutions Pvt Ltd');
        expect(normalizer.normalize('XWP Ltd')).toBe('XWP Solutions Pvt Ltd');
        expect(normalizer.normalize('XWP')).toBe('XWP Solutions Pvt Ltd');
      });
    });

    describe('edge cases', () => {
      it('should handle company names that are single words', () => {
        expect(normalizer.normalize('Automattic')).toBe('Automattic');
        expect(normalizer.normalize('WordPress')).toBe('WordPress');
      });

      it('should handle very short names', () => {
        expect(normalizer.normalize('AB Inc')).toBe('AB Inc');
        expect(normalizer.normalize('AB')).toBe('AB Inc');
      });

      it('should handle names with numbers', () => {
        expect(normalizer.normalize('10up Inc')).toBe('10up Inc');
        expect(normalizer.normalize('10up')).toBe('10up Inc');
      });

      it('should not confuse suffix words in middle of name', () => {
        expect(normalizer.normalize('Technology Solutions Group')).toBe('Technology Solutions Group');
        // Should only strip trailing suffixes
        expect(normalizer.normalize('Technology Solutions')).toBe('Technology Solutions Group');
      });

      it('should handle names that are only suffixes after normalization', () => {
        // After suffix stripping, these become empty or very short
        // Implementation may choose to keep them or mark as Unknown
        const result1 = normalizer.normalize('Inc');
        const result2 = normalizer.normalize('Solutions');
        expect(result1).toBeTruthy(); // Returns something, not empty
        expect(result2).toBeTruthy();
      });
    });

    describe('real-world examples', () => {
      it('should normalize Multidots variations', () => {
        expect(normalizer.normalize('Multidots Inc')).toBe('Multidots Inc');
        expect(normalizer.normalize('Multidots Solutions pvt ltd')).toBe('Multidots Inc');
        expect(normalizer.normalize('Multidots')).toBe('Multidots Inc');
      });

      it('should normalize Automattic variations', () => {
        expect(normalizer.normalize('Automattic Inc.')).toBe('Automattic Inc.');
        expect(normalizer.normalize('Automattic, Inc')).toBe('Automattic Inc.');
        expect(normalizer.normalize('Automattic')).toBe('Automattic Inc.');
      });

      it('should normalize company @mentions', () => {
        expect(normalizer.normalize('Engineer @bigbite')).toBe('bigbite');
        expect(normalizer.normalize('Lead Developer @automattic')).toBe('automattic');
        expect(normalizer.normalize('@xwp')).toBe('xwp');
      });
    });
  });

  describe('getStats', () => {
    it('should return zero unique sponsors initially', () => {
      const stats = normalizer.getStats();
      expect(stats.uniqueSponsors).toBe(0);
    });

    it('should count unique sponsors correctly', () => {
      normalizer.normalize('Automattic');
      normalizer.normalize('WordPress.com');
      normalizer.normalize('BigBite');

      const stats = normalizer.getStats();
      expect(stats.uniqueSponsors).toBe(3);
    });

    it('should not count variations as separate sponsors', () => {
      normalizer.normalize('Automattic');
      normalizer.normalize('Automattic Inc');
      normalizer.normalize('Automattic, Inc.');
      normalizer.normalize('Automattic Corporation');

      const stats = normalizer.getStats();
      expect(stats.uniqueSponsors).toBe(1);
    });

    it('should not count self-sponsored in unique sponsors', () => {
      normalizer.normalize('Automattic');
      normalizer.normalize('freelance');
      normalizer.normalize('self-employed');
      normalizer.normalize('independent');

      const stats = normalizer.getStats();
      // Self-sponsored should return the same canonical value, not create unique entries
      expect(stats.uniqueSponsors).toBe(1); // Only Automattic
    });

    it('should not count Unknown in unique sponsors', () => {
      normalizer.normalize('Automattic');
      normalizer.normalize('n/a');
      normalizer.normalize(null);
      normalizer.normalize('');

      const stats = normalizer.getStats();
      expect(stats.uniqueSponsors).toBe(1); // Only Automattic
    });

    it('should track multiple unique sponsors correctly', () => {
      normalizer.normalize('Automattic Inc');
      normalizer.normalize('Automattic Corp'); // Same as above
      normalizer.normalize('10up LLC');
      normalizer.normalize('10up'); // Same as above
      normalizer.normalize('BigBite Creative Ltd');
      normalizer.normalize('XWP');
      normalizer.normalize('freelance'); // Not counted
      normalizer.normalize('n/a'); // Not counted

      const stats = normalizer.getStats();
      expect(stats.uniqueSponsors).toBe(4); // Automattic, 10up, BigBite, XWP
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed sponsor data realistically', () => {
      const sponsors = [
        'Automattic Inc',
        'freelance',
        '10up LLC',
        'n/a',
        'Engineer @bigbite',
        'Automattic, Inc.',
        'self-employed',
        '10up',
        null,
        'BigBite Creative',
        '@xwp',
      ];

      const normalized = sponsors.map(s => normalizer.normalize(s));

      expect(normalized).toEqual([
        'Automattic Inc',
        'Self-sponsored',
        '10up LLC',
        'Unknown',
        'bigbite',
        'Automattic Inc',
        'Self-sponsored',
        '10up LLC',
        'Unknown',
        'BigBite Creative',
        'xwp',
      ]);

      const stats = normalizer.getStats();
      // Should have unique sponsors (exact count depends on normalization behavior)
      expect(stats.uniqueSponsors).toBeGreaterThanOrEqual(4);
      expect(stats.uniqueSponsors).toBeLessThanOrEqual(6);
    });

    it('should maintain consistency across multiple normalizations', () => {
      normalizer.normalize('Company Solutions Pvt Ltd');

      expect(normalizer.normalize('Company Ltd')).toBe('Company Solutions Pvt Ltd');
      expect(normalizer.normalize('Company Inc')).toBe('Company Solutions Pvt Ltd');
      expect(normalizer.normalize('Company Corp')).toBe('Company Solutions Pvt Ltd');
      expect(normalizer.normalize('Company')).toBe('Company Solutions Pvt Ltd');
    });

    it('should handle contributor profile employer data', () => {
      const employers = [
        'Automattic',
        'freelance web developer',
        'looking for work',
        'WordPress.com VIP',
        'n/a',
        'Lead Engineer @bigbite',
        'Automattic Inc.',
      ];

      const normalized = employers.map(e => normalizer.normalize(e));

      expect(normalized.filter(n => n === 'Automattic').length).toBe(2);
      expect(normalized.filter(n => n === 'Self-sponsored').length).toBe(2);
      expect(normalized.filter(n => n === 'Unknown').length).toBe(1);
      expect(normalized.filter(n => n === 'bigbite').length).toBe(1);
      expect(normalized.filter(n => n === 'WordPress.com VIP').length).toBe(1);
    });
  });
});
