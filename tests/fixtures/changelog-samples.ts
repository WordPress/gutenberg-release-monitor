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
 * RC-style changelog with the same PR listed under two categories.
 * This catches regressions where deduping is scoped too narrowly.
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
- Update editor UI ([56003](https://github.com/WordPress/gutenberg/pull/56003))

### Bug Fixes
- Resolve media issues ([56005](https://github.com/WordPress/gutenberg/pull/56005))
- Fix drag drop ([56006](https://github.com/WordPress/gutenberg/pull/56006))

## Contributors
@dev3 @dev4
`;

/**
 * Real Gutenberg 16.8.0 release body. It used to expose the RC double-counting
 * bug because the parser read the same changelog content twice.
 */
export const GUTENBERG_16_8_CHANGELOG = "= 16.8.0-rc.2 =\n\n## Changelog\nThis copies the commits from the 16.7.1 patch release into the 16.8.0 main release.\n \n### Tools\n\n#### Build Tooling\n- Fix incorrect resource URL in source map for sources coming from @wordpress packages. ([51401](https://github.com/WordPress/gutenberg/pull/51401))\n\n### Various\n\n- Add missing schema `type` attribute for in WP 6.4 compat's `block-hooks.php`. ([55138](https://github.com/WordPress/gutenberg/pull/55138))\n\n## Contributors\n\nThe following contributors merged PRs in this release:\n\n@fullofcaffeine @torounit\n\n\n= 16.8.0-rc.1 =\n\n## Changelog\n\n### Features\n\n#### Block Editor\n- Adds 'nofollow' setting to Button block. ([54110](https://github.com/WordPress/gutenberg/pull/54110))\n\n#### Site Editor\n- Add 'Show template' toggle when editing pages. ([52674](https://github.com/WordPress/gutenberg/pull/52674))\n\n\n### Enhancements\n\n- Update pattern import menu item. ([54782](https://github.com/WordPress/gutenberg/pull/54782))\n\n#### Components\n- Adding label/description to `BlockEditor/DuotoneControl`. ([54473](https://github.com/WordPress/gutenberg/pull/54473))\n- Deprecating `isPressed` in `Button` component. ([54740](https://github.com/WordPress/gutenberg/pull/54740))\n- Follow ariakit best practices. ([54696](https://github.com/WordPress/gutenberg/pull/54696))\n- InputControl-based components: Add opt-in prop for next 40px default size. ([53819](https://github.com/WordPress/gutenberg/pull/53819))\n- Modal: Add `contentWidth` prop to support a selection of preset modal sizes. ([54471](https://github.com/WordPress/gutenberg/pull/54471))\n- Remove unused components from `ui/`. ([54573](https://github.com/WordPress/gutenberg/pull/54573))\n- Update ariakit to 0.3.3. ([54818](https://github.com/WordPress/gutenberg/pull/54818))\n- Update compact search control metrics. ([54663](https://github.com/WordPress/gutenberg/pull/54663))\n- Wrapped `TextareaControl` in a `forwardRef` call. ([54975](https://github.com/WordPress/gutenberg/pull/54975))\n\n#### Block Library\n- Add a brief description to the Footnotes block. ([54613](https://github.com/WordPress/gutenberg/pull/54613))\n- Footnotes: Use core\u2019s meta revisioning if available. ([52988](https://github.com/WordPress/gutenberg/pull/52988))\n- Login/out: Add spacing support. ([45147](https://github.com/WordPress/gutenberg/pull/45147))\n- Query view.js: Code quality. ([54982](https://github.com/WordPress/gutenberg/pull/54982))\n- Set custom color when applying initial background image. ([54054](https://github.com/WordPress/gutenberg/pull/54054))\n- Use `wp_get_inline_script_tag()` in `build_dropdown_script_block_core_categories()`. ([54637](https://github.com/WordPress/gutenberg/pull/54637))\n\n#### Block Editor\n- Default suggested links to pages. ([54622](https://github.com/WordPress/gutenberg/pull/54622))\n- Remove base URL from link control search results. ([54553](https://github.com/WordPress/gutenberg/pull/54553))\n- Simplify `BlockHTMLConvertButton`. ([54972](https://github.com/WordPress/gutenberg/pull/54972))\n- Update strings in blocks 'RenameModal' component. ([54887](https://github.com/WordPress/gutenberg/pull/54887))\n\n#### Post Editor\n- Edit Post: Use hooks instead of HoCs in 'PostStatus' components. ([54951](https://github.com/WordPress/gutenberg/pull/54951))\n- Editor: Use hooks instead of HoCs in 'PostSticky' components. ([54949](https://github.com/WordPress/gutenberg/pull/54949))\n- Editor: Use hooks instead of HoCs in 'PostSwitchToDraftButton'. ([54695](https://github.com/WordPress/gutenberg/pull/54695))\n- Show confirmation dialog when moving a post to the trash. ([50219](https://github.com/WordPress/gutenberg/pull/50219))\n\n#### Site Editor\n- Add template replace flow to template inspector. ([54609](https://github.com/WordPress/gutenberg/pull/54609))\n- [Site Editor]: Update copy of using  the default template in a page. ([54728](https://github.com/WordPress/gutenberg/pull/54728))\n\n#### Patterns\n- Remove category description in inserter panel. ([54894](https://github.com/WordPress/gutenberg/pull/54894))\n\n#### Typography\n- Font Library: Refactor endpoint permissions. ([54829](https://github.com/WordPress/gutenberg/pull/54829))\n\n\n### Bug Fixes\n\n- Fix the ShortcutProvider usage. ([54851](https://github.com/WordPress/gutenberg/pull/54851))\n- Fix warning when a template calls a template area twice. ([54861](https://github.com/WordPress/gutenberg/pull/54861))\n- Revert \"Fix warning when a template calls a template area twice\". ([54926](https://github.com/WordPress/gutenberg/pull/54926))\n\n#### Block Library\n- All Nav block items to break long titles. ([54866](https://github.com/WordPress/gutenberg/pull/54866))\n- Fallback to Twitter provider when embedding X URLs. ([54876](https://github.com/WordPress/gutenberg/pull/54876))\n- Fix Deleted Navigation Menu warning string. ([55033](https://github.com/WordPress/gutenberg/pull/55033))\n- Fix Search Block not updating in Nav block. ([54823](https://github.com/WordPress/gutenberg/pull/54823))\n- Fix left and right aligmnent in children of Post Template. ([54997](https://github.com/WordPress/gutenberg/pull/54997))\n- Fix output of Navigation block classnames in the editor. ([54992](https://github.com/WordPress/gutenberg/pull/54992))\n- Fix overwriting of published post meta when previewing footnote changes. ([54339](https://github.com/WordPress/gutenberg/pull/54339))\n- Image: Ensure Expand on Click toggle is shown if block-level lightbox setting exists. ([54878](https://github.com/WordPress/gutenberg/pull/54878))\n- Image: Fix layout shift when lightbox is opened and closed. ([53026](https://github.com/WordPress/gutenberg/pull/53026))\n- Media & Text: Fix React warning. ([55038](https://github.com/WordPress/gutenberg/pull/55038))\n- Search block: Allow space for input field only when form expanded. ([54846](https://github.com/WordPress/gutenberg/pull/54846))\n- Search block: Update alignment and icon button width. ([54773](https://github.com/WordPress/gutenberg/pull/54773))\n\n#### Site Editor\n- Avoid same key warnings in template parts area listings. ([54863](https://github.com/WordPress/gutenberg/pull/54863))\n- Avoid stale navigation block values when parsing entity record. ([54996](https://github.com/WordPress/gutenberg/pull/54996))\n- Don't display the navigation section in template parts details when a menu is missing. ([54993](https://github.com/WordPress/gutenberg/pull/54993))\n- Fix ToolSelector popover variant. ([54840](https://github.com/WordPress/gutenberg/pull/54840))\n- Reset 'Show template' toggle when leaving edit mode. ([54679](https://github.com/WordPress/gutenberg/pull/54679))\n- remove `overflow: Hidden` from the entity title in the site editor sidebar. ([54769](https://github.com/WordPress/gutenberg/pull/54769))\n\n#### Components\n- FormTokenField: Add `box-sizing` reset style and reset default padding. ([54734](https://github.com/WordPress/gutenberg/pull/54734))\n- Popover: Fix the styles for components that use emotion within popovers. ([54912](https://github.com/WordPress/gutenberg/pull/54912))\n- Remove hover style for secondary Button when aria-disabled is set. ([54978](https://github.com/WordPress/gutenberg/pull/54978))\n- Reverting addition of `aria-selected` style hook in `Button`. ([54931](https://github.com/WordPress/gutenberg/pull/54931))\n- `SlotFill`: Pass `Component` instance to unregisterSlot. ([54765](https://github.com/WordPress/gutenberg/pull/54765))\n\n#### Block Editor\n- Avoid double-wrapping selectors when transforming the styles. ([54981](https://github.com/WordPress/gutenberg/pull/54981))\n- [Inserter]: Fix reset of registered media categories. ([55012](https://github.com/WordPress/gutenberg/pull/55012))\n\n#### Typography\n- Font Library: Changed the OTF mime type expected value to be what PHP returns. ([54886](https://github.com/WordPress/gutenberg/pull/54886))\n- Font Library: Move font uploads to a new tab. ([54655](https://github.com/WordPress/gutenberg/pull/54655))\n\n#### Global Styles\n- Block custom CSS: Fix incorrect CSS when multiple root selectors. ([53602](https://github.com/WordPress/gutenberg/pull/53602))\n- Image: Ensure `false` values are preserved in memory when defined in `theme.json`. ([54639](https://github.com/WordPress/gutenberg/pull/54639))\n\n#### List View\n- Fix performance issue when selecting all blocks. ([54900](https://github.com/WordPress/gutenberg/pull/54900))\n\n#### Colors\n- Format Library: Try to fix highlight popover jumping. ([54736](https://github.com/WordPress/gutenberg/pull/54736))\n\n#### Interactivity API\n- Image: Fix duotone not being applied to lightbox image. ([54670](https://github.com/WordPress/gutenberg/pull/54670))\n\n\n### Accessibility\n\n#### Block Library\n- Footnotes: Add aria-label to return links. ([54843](https://github.com/WordPress/gutenberg/pull/54843))\n- Table of contents block accessibility improvements. ([54322](https://github.com/WordPress/gutenberg/pull/54322))\n\n#### Components\n- HTML block: Fix accessibility issues on back-end. ([54408](https://github.com/WordPress/gutenberg/pull/54408))\n- `Modal`: Accessibly hide/show outer modal when nested. ([54743](https://github.com/WordPress/gutenberg/pull/54743))\n\n#### Patterns\n- Use list role instead of listbox in patterns list. ([54884](https://github.com/WordPress/gutenberg/pull/54884))\n\n#### Post Editor\n- Editor: Always render the 'Switch to Draft' button to avoid focus loss. ([54722](https://github.com/WordPress/gutenberg/pull/54722))\n\n#### Block Editor\n- Block Switcher: Use a different label for multi-selection. ([54692](https://github.com/WordPress/gutenberg/pull/54692))\n\n\n### Performance\n\n- Tests: Support the Site Editor's legacy spinner. ([54784](https://github.com/WordPress/gutenberg/pull/54784))\n- Use instanceOf over property_exists. ([54835](https://github.com/WordPress/gutenberg/pull/54835))\n\n#### Block Editor\n- Subscribe only to block editor store in `useBlockSync`. ([55041](https://github.com/WordPress/gutenberg/pull/55041))\n\n\n### Experiments\n\n#### Site Editor\n- al]: First version of pages list in site editor. ([54966](https://github.com/WordPress/gutenberg/pull/54966))\n\n#### Block Editor\n- Expose `getDuotoneFilter()` as private API. ([54905](https://github.com/WordPress/gutenberg/pull/54905))\n\n\n### Documentation\n\n- Add a documentation page about the block editor settings. ([54870](https://github.com/WordPress/gutenberg/pull/54870))\n- Add a page about the format library to the platform documentation site. ([55037](https://github.com/WordPress/gutenberg/pull/55037))\n- Docs: Add a callout to the `wp-now` documentation to mention it's still experimental. ([55044](https://github.com/WordPress/gutenberg/pull/55044))\n- Docs: Remove outdated info. ([54707](https://github.com/WordPress/gutenberg/pull/54707))\n- Docs: Remove the Full Site Editing doc. ([54516](https://github.com/WordPress/gutenberg/pull/54516))\n- Docs: Rename Block Hooks handbook page to Block Filters. ([54862](https://github.com/WordPress/gutenberg/pull/54862))\n- Document the current state of the Real-Time collaboration experiment. ([54932](https://github.com/WordPress/gutenberg/pull/54932))\n- Fix a broken MD link in callout. ([54772](https://github.com/WordPress/gutenberg/pull/54772))\n- Platform Docs: Add a documentation page explaining how to use the block library. ([54967](https://github.com/WordPress/gutenberg/pull/54967))\n- Update the documentation of the block editor and replace @wordpress/element with react. ([54908](https://github.com/WordPress/gutenberg/pull/54908))\n- Update versions in WP for 6.4. ([54890](https://github.com/WordPress/gutenberg/pull/54890))\n\n\n### Code Quality\n\n- Add a unit test for the \"ValidBlockLibraryFunctionNameSniff\" sniff. ([53928](https://github.com/WordPress/gutenberg/pull/53928))\n- Move dependencies to the right place. ([54597](https://github.com/WordPress/gutenberg/pull/54597))\n- Move mime-type collection generation to a function that can be tested\u2026. ([54844](https://github.com/WordPress/gutenberg/pull/54844))\n- Post Title block should use esc_url(). ([53981](https://github.com/WordPress/gutenberg/pull/53981))\n- Rich text: Use getPasteEventData. ([55048](https://github.com/WordPress/gutenberg/pull/55048))\n- Writing flow: Absorb clipboard handler. ([55006](https://github.com/WordPress/gutenberg/pull/55006))\n\n#### Block Library\n- Footnotes: Avoid regexes in entity provider. ([54505](https://github.com/WordPress/gutenberg/pull/54505))\n- Image Block: Fix browser console error when clicking \"Expand on Click\". ([54938](https://github.com/WordPress/gutenberg/pull/54938))\n- Removed unwanted space from the string. ([54654](https://github.com/WordPress/gutenberg/pull/54654))\n- Update CODEOWNERS for `core/image` block. ([54793](https://github.com/WordPress/gutenberg/pull/54793))\n\n#### Patterns\n- Add a new spec for for adding an unsynced pattern. ([54892](https://github.com/WordPress/gutenberg/pull/54892))\n- Add end-to-end tests for filtering and searching patterns. ([54906](https://github.com/WordPress/gutenberg/pull/54906))\n- Add new end-to-end test for creating a pattern. ([54855](https://github.com/WordPress/gutenberg/pull/54855))\n- Include pattern category in main end-to-end critical path test. ([54923](https://github.com/WordPress/gutenberg/pull/54923))\n\n#### Components\n- Consolidate utils to remove `ui/`. ([54922](https://github.com/WordPress/gutenberg/pull/54922))\n- Move `ContextSystemProvider` out of `/ui`. ([54847](https://github.com/WordPress/gutenberg/pull/54847))\n- SlotFill: Migrate to Typescript. ([51350](https://github.com/WordPress/gutenberg/pull/51350))\n- Tidying `CircularOptionPicker.Option`. ([54903](https://github.com/WordPress/gutenberg/pull/54903))\n\n#### Typography\n- Font Library: Syntax refactor repace strpos with str_contains. ([54832](https://github.com/WordPress/gutenberg/pull/54832))\n- Font Library: Use snake_case instead of camelCase on fontFamilies endpoint param. ([54977](https://github.com/WordPress/gutenberg/pull/54977))\n\n#### Block Editor\n- Rich text: Avoid shortcode logic, adjust paste handler instead. ([55052](https://github.com/WordPress/gutenberg/pull/55052))\n\n#### Plugin\n- Remove legacy logic for '__unstableResolvedAssets' setting. ([54812](https://github.com/WordPress/gutenberg/pull/54812))\n\n#### Data Layer\n- createResolversCacheMiddleware: Remove dependency on core/data store. ([54733](https://github.com/WordPress/gutenberg/pull/54733))\n\n#### Site Editor\n- Use constants rather than hard coded template strings (round 3). ([54705](https://github.com/WordPress/gutenberg/pull/54705))\n\n\n### Tools\n\n- Label enforcer workflow: Make accessibility a focus instead of a type. ([54941](https://github.com/WordPress/gutenberg/pull/54941))\n- Scripts: Update webpack and related dependencies to the latest version. ([54657](https://github.com/WordPress/gutenberg/pull/54657))\n- Update changelog automation and test fixtures to match the last a11y label renaming. ([54974](https://github.com/WordPress/gutenberg/pull/54974))\n\n#### Testing\n- Don\u2019t use TypeScript files in scripts package. ([54856](https://github.com/WordPress/gutenberg/pull/54856))\n- ESLint: Update eslint-plugin-testing-library to v6. ([54910](https://github.com/WordPress/gutenberg/pull/54910))\n- Fix end-to-end test: \u201dWP Editor Meta Boxes > Should save the changes\u201d. ([51884](https://github.com/WordPress/gutenberg/pull/51884))\n- Font Library: Avoid deprected error in test. ([54802](https://github.com/WordPress/gutenberg/pull/54802))\n- Make `editor.getBlocks` to return only testing-related properties. ([54901](https://github.com/WordPress/gutenberg/pull/54901))\n- Migrate 'Global styles sidebar' test to Playwright. ([55045](https://github.com/WordPress/gutenberg/pull/55045))\n- Migrate 'iframed block editor settings styles' tests to Playwright. ([55014](https://github.com/WordPress/gutenberg/pull/55014))\n- Migrate 'iframed inline styles' tests to Playwright. ([55009](https://github.com/WordPress/gutenberg/pull/55009))\n- Migrate 'iframed masonry block' tests to Playwright. ([55016](https://github.com/WordPress/gutenberg/pull/55016))\n- Migrate 'iframed multiple block stylesheets' tests to Playwright. ([55003](https://github.com/WordPress/gutenberg/pull/55003))\n- Migrate keyboard-navigable-blocks end-to-end tests from puppeteer to playwright. ([54944](https://github.com/WordPress/gutenberg/pull/54944))\n- Scripts: Properly use CommonJS for default Playwright configuration. ([54988](https://github.com/WordPress/gutenberg/pull/54988))\n- Try fixing the flaky 'Toolbar roving tabindex' end-to-end test. ([54785](https://github.com/WordPress/gutenberg/pull/54785))\n- end-to-end Tests: Revert temporary fixes. ([54865](https://github.com/WordPress/gutenberg/pull/54865))\n- end-to-end Utils: Allow overriding username/password. ([53267](https://github.com/WordPress/gutenberg/pull/53267))\n\n#### Build Tooling\n- Add some @types packages as proper dependencies. ([50231](https://github.com/WordPress/gutenberg/pull/50231))\n- Update the default JSX pragma to React instead of @wordpress/element. ([54494](https://github.com/WordPress/gutenberg/pull/54494))\n- Upgrade wp-prettier to v3.0.3 (final). ([54775](https://github.com/WordPress/gutenberg/pull/54775))\n\n\n### Security\n\n#### Data Layer\n- Replace turbo-combine-reducers with combineReducers from Redux. ([54606](https://github.com/WordPress/gutenberg/pull/54606))\n\n\n### Various\n\n- (chore) Revert the 16.7 RC2 release in order to release it again due to wrong changelog. ([54744](https://github.com/WordPress/gutenberg/pull/54744))\n\n#### Design Tools\n- Background image block support: Add tests, adjust injection logic slightly. ([54489](https://github.com/WordPress/gutenberg/pull/54489))\n- Background support: Backport fix for undefined array key. ([54850](https://github.com/WordPress/gutenberg/pull/54850))\n\n#### Typography\n- Revert \"Font Library: Avoid rendering font library ui outisde gutenberg plugin\". ([54947](https://github.com/WordPress/gutenberg/pull/54947))\n\n#### Commands\n- Make the reset styles command consistent. ([54841](https://github.com/WordPress/gutenberg/pull/54841))\n\n#### Patterns\n- Use \"Not synced\" in place of \"Standard\" nomenclature for patterns. ([54839](https://github.com/WordPress/gutenberg/pull/54839))\n\n#### Block Editor\n- Simplify BlockPatternsSyncFilter with clearer labels and additional context. ([54838](https://github.com/WordPress/gutenberg/pull/54838))\n\n#### Site Editor\n- Use consistent capitalization for template parts in Site Editor constants. ([54709](https://github.com/WordPress/gutenberg/pull/54709))\n\n\n## First time contributors\n\nThe following PRs were merged by first time contributors:\n\n- @leemyongpakvn: Fix a broken MD link in callout. ([54772](https://github.com/WordPress/gutenberg/pull/54772))\n\n\n## Contributors\n\nThe following contributors merged PRs in this release:\n\n@aaronrobertshaw @adamsilverstein @alexstine @andrewhayward @andrewserong @annezazu @anton-vlasenko @artemiomorales @aurooba @bangank36 @brookewp @c4rl0sbr4v0 @carolinan @chad1008 @ciampo @dcalhoun @derekblank @draganescu @ellatrix @fluiddot @fullofcaffeine @geriux @getdave @glendaviesnz @gziolo @jameskoster @jeryj @jsnajdr @juhi123 @kevin940726 @leemyongpakvn @madhusudhand @MaggieCabrera @Mamaduka @matiasbenedetto @michalczaplinski @mirka @mtias @mujuonly @ndiego @noahtallen @noisysocks @ntsekouras @oandregal @ockham @pbking @priethor @ramonjd @richtabor @scruffian @SiobhyB @spacedmonkey @stokesman @swissspidy @t-hamano @tellthemachines @tellyworth @them-es @torounit @tyxla @westonruter @WunderBart @youknowriad\n\n\n\n";

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
