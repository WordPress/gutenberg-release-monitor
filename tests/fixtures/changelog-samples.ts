/**
 * Sample changelog text snippets for testing different formats.
 * Covers modern (v8+), mid-era (v6-v7), and legacy (v5-) formats.
 */

/**
 * Modern changelog format (v8+) with ### Category headers.
 * Example: v20.1.0, v19.5.0
 */
export const MODERN_CHANGELOG = `## Changelog

### Enhancements
- Add new block inspector controls ([12345](https://github.com/WordPress/gutenberg/pull/12345))
- Improve block toolbar positioning ([12346](https://github.com/WordPress/gutenberg/pull/12346))
- Update navigation block accessibility ([12347](https://github.com/WordPress/gutenberg/pull/12347))

### Bug Fixes
- Fix editor crash on block deletion ([12348](https://github.com/WordPress/gutenberg/pull/12348))
- Resolve media upload issues ([12349](https://github.com/WordPress/gutenberg/pull/12349))

### Documentation
- Update contributor guidelines ([12350](https://github.com/WordPress/gutenberg/pull/12350))

## Contributors
The following contributors merged PRs in this release:

@contributor1 @contributor2 @contributor3

## First-time Contributors
Welcome to new contributors!

@newcomer1 @newcomer2
`;

/**
 * Mid-era changelog format (v6-v7) with ## Category headers.
 * Example: v7.9.0, v6.8.0
 */
export const MID_ERA_CHANGELOG = `## Changelog

## Features
- [Add new block patterns](https://github.com/WordPress/gutenberg/pull/23456)
- [Improve block inserter](https://github.com/WordPress/gutenberg/pull/23457)

## Bug Fixes
- [Fix editor initialization](https://github.com/WordPress/gutenberg/pull/23458)
- [Resolve color picker issues](https://github.com/WordPress/gutenberg/pull/23459)
- [Fix drag and drop](https://github.com/WordPress/gutenberg/pull/23460)

## Contributors
@user1 @user2 @user3 @user4

## First-Time Contributors
@newuser1
`;

/**
 * Legacy changelog format (v5-) without category headers.
 * Example: v5.9.0, v5.2.0
 */
export const LEGACY_CHANGELOG = `## Changelog

- Add new block templates
- Improve editor performance
- Fix color palette issues
- Update block library
- Resolve navigation bugs
- Add accessibility improvements

## Contributors
@dev1 @dev2 @dev3
`;

/**
 * HTML-formatted changelog (v5.x releases).
 */
export const HTML_CHANGELOG = `<h2>Features</h2>
<ul>
<li><a href="https://github.com/WordPress/gutenberg/pull/34567">Add new patterns</a></li>
<li><a href="https://github.com/WordPress/gutenberg/pull/34568">Update block library</a></li>
</ul>

<h2>Bug Fixes</h2>
<ul>
<li><a href="https://github.com/WordPress/gutenberg/pull/34569">Fix editor crash</a></li>
<li><a href="https://github.com/WordPress/gutenberg/pull/34570">Resolve media issues</a></li>
<li><a href="https://github.com/WordPress/gutenberg/pull/34571">Fix navigation</a></li>
</ul>
`;

/**
 * Changelog with subcategories (modern format).
 */
export const CHANGELOG_WITH_SUBCATEGORIES = `## Changelog

### Enhancements

#### Block Editor
- Add new inspector controls ([45001](https://github.com/WordPress/gutenberg/pull/45001))
- Improve toolbar positioning ([45002](https://github.com/WordPress/gutenberg/pull/45002))

#### Components
- Update button component ([45003](https://github.com/WordPress/gutenberg/pull/45003))

### Bug Fixes
- Fix critical editor crash ([45004](https://github.com/WordPress/gutenberg/pull/45004))

## Contributors
@contributor1 @contributor2
`;

/**
 * Changelog without any category headers (very old format).
 */
export const UNCATEGORIZED_CHANGELOG = `## Changelog

* Add new feature
* Fix bug
* Update documentation
* Improve performance
* Add tests

## Contributors
@author1 @author2
`;

/**
 * Changelog with RC sections (v16-17 format).
 */
export const CHANGELOG_WITH_RC = `= 17.3.0-rc.2 =

## Changelog

### Enhancements
- Add new patterns ([56001](https://github.com/WordPress/gutenberg/pull/56001))
- Improve block inserter ([56002](https://github.com/WordPress/gutenberg/pull/56002))

### Bug Fixes
- Fix navigation ([56003](https://github.com/WordPress/gutenberg/pull/56003))

## Contributors
@dev1 @dev2

= 17.3.0-rc.1 =

## Changelog

### Enhancements
- Update editor UI ([56004](https://github.com/WordPress/gutenberg/pull/56004))

### Bug Fixes
- Resolve media issues ([56005](https://github.com/WordPress/gutenberg/pull/56005))
- Fix drag drop ([56006](https://github.com/WordPress/gutenberg/pull/56006))

## Contributors
@dev3 @dev4
`;

/**
 * Empty changelog.
 */
export const EMPTY_CHANGELOG = `## Changelog

No changes in this release.

## Contributors
@maintainer
`;

/**
 * Malformed changelog (missing sections).
 */
export const MALFORMED_CHANGELOG = `Some random text

### Bug Fixes
- Fix something ([99999](https://github.com/WordPress/gutenberg/pull/99999))

More random text
`;

/**
 * Changelog with Contributors before Changelog (v15.8.0 pattern).
 */
export const CONTRIBUTORS_BEFORE_CHANGELOG = `## Contributors
@earlycontributor1 @earlycontributor2

## Changelog

### Enhancements
- Add feature ([78001](https://github.com/WordPress/gutenberg/pull/78001))
- Improve UI ([78002](https://github.com/WordPress/gutenberg/pull/78002))

### Bug Fixes
- Fix issue ([78003](https://github.com/WordPress/gutenberg/pull/78003))

## Contributors
@contributor1 @contributor2 @contributor3

## First-time Contributors
@newbie1
`;

/**
 * Mock GitHub release object for testing parseRelease.
 */
export const MOCK_GITHUB_RELEASE = {
  tag_name: 'v20.1.0',
  name: 'Gutenberg 20.1.0',
  body: MODERN_CHANGELOG,
  published_at: '2024-12-01T10:00:00Z',
  html_url: 'https://github.com/WordPress/gutenberg/releases/tag/v20.1.0',
};
