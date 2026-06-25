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
		it( 'falls back to GitHub when the WP.org profile fetch fails', async () => {
			vi.mocked( fetchWPOrgProfile ).mockResolvedValueOnce( null );
			vi.mocked( fetchGitHubUserProfile ).mockResolvedValueOnce( {
				login: 'example-user',
				name: 'Example User',
				company: '@Acme',
				location: 'Berlin, Germany',
				bio: null,
			} );

			const profiles = await fetchContributorProfiles( [ 'example-user' ], null, {
				delayMs: 0,
				verbose: false,
			} );

			expect( fetchGitHubUserProfile ).toHaveBeenCalledWith( 'example-user' );
			expect( profiles.get( 'example-user' ) ).toEqual( {
				sponsor: 'Acme',
				location: 'Berlin, Germany',
			} );
		} );
	} );
});
