import { describe, it, expect } from 'vitest';
import { parseRelease, parseModernChangelog, parseContributors } from '../../../scripts/utils/changelog-parser.js';
import type { GitHubRelease } from '../../../scripts/utils/types.js';
import {
  MODERN_CHANGELOG,
  MID_ERA_CHANGELOG,
  LEGACY_CHANGELOG,
  HTML_CHANGELOG,
  CHANGELOG_WITH_SUBCATEGORIES,
  UNCATEGORIZED_CHANGELOG,
  CHANGELOG_WITH_RC,
  EMPTY_CHANGELOG,
  MALFORMED_CHANGELOG,
  CONTRIBUTORS_BEFORE_CHANGELOG,
  MOCK_GITHUB_RELEASE,
} from '../../fixtures/changelog-samples.js';

describe('parseModernChangelog', () => {
  describe('modern format (v8+)', () => {
    it('should parse categories with ### headers', () => {
      const result = parseModernChangelog(MODERN_CHANGELOG);

      expect(result.categories).toEqual({
        'Enhancements': 3,
        'Bug Fixes': 2,
        'Documentation': 1,
      });
      expect(result.totalPRs).toBe(6);
    });

    it('should handle subcategories correctly', () => {
      const result = parseModernChangelog(CHANGELOG_WITH_SUBCATEGORIES);

      expect(result.categories).toEqual({
        'Enhancements': 3,
        'Bug Fixes': 1,
      });
      expect(result.totalPRs).toBe(4);
    });
  });

  describe('mid-era format (v6-v7)', () => {
    it('should parse categories with ## headers', () => {
      const result = parseModernChangelog(MID_ERA_CHANGELOG);

      expect(result.categories).toEqual({
        'Features': 2,
        'Bug Fixes': 3,
      });
      expect(result.totalPRs).toBe(5);
    });

    it('should count inline PR links', () => {
      const result = parseModernChangelog(MID_ERA_CHANGELOG);
      expect(result.totalPRs).toBeGreaterThan(0);
    });
  });

  describe('legacy format (v5-)', () => {
    it('should count bullet points when no PR links present', () => {
      const result = parseModernChangelog(LEGACY_CHANGELOG);

      expect(result.categories).toEqual({
        'Uncategorized': 6,
      });
      expect(result.totalPRs).toBe(6);
    });

    it('should parse HTML changelog format', () => {
      const result = parseModernChangelog(HTML_CHANGELOG);

      expect(result.categories).toHaveProperty('Features');
      expect(result.categories).toHaveProperty('Bug Fixes');
      expect(result.categories['Features']).toBe(2);
      expect(result.categories['Bug Fixes']).toBe(3);
      expect(result.totalPRs).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle changelog without category headers', () => {
      const result = parseModernChangelog(UNCATEGORIZED_CHANGELOG);

      expect(result.categories).toEqual({
        'Uncategorized': 5,
      });
      expect(result.totalPRs).toBe(5);
    });

    it('should handle empty changelog', () => {
      const result = parseModernChangelog(EMPTY_CHANGELOG);

      expect(result.categories).toEqual({});
      expect(result.totalPRs).toBe(0);
    });

    it('should handle malformed changelog', () => {
      const result = parseModernChangelog(MALFORMED_CHANGELOG);

      expect(result.categories).toHaveProperty('Bug Fixes');
      expect(result.categories['Bug Fixes']).toBe(1);
      expect(result.totalPRs).toBe(1);
    });

    it('should handle Contributors before Changelog', () => {
      const result = parseModernChangelog(CONTRIBUTORS_BEFORE_CHANGELOG);

      expect(result.categories).toEqual({
        'Enhancements': 2,
        'Bug Fixes': 1,
      });
      expect(result.totalPRs).toBe(3);
    });

    it('should handle changelog with RC sections', () => {
      const result = parseModernChangelog(CHANGELOG_WITH_RC);

      // Should aggregate from both RC sections
      expect(result.categories).toHaveProperty('Enhancements');
      expect(result.categories).toHaveProperty('Bug Fixes');
      // RC sections should be aggregated together
      expect(result.totalPRs).toBeGreaterThan(0);
    });

    it('should normalize line endings', () => {
      const withCRLF = MODERN_CHANGELOG.replace(/\n/g, '\r\n');
      const result = parseModernChangelog(withCRLF);

      expect(result.totalPRs).toBe(6);
    });
  });

  describe('PR link format detection', () => {
    it('should count modern PR links ([12345](url))', () => {
      const changelog = `## Changelog
### Features
- Add feature ([12345](https://github.com/WordPress/gutenberg/pull/12345))
- Update UI ([12346](https://github.com/WordPress/gutenberg/pull/12346))`;

      const result = parseModernChangelog(changelog);
      expect(result.totalPRs).toBe(2);
    });

    it('should count inline PR links [text](url)', () => {
      const changelog = `## Changelog
### Features
- [Add feature](https://github.com/WordPress/gutenberg/pull/23456)
- [Update UI](https://github.com/WordPress/gutenberg/pull/23457)`;

      const result = parseModernChangelog(changelog);
      expect(result.totalPRs).toBe(2);
    });

    it('should count HTML PR links (pull/12345)', () => {
      const changelog = `<h2>Features</h2>
<ul>
<li><a href="https://github.com/WordPress/gutenberg/pull/34567">Feature</a></li>
</ul>`;

      const result = parseModernChangelog(changelog);
      expect(result.totalPRs).toBe(1);
    });
  });
});

describe('parseContributors', () => {
  it('should parse contributors from Contributors section', () => {
    const result = parseContributors(MODERN_CHANGELOG);

    expect(result.contributors).toBe(3);
    expect(result.contributorsList).toEqual(['contributor1', 'contributor2', 'contributor3']);
  });

  it('should parse first-time contributors', () => {
    const result = parseContributors(MODERN_CHANGELOG);

    expect(result.newContributors).toBe(2);
    expect(result.newContributorsList).toEqual(['newcomer1', 'newcomer2']);
  });

  it('should handle changelog without first-time contributors section', () => {
    const result = parseContributors(LEGACY_CHANGELOG);

    expect(result.contributors).toBe(3);
    expect(result.newContributors).toBe(0);
    expect(result.newContributorsList).toEqual([]);
  });

  it('should normalize contributor names to lowercase', () => {
    const changelog = `## Contributors
@UserOne @UserTwo @USERTHREE`;

    const result = parseContributors(changelog);

    expect(result.contributorsList).toEqual(['userone', 'usertwo', 'userthree']);
  });

  it('should handle Contributors before Changelog section', () => {
    const result = parseContributors(CONTRIBUTORS_BEFORE_CHANGELOG);

    // Parser should find contributors in the Contributors section after Changelog
    expect(result.contributors).toBeGreaterThan(0);
    expect(result.contributorsList.length).toBeGreaterThan(0);
    // May or may not have first-time contributors depending on the sample
    expect(result.newContributors).toBeGreaterThanOrEqual(0);
  });

  it('should handle changelog with no contributors', () => {
    const changelog = `## Changelog
### Features
- Add feature ([12345](https://github.com/WordPress/gutenberg/pull/12345))`;

    const result = parseContributors(changelog);

    expect(result.contributors).toBe(0);
    expect(result.newContributors).toBe(0);
    expect(result.contributorsList).toEqual([]);
    expect(result.newContributorsList).toEqual([]);
  });

  it('should extract @mentions correctly', () => {
    const changelog = `## Contributors
@user-name @user_name @user123`;

    const result = parseContributors(changelog);

    expect(result.contributorsList).toEqual(['user-name', 'user_name', 'user123']);
  });

  it('should parse contributors from RC sections', () => {
    const result = parseContributors(CHANGELOG_WITH_RC);

    // Should aggregate contributors from both RC sections: @dev1, @dev2 (rc.2) + @dev3, @dev4 (rc.1)
    expect(result.contributors).toBe(4);
    expect(result.contributorsList).toContain('dev1');
    expect(result.contributorsList).toContain('dev2');
    expect(result.contributorsList).toContain('dev3');
    expect(result.contributorsList).toContain('dev4');
  });

  it('should normalize line endings', () => {
    const withCRLF = MODERN_CHANGELOG.replace(/\n/g, '\r\n');
    const result = parseContributors(withCRLF);

    expect(result.contributors).toBe(3);
  });
});

describe('parseRelease', () => {
  it('should parse a complete GitHub release', () => {
    const result = parseRelease(MOCK_GITHUB_RELEASE as GitHubRelease);

    expect(result.version).toBe('20.1.0');
    expect(result.date).toBe('2024-12-01');
    expect(result.changelogUrl).toBe('https://github.com/WordPress/gutenberg/releases/tag/v20.1.0');
    expect(result.totalPRs).toBe(6);
    expect(result.categories).toEqual({
      'Enhancements': 3,
      'Bug Fixes': 2,
      'Documentation': 1,
    });
    expect(result.contributors).toBe(3);
    expect(result.newContributors).toBe(2);
  });

  it('should strip v prefix from version', () => {
    const release = {
      ...MOCK_GITHUB_RELEASE,
      tag_name: 'v19.5.2',
    };

    const result = parseRelease(release as GitHubRelease);
    expect(result.version).toBe('19.5.2');
  });

  it('should handle release without body', () => {
    const release = {
      ...MOCK_GITHUB_RELEASE,
      body: '',
    };

    const result = parseRelease(release as GitHubRelease);

    expect(result.totalPRs).toBe(0);
    expect(result.categories).toEqual({});
    expect(result.contributors).toBe(0);
  });

  it('should extract date from published_at timestamp', () => {
    const release = {
      ...MOCK_GITHUB_RELEASE,
      published_at: '2024-11-15T14:30:45Z',
    };

    const result = parseRelease(release as GitHubRelease);
    expect(result.date).toBe('2024-11-15');
  });

  it('should include contributor lists', () => {
    const result = parseRelease(MOCK_GITHUB_RELEASE as GitHubRelease);

    expect(result.contributorsList).toHaveLength(3);
    expect(result.newContributorsList).toHaveLength(2);
    expect(result.contributorsList).toContain('contributor1');
    expect(result.newContributorsList).toContain('newcomer1');
  });
});
