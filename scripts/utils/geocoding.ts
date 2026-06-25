import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Location → Country geocoding using OpenStreetMap Nominatim API.
 *
 * Rate limit: 1 request/second (per OSM usage policy)
 * https://nominatim.org/release-docs/develop/api/Search/
 */

export type GeocodingStatus = 'resolved' | 'not_found' | 'failed';

export interface GeocodingResult {
	country: string | null;
	confidence: 'high' | 'medium' | 'low';
	method: 'api' | 'local' | 'none';
	status: GeocodingStatus;
	error?: string;
}

interface PersistedGeocodeCacheEntry {
	country: string | null;
	confidence: GeocodingResult[ 'confidence' ];
	method: 'api';
	status: 'resolved' | 'not_found';
	createdAt: string;
	updatedAt: string;
}

interface PersistedGeocodeCache {
	version: 1;
	entries: Record< string, PersistedGeocodeCacheEntry >;
}

type FetchLike = typeof fetch;

interface GeocodingRequestOptions {
	fetchImpl?: FetchLike;
	maxRetries?: number;
	retryDelayMs?: number;
	timeoutMs?: number;
}

export interface BatchGeocodeOptions extends GeocodingRequestOptions {
	delayMs?: number;
	cachePath?: string | null;
	writeCache?: boolean;
	onProgress?: ( done: number, total: number ) => void;
}

export class GeocodingBatchError extends Error {
	constructor(
		message: string,
		public readonly failures: GeocodingResult[]
	) {
		super( message );
		this.name = 'GeocodingBatchError';
	}
}

const DEFAULT_GEOCODE_CACHE_PATH = 'scripts/data/geocode-cache.json';
const GEOCODE_CACHE_VERSION = 1;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 10000;
const RETRIABLE_STATUS_CODES = new Set( [ 403, 408, 429 ] );

/**
 * Country names and short aliases we can trust without calling Nominatim.
 * Keep the list narrow: exact names, common abbreviations, and countries we
 * have already seen in contributor data.
 */
const COUNTRY_ALIASES: Record< string, string > = {
	'algeria': 'Algeria',
	'argentina': 'Argentina',
	'au': 'Australia',
	'australia': 'Australia',
	'bangladesh': 'Bangladesh',
	'belgium': 'Belgium',
	'brazil': 'Brazil',
	'bulgaria': 'Bulgaria',
	'canada': 'Canada',
	'colombia': 'Colombia',
	'czech republic': 'Czechia',
	'czechia': 'Czechia',
	'denmark': 'Denmark',
	'deutschland': 'Germany',
	'france': 'France',
	// Plain "georgia" is ambiguous with the US state. The country resolves via
	// "tbilisi" below, while "Georgia, USA" resolves through the country alias.
	'germany': 'Germany',
	'greece': 'Greece',
	'hungary': 'Hungary',
	'india': 'India',
	'italia': 'Italy',
	'italy': 'Italy',
	'japan': 'Japan',
	'lithuania': 'Lithuania',
	'mexico': 'Mexico',
	'morocco': 'Morocco',
	'netherlands': 'Netherlands',
	'new zealand': 'New Zealand',
	'pakistan': 'Pakistan',
	'poland': 'Poland',
	'portugal': 'Portugal',
	'south africa': 'South Africa',
	'spain': 'Spain',
	'uk': 'United Kingdom',
	'united kingdom': 'United Kingdom',
	'us': 'United States',
	'usa': 'United States',
	'united states': 'United States',
	'united states of america': 'United States',
	'vietnam': 'Vietnam',
};

/**
 * Use these only when the location does not already name a country.
 */
const LOCATION_ALIASES: Record< string, string > = {
	// United States
	'alabama': 'United States',
	'alaska': 'United States',
	'arizona': 'United States',
	'arkansas': 'United States',
	'california': 'United States',
	'colorado': 'United States',
	'connecticut': 'United States',
	'delaware': 'United States',
	'florida': 'United States',
	'hawaii': 'United States',
	'idaho': 'United States',
	'illinois': 'United States',
	'indiana': 'United States',
	'iowa': 'United States',
	'kansas': 'United States',
	'kentucky': 'United States',
	'louisiana': 'United States',
	'maine': 'United States',
	'maryland': 'United States',
	'massachusetts': 'United States',
	'michigan': 'United States',
	'minnesota': 'United States',
	'mississippi': 'United States',
	'missouri': 'United States',
	'montana': 'United States',
	'nebraska': 'United States',
	'nevada': 'United States',
	'new hampshire': 'United States',
	'new jersey': 'United States',
	'new mexico': 'United States',
	'new york': 'United States',
	'north carolina': 'United States',
	'north dakota': 'United States',
	'ohio': 'United States',
	'oklahoma': 'United States',
	'oregon': 'United States',
	'pennsylvania': 'United States',
	'rhode island': 'United States',
	'south carolina': 'United States',
	'south dakota': 'United States',
	'tennessee': 'United States',
	'texas': 'United States',
	'utah': 'United States',
	'vermont': 'United States',
	'virginia': 'United States',
	'washington': 'United States',
	'west virginia': 'United States',
	'wisconsin': 'United States',
	'wyoming': 'United States',
	'new bedford': 'United States',
	'san francisco': 'United States',

	// Australia
	'act': 'Australia',
	'new south wales': 'Australia',
	'nsw': 'Australia',
	'queensland': 'Australia',
	'qld': 'Australia',
	'south australia': 'Australia',
	'tasmania': 'Australia',
	'victoria': 'Australia',
	'western australia': 'Australia',

	// India
	'gujarat': 'India',
	'hyderabad': 'India',
	'kolkata': 'India',
	'maharashtra': 'India',
	'mumbai': 'India',
	'new delhi': 'India',
	'pune': 'India',
	'west bengal': 'India',

	// Contributor locations we have seen often enough to map safely.
	'barcelona': 'Spain',
	'oleśnica': 'Poland',
	'olesnica': 'Poland',
	'pilsen': 'Czechia',
	'tbilisi': 'Georgia',
	'turin': 'Italy',
};

const GENERIC_LOCATIONS = new Set( [
	'remote',
	'remote work',
	'worldwide',
	'earth',
	'internet',
] );

function resolvedResult(
	country: string,
	confidence: GeocodingResult[ 'confidence' ],
	method: GeocodingResult[ 'method' ]
): GeocodingResult {
	return { country, confidence, method, status: 'resolved' };
}

function notFoundResult(
	method: GeocodingResult[ 'method' ] = 'none'
): GeocodingResult {
	return { country: null, confidence: 'low', method, status: 'not_found' };
}

function failedResult( error: string ): GeocodingResult {
	return {
		country: null,
		confidence: 'low',
		method: 'none',
		status: 'failed',
		error,
	};
}

function cleanLocation( location: string ): string {
	return location
		.replace( /\s*\([^)]*\)\s*/g, ' ' )
		.replace( /[""]/g, '' )
		.replace( /\s+/g, ' ' )
		.trim();
}

function normalizeLocationToken( value: string ): string {
	return value
		.normalize( 'NFD' )
		.replace( /[\u0300-\u036f]/g, '' )
		.toLowerCase()
		// Drop abbreviation dots so "u.s.a." → "usa". Dots before a space
		// still become separators in the next step, as in "st. louis".
		.replace( /\.(?=\S)/g, '' )
		.replace( /[._]/g, ' ' )
		.replace( /[^a-z0-9\s]/g, ' ' )
		.replace( /\s+/g, ' ' )
		.trim();
}

function getCacheKey( location: string ): string | null {
	const normalized = normalizeLocationToken( cleanLocation( location ) );
	if ( ! normalized ) {
		return null;
	}

	return createHash( 'sha256' ).update( normalized ).digest( 'hex' );
}

function createEmptyPersistedCache(): PersistedGeocodeCache {
	return {
		version: GEOCODE_CACHE_VERSION,
		entries: {},
	};
}

function isPersistedCacheEntry(
	value: unknown
): value is PersistedGeocodeCacheEntry {
	if ( ! value || typeof value !== 'object' ) {
		return false;
	}

	const entry = value as Partial< PersistedGeocodeCacheEntry >;
	return (
		( entry.status === 'resolved' || entry.status === 'not_found' ) &&
		entry.method === 'api' &&
		( entry.country === null || typeof entry.country === 'string' ) &&
		typeof entry.createdAt === 'string' &&
		typeof entry.updatedAt === 'string'
	);
}

function loadPersistedCache( cachePath: string ): PersistedGeocodeCache {
	if ( ! existsSync( cachePath ) ) {
		return createEmptyPersistedCache();
	}

	try {
		const parsed = JSON.parse( readFileSync( cachePath, 'utf-8' ) ) as
			Partial< PersistedGeocodeCache >;
		const entries: PersistedGeocodeCache[ 'entries' ] = {};

		for ( const [ key, entry ] of Object.entries( parsed.entries ?? {} ) ) {
			if ( isPersistedCacheEntry( entry ) ) {
				entries[ key ] = entry;
			}
		}

		return {
			version: GEOCODE_CACHE_VERSION,
			entries,
		};
	} catch {
		console.warn( `⚠️  Failed to parse ${ cachePath }; starting with an empty geocode cache.` );
		return createEmptyPersistedCache();
	}
}

function writePersistedCacheIfChanged(
	cachePath: string,
	cache: PersistedGeocodeCache
): boolean {
	const sortedCache: PersistedGeocodeCache = {
		version: GEOCODE_CACHE_VERSION,
		entries: Object.fromEntries(
			Object.entries( cache.entries ).sort( ( [ a ], [ b ] ) =>
				a.localeCompare( b )
			)
		),
	};
	const nextContent = `${ JSON.stringify( sortedCache, null, 2 ) }\n`;

	if (
		existsSync( cachePath ) &&
		readFileSync( cachePath, 'utf-8' ) === nextContent
	) {
		return false;
	}

	mkdirSync( dirname( cachePath ), { recursive: true } );
	writeFileSync( cachePath, nextContent );
	return true;
}

function resultFromPersistedEntry(
	entry: PersistedGeocodeCacheEntry
): GeocodingResult {
	return {
		country: entry.country,
		confidence: entry.confidence,
		method: entry.method,
		status: entry.status,
	};
}

function shouldPersistResult( result: GeocodingResult ): boolean {
	return (
		result.method === 'api' &&
		( result.status === 'resolved' || result.status === 'not_found' )
	);
}

function updatePersistedCache(
	cache: PersistedGeocodeCache,
	key: string,
	result: GeocodingResult
): boolean {
	if ( ! shouldPersistResult( result ) ) {
		return false;
	}

	const existing = cache.entries[ key ];
	const now = new Date().toISOString();
	const nextEntry: PersistedGeocodeCacheEntry = {
		country: result.country,
		confidence: result.confidence,
		method: 'api',
		status: result.status as PersistedGeocodeCacheEntry[ 'status' ],
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	};

	if (
		existing &&
		existing.country === nextEntry.country &&
		existing.confidence === nextEntry.confidence &&
		existing.method === nextEntry.method &&
		existing.status === nextEntry.status
	) {
		return false;
	}

	cache.entries[ key ] = nextEntry;
	return true;
}

function getLocationTokens( cleaned: string ): string[] {
	const splitTokens = cleaned
		.split( /[,;/|]+/ )
		.map( normalizeLocationToken )
		.filter( Boolean );

	return [ normalizeLocationToken( cleaned ), ...splitTokens ];
}

function hasWholePhrase( normalizedLocation: string, alias: string ): boolean {
	const escaped = alias.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	return new RegExp( `(?:^|\\s)${ escaped }(?:\\s|$)` ).test(
		normalizedLocation
	);
}

function resolveCountryLocally( location: string ): GeocodingResult | null {
	const cleaned = cleanLocation( location );
	if ( ! cleaned ) {
		return notFoundResult();
	}

	const normalizedLocation = normalizeLocationToken( cleaned );
	if ( GENERIC_LOCATIONS.has( normalizedLocation ) ) {
		return notFoundResult();
	}

	const tokens = getLocationTokens( cleaned );
	const countryAliases = Object.entries( COUNTRY_ALIASES ).sort(
		( [ a ], [ b ] ) => b.length - a.length
	);

	for ( const [ alias, country ] of countryAliases ) {
		if (
			tokens.includes( alias ) ||
			( alias.length > 2 && hasWholePhrase( normalizedLocation, alias ) )
		) {
			return resolvedResult( country, 'high', 'local' );
		}
	}

	for ( const token of tokens ) {
		const country = LOCATION_ALIASES[ token ];
		if ( country ) {
			return resolvedResult( country, 'medium', 'local' );
		}
	}

	return null;
}

function sleep( ms: number ): Promise< void > {
	return new Promise( resolve => setTimeout( resolve, ms ) );
}

function isRetriableStatus( status: number ): boolean {
	return RETRIABLE_STATUS_CODES.has( status ) || status >= 500;
}

function getErrorMessage( error: unknown ): string {
	return error instanceof Error ? error.message : String( error );
}

async function fetchWithTimeout(
	fetchImpl: FetchLike,
	url: string,
	timeoutMs: number
): Promise< Response > {
	const controller = new AbortController();
	const timeout = setTimeout( () => controller.abort(), timeoutMs );

	try {
		return await fetchImpl( url, {
			headers: {
				// Required by Nominatim usage policy
				'User-Agent': 'GutenbergReleaseMonitor/1.0 (https://github.com/WordPress/gutenberg)',
			},
			signal: controller.signal,
		} );
	} catch ( error ) {
		if ( error instanceof Error && error.name === 'AbortError' ) {
			throw new Error( `Nominatim request timed out after ${ timeoutMs }ms` );
		}
		throw error;
	} finally {
		clearTimeout( timeout );
	}
}

async function geocodeWithNominatim(
	cleanedLocation: string,
	options: GeocodingRequestOptions = {}
): Promise< GeocodingResult > {
	const {
		fetchImpl = fetch,
		maxRetries = DEFAULT_MAX_RETRIES,
		retryDelayMs = DEFAULT_RETRY_DELAY_MS,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = options;
	const url = new URL( 'https://nominatim.openstreetmap.org/search' );
	url.searchParams.set( 'q', cleanedLocation );
	url.searchParams.set( 'format', 'json' );
	url.searchParams.set( 'addressdetails', '1' );
	url.searchParams.set( 'limit', '1' );
	url.searchParams.set( 'accept-language', 'en' );

	for ( let attempt = 0; attempt <= maxRetries; attempt++ ) {
		try {
			const response = await fetchWithTimeout(
				fetchImpl,
				url.toString(),
				timeoutMs
			);

			if ( ! response.ok ) {
				const message = `Nominatim responded with HTTP ${ response.status }`;
				if ( attempt < maxRetries && isRetriableStatus( response.status ) ) {
					await sleep( retryDelayMs * 2 ** attempt );
					continue;
				}

				return failedResult( `${ message } after ${ attempt + 1 } attempt(s)` );
			}

			const data = await response.json() as unknown;
			if ( ! Array.isArray( data ) ) {
				return failedResult(
					`Nominatim returned an unexpected response after ${ attempt + 1 } attempt(s)`
				);
			}

			const firstResult = data[ 0 ] as
				| { address?: { country?: unknown } }
				| undefined;
			if ( typeof firstResult?.address?.country === 'string' ) {
				return resolvedResult( firstResult.address.country, 'high', 'api' );
			}

			return notFoundResult( 'api' );
		} catch ( error ) {
			const message = getErrorMessage( error );
			if ( attempt < maxRetries ) {
				await sleep( retryDelayMs * 2 ** attempt );
				continue;
			}

			return failedResult( `${ message } after ${ attempt + 1 } attempt(s)` );
		}
	}

	return failedResult( 'Nominatim request failed after retries' );
}

/**
 * Resolve a location to a country, using local aliases before Nominatim.
 */
export async function extractCountryAsync(
	location: string,
	options: GeocodingRequestOptions = {}
): Promise< GeocodingResult > {
	if ( ! location || typeof location !== 'string' || ! location.trim() ) {
		return notFoundResult();
	}

	const localResult = resolveCountryLocally( location );
	if ( localResult ) {
		return localResult;
	}

	const cleaned = cleanLocation( location );

	if ( ! cleaned ) {
		return notFoundResult();
	}

	return geocodeWithNominatim( cleaned, options );
}

/**
 * Synchronous wrapper that returns cached result or null.
 * For use in compute-release-aggregates.ts which handles async elsewhere.
 */
const geocodeCache = new Map< string, GeocodingResult >();

export function extractCountry( location: string ): GeocodingResult {
	// Batch geocoding fills this before aggregates are computed.
	const cached = geocodeCache.get( location );
	if ( cached ) {
		return cached;
	}

	const localResult = resolveCountryLocally( location );
	if ( localResult ) {
		return localResult;
	}

	// Nothing local is safe to infer; batch processing can still resolve it.
	return notFoundResult();
}

function createBatchFailure( result: GeocodingResult ): GeocodingBatchError {
	const reason = result.error ? ` ${ result.error }.` : '';
	return new GeocodingBatchError(
		`Geocoding failed after retries for a location.${ reason } ` +
			'The failed lookup was not cached, so contributor aggregates were not written with a temporary Unknown country.',
		[ result ]
	);
}

/**
 * Batch geocode locations with rate limiting.
 */
export async function batchGeocodeLocations(
	locations: string[],
	options: BatchGeocodeOptions = {}
): Promise< Map< string, GeocodingResult > > {
	const {
		delayMs = 1100,
		cachePath = DEFAULT_GEOCODE_CACHE_PATH,
		writeCache = true,
		onProgress,
		...requestOptions
	} = options;
	const results = new Map< string, GeocodingResult >();
	const unique = [
		...new Set(
			locations.filter(
				( location ): location is string =>
					typeof location === 'string' && Boolean( location.trim() )
			)
		),
	];
	const persistedCache = cachePath
		? loadPersistedCache( cachePath )
		: createEmptyPersistedCache();
	let persistedCacheChanged = false;

	for ( let i = 0; i < unique.length; i++ ) {
		const location = unique[ i ];

		// Reuse results from earlier in this run.
		if ( geocodeCache.has( location ) ) {
			results.set( location, geocodeCache.get( location )! );
			onProgress?.( i + 1, unique.length );
			continue;
		}

		const localResult = resolveCountryLocally( location );
		if ( localResult ) {
			results.set( location, localResult );
			geocodeCache.set( location, localResult );
			onProgress?.( i + 1, unique.length );
			continue;
		}

		const cacheKey = getCacheKey( location );
		if ( cacheKey && persistedCache.entries[ cacheKey ] ) {
			const persistedResult = resultFromPersistedEntry(
				persistedCache.entries[ cacheKey ]
			);
			results.set( location, persistedResult );
			geocodeCache.set( location, persistedResult );
			onProgress?.( i + 1, unique.length );
			continue;
		}

		const result = await extractCountryAsync( location, requestOptions );
		if ( result.status === 'failed' ) {
			if ( cachePath && writeCache && persistedCacheChanged ) {
				writePersistedCacheIfChanged( cachePath, persistedCache );
			}
			throw createBatchFailure( result );
		}

		results.set( location, result );
		geocodeCache.set( location, result );

		if (
			cachePath &&
			writeCache &&
			cacheKey &&
			updatePersistedCache( persistedCache, cacheKey, result )
		) {
			persistedCacheChanged = true;
		}

		onProgress?.( i + 1, unique.length );

		// Only sleep after a real Nominatim request.
		if ( i < unique.length - 1 ) {
			await sleep( delayMs );
		}
	}

	if ( cachePath && writeCache && persistedCacheChanged ) {
		writePersistedCacheIfChanged( cachePath, persistedCache );
	}

	return results;
}

/**
 * Seed the in-memory cache for tests and batch callers.
 */
export function setCachedResult( location: string, result: GeocodingResult ): void {
	geocodeCache.set( location, result );
}

export function clearGeocodeCache(): void {
	geocodeCache.clear();
}
