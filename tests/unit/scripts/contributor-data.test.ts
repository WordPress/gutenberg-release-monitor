import { describe, expect, it } from 'vitest';
import { isUnavailableSponsorValue } from '../../../scripts/utils/contributor-data.js';

describe('contributor data utilities', () => {
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
});
