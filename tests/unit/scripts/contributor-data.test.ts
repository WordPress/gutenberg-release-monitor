import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	fetchContributorProfiles,
	isUnavailableSponsorValue,
} from '../../../scripts/utils/contributor-data.js';
import { fetchGitHubUserProfile } from '../../../scripts/utils/github-api.js';
import { fetchWPOrgProfile } from '../../../scripts/utils/wporg-api.js';

vi.mock( '../../../scripts/utils/wporg-api.js', () => ( {
	fetchWPOrgProfile: vi.fn(),
} ) );

vi.mock( '../../../scripts/utils/github-api.js', () => ( {
	fetchGitHubUserProfile: vi.fn(),
} ) );

describe('contributor data utilities', () => {
	beforeEach( () => {
		vi.clearAllMocks();
	} );

	describe('isUnavailableSponsorValue', () => {
		it('treats empty and placeholder values as missing', () => {
			expect(isUnavailableSponsorValue(null)).toBe(true);
			expect(isUnavailableSponsorValue('')).toBe(true);
			expect(isUnavailableSponsorValue('n/a')).toBe(true);
			expect(isUnavailableSponsorValue('None')).toBe(true);
			expect(isUnavailableSponsorValue('-')).toBe(true);
			expect(isUnavailableSponsorValue('not applicable')).toBe(true);
		});

		it('keeps real employer values', () => {
			expect(isUnavailableSponsorValue('Automattic')).toBe(false);
			expect(isUnavailableSponsorValue('Self-employed')).toBe(false);
		});
	});

	describe( 'fetchContributorProfiles', () => {
		it( 'leaves a contributor out when WP.org profile fetch is skipped', async () => {
			vi.mocked( fetchWPOrgProfile ).mockResolvedValueOnce( null );

			const profiles = await fetchContributorProfiles( [ 'example-user' ], null, {
				delayMs: 0,
				verbose: false,
			} );

			expect( profiles.has( 'example-user' ) ).toBe( false );
			expect( fetchGitHubUserProfile ).not.toHaveBeenCalled();
		} );
	} );
});
