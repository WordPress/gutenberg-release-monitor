/**
 * Location → Country geocoding using OpenStreetMap Nominatim API.
 *
 * Rate limit: 1 request/second (per OSM usage policy)
 * https://nominatim.org/release-docs/develop/api/Search/
 */

export interface GeocodingResult {
	country: string | null;
	confidence: 'high' | 'medium' | 'low';
	method: 'api' | 'local' | 'none';
}

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
		return { country: null, confidence: 'low', method: 'none' };
	}

	const normalizedLocation = normalizeLocationToken( cleaned );
	if ( GENERIC_LOCATIONS.has( normalizedLocation ) ) {
		return { country: null, confidence: 'low', method: 'none' };
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
			return { country, confidence: 'high', method: 'local' };
		}
	}

	for ( const token of tokens ) {
		const country = LOCATION_ALIASES[ token ];
		if ( country ) {
			return { country, confidence: 'medium', method: 'local' };
		}
	}

	return null;
}

/**
 * Resolve a location to a country, using local aliases before Nominatim.
 */
export async function extractCountryAsync( location: string ): Promise< GeocodingResult > {
	if ( ! location || typeof location !== 'string' || ! location.trim() ) {
		return { country: null, confidence: 'low', method: 'none' };
	}

	const localResult = resolveCountryLocally( location );
	if ( localResult ) {
		return localResult;
	}

	const cleaned = cleanLocation( location );

	if ( ! cleaned ) {
		return { country: null, confidence: 'low', method: 'none' };
	}

	try {
		const url = new URL( 'https://nominatim.openstreetmap.org/search' );
		url.searchParams.set( 'q', cleaned );
		url.searchParams.set( 'format', 'json' );
		url.searchParams.set( 'addressdetails', '1' );
		url.searchParams.set( 'limit', '1' );
		url.searchParams.set( 'accept-language', 'en' );

		const response = await fetch( url.toString(), {
			headers: {
				// Required by Nominatim usage policy
				'User-Agent': 'GutenbergReleaseMonitor/1.0 (https://github.com/WordPress/gutenberg)',
			},
		} );

		if ( ! response.ok ) {
			return { country: null, confidence: 'low', method: 'none' };
		}

		const data = await response.json() as Array< {
			address?: { country?: string };
		} >;

		if ( data.length > 0 && data[ 0 ].address?.country ) {
			return {
				country: data[ 0 ].address.country,
				confidence: 'high',
				method: 'api',
			};
		}
	} catch {
		// Network errors, rate limits, etc.
	}

	return { country: null, confidence: 'low', method: 'none' };
}

/**
 * Synchronous wrapper that returns cached result or null.
 * For use in compute-release-aggregates.ts which handles async elsewhere.
 */
const geocodeCache = new Map< string, GeocodingResult >();

export function extractCountry( location: string ): GeocodingResult {
	// Check cache first
	const cached = geocodeCache.get( location );
	if ( cached ) {
		return cached;
	}

	const localResult = resolveCountryLocally( location );
	if ( localResult ) {
		return localResult;
	}

	// No cache hit and no safe local match; batch processing can fill this later.
	return { country: null, confidence: 'low', method: 'none' };
}

/**
 * Batch geocode locations with rate limiting.
 */
export async function batchGeocodeLocations(
	locations: string[],
	options: {
		delayMs?: number;
		onProgress?: ( done: number, total: number ) => void;
	} = {}
): Promise< Map< string, GeocodingResult > > {
	const { delayMs = 1100, onProgress } = options;
	const results = new Map< string, GeocodingResult >();
	const unique = [ ...new Set( locations.filter( Boolean ) ) ];

	for ( let i = 0; i < unique.length; i++ ) {
		const location = unique[ i ];

			// Use cached results first.
			if ( geocodeCache.has( location ) ) {
			results.set( location, geocodeCache.get( location )! );
			onProgress?.( i + 1, unique.length );
			continue;
		}

		const localResult = resolveCountryLocally( location );
		const result = localResult ?? await extractCountryAsync( location );
		results.set( location, result );
		geocodeCache.set( location, result );

		onProgress?.( i + 1, unique.length );

		// Only sleep after a real Nominatim request.
		if ( ! localResult && i < unique.length - 1 ) {
			await new Promise( resolve => setTimeout( resolve, delayMs ) );
		}
	}

	return results;
}

/**
 * Seed the cache for batch processing.
 */
export function setCachedResult( location: string, result: GeocodingResult ): void {
	geocodeCache.set( location, result );
}
