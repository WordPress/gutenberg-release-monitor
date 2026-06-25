import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	batchGeocodeLocations,
	clearGeocodeCache,
	extractCountry,
} from '../../../scripts/utils/geocoding.js';

const tempDirs: string[] = [];

function createTempCachePath(): string {
	const directory = mkdtempSync( join( tmpdir(), 'geocoding-test-' ) );
	tempDirs.push( directory );
	return join( directory, 'geocode-cache.json' );
}

function jsonResponse( status: number, body: unknown ): Response {
	return new Response( JSON.stringify( body ), {
		status,
		headers: { 'Content-Type': 'application/json' },
	} );
}

afterEach(() => {
	clearGeocodeCache();
	vi.restoreAllMocks();
	for ( const directory of tempDirs.splice( 0 ) ) {
		rmSync( directory, { recursive: true, force: true } );
	}
});

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
				status: 'not_found',
			});
		});
	});

	describe('batchGeocodeLocations', () => {
		it('retries temporary failures instead of caching Unknown', async () => {
			const cachePath = createTempCachePath();
			const location = 'Retry Probe City';
			const failingFetch = vi.fn< typeof fetch >(async () =>
				jsonResponse(429, { error: 'rate limited' })
			);

			await expect(
				batchGeocodeLocations([location], {
					cachePath,
					delayMs: 0,
					maxRetries: 1,
					retryDelayMs: 0,
					fetchImpl: failingFetch,
				})
			).rejects.toThrow(/Geocoding failed after retries/);

			expect(failingFetch).toHaveBeenCalledTimes(2);
			expect(existsSync(cachePath)).toBe(false);

			const successfulFetch = vi.fn< typeof fetch >(async () =>
				jsonResponse(200, [{ address: { country: 'France' } }])
			);
			const results = await batchGeocodeLocations([location], {
				cachePath,
				delayMs: 0,
				maxRetries: 0,
				retryDelayMs: 0,
				fetchImpl: successfulFetch,
			});

			expect(successfulFetch).toHaveBeenCalledTimes(1);
			expect(results.get(location)).toMatchObject({
				country: 'France',
				method: 'api',
				status: 'resolved',
			});
		});

		it('caches a confirmed empty API result as not found', async () => {
			const cachePath = createTempCachePath();
			const location = 'Confirmed Empty Place';
			const fetchImpl = vi.fn< typeof fetch >(async () => jsonResponse(200, []));

			const firstResults = await batchGeocodeLocations([location], {
				cachePath,
				delayMs: 0,
				fetchImpl,
			});

			expect(firstResults.get(location)).toMatchObject({
				country: null,
				method: 'api',
				status: 'not_found',
			});
			expect(fetchImpl).toHaveBeenCalledTimes(1);

			clearGeocodeCache();
			const secondResults = await batchGeocodeLocations([location], {
				cachePath,
				delayMs: 0,
				fetchImpl,
			});

			expect(fetchImpl).toHaveBeenCalledTimes(1);
			expect(secondResults.get(location)).toMatchObject({
				country: null,
				method: 'api',
				status: 'not_found',
			});
		});

		it('uses the persisted cache without storing raw locations', async () => {
			const cachePath = createTempCachePath();
			const location = 'Cache Probe City';
			const fetchImpl = vi.fn< typeof fetch >(async () =>
				jsonResponse(200, [{ address: { country: 'Spain' } }])
			);

			await batchGeocodeLocations([location], {
				cachePath,
				delayMs: 0,
				fetchImpl,
			});

			const cacheContent = readFileSync(cachePath, 'utf-8');
			expect(cacheContent).toContain('Spain');
			expect(cacheContent).not.toContain(location);

			clearGeocodeCache();
			const cachedFetch = vi.fn< typeof fetch >();
			const results = await batchGeocodeLocations([location], {
				cachePath,
				delayMs: 0,
				fetchImpl: cachedFetch,
			});

			expect(cachedFetch).not.toHaveBeenCalled();
			expect(results.get(location)).toMatchObject({
				country: 'Spain',
				method: 'api',
				status: 'resolved',
			});
		});

		it('can leave the persisted cache read-only', async () => {
			const cachePath = createTempCachePath();
			const fetchImpl = vi.fn< typeof fetch >(async () =>
				jsonResponse(200, [{ address: { country: 'Canada' } }])
			);

			const results = await batchGeocodeLocations(['Read Only Cache City'], {
				cachePath,
				delayMs: 0,
				fetchImpl,
				writeCache: false,
			});

			expect(results.get('Read Only Cache City')).toMatchObject({
				country: 'Canada',
				status: 'resolved',
			});
			expect(existsSync(cachePath)).toBe(false);
		});

		it('uses local aliases without calling the API', async () => {
			const fetchImpl = vi.fn< typeof fetch >();
			const results = await batchGeocodeLocations(['London, UK'], {
				cachePath: null,
				delayMs: 0,
				fetchImpl,
			});

			expect(fetchImpl).not.toHaveBeenCalled();
			expect(results.get('London, UK')).toMatchObject({
				country: 'United Kingdom',
				method: 'local',
				status: 'resolved',
			});
		});
	});
});
