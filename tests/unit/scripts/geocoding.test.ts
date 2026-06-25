import { describe, expect, it } from 'vitest';
import { extractCountry } from '../../../scripts/utils/geocoding.js';

describe('geocoding utilities', () => {
	describe('extractCountry', () => {
		it('handles country names and short aliases without the API', () => {
			expect(extractCountry('Colorado, USA')).toMatchObject({
				country: 'United States',
				method: 'local',
			});
			expect(extractCountry('London, UK')).toMatchObject({
				country: 'United Kingdom',
				method: 'local',
			});
			expect(extractCountry('Germany, NRW, Bergkamen')).toMatchObject({
				country: 'Germany',
				method: 'local',
			});
		});

		it('maps familiar regions and cities without the API', () => {
			expect(extractCountry('San Francisco, CA')).toMatchObject({
				country: 'United States',
				method: 'local',
			});
			expect(extractCountry('QLD')).toMatchObject({
				country: 'Australia',
				method: 'local',
			});
			expect(extractCountry('Mumbai')).toMatchObject({
				country: 'India',
				method: 'local',
			});
			expect(extractCountry('Oleśnica')).toMatchObject({
				country: 'Poland',
				method: 'local',
			});
		});

		it('disambiguates US-state Georgia from the country', () => {
			expect(extractCountry('Georgia, USA')).toMatchObject({
				country: 'United States',
				method: 'local',
			});
			expect(extractCountry('Savannah, Georgia, US')).toMatchObject({
				country: 'United States',
				method: 'local',
			});
			expect(extractCountry('Tbilisi')).toMatchObject({
				country: 'Georgia',
				method: 'local',
			});
		});

		it('handles dotted country abbreviations', () => {
			expect(extractCountry('U.S.A.')).toMatchObject({
				country: 'United States',
				method: 'local',
			});
			expect(extractCountry('U.K.')).toMatchObject({
				country: 'United Kingdom',
				method: 'local',
			});
			expect(extractCountry('Boston, U.S.A.')).toMatchObject({
				country: 'United States',
				method: 'local',
			});
		});

		it('keeps generic remote locations unresolved', () => {
			expect(extractCountry('Remote')).toEqual({
				country: null,
				confidence: 'low',
				method: 'none',
			});
		});
	});
});
