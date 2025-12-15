/**
 * Location → Country geocoding using OpenStreetMap Nominatim API.
 *
 * Rate limit: 1 request/second (per OSM usage policy)
 * https://nominatim.org/release-docs/develop/api/Search/
 */

export interface GeocodingResult {
	country: string | null;
	confidence: 'high' | 'medium' | 'low';
	method: 'api' | 'none';
}

/**
 * Extract country from a location string using geocode.maps.co API.
 */
export async function extractCountryAsync( location: string ): Promise< GeocodingResult > {
	if ( ! location || typeof location !== 'string' || ! location.trim() ) {
		return { country: null, confidence: 'low', method: 'none' };
	}

	const cleaned = location
		.replace( /\s*\([^)]*\)\s*/g, '' ) // Remove "(Remote)" etc.
		.replace( /[""]/g, '' )
		.trim();

	if ( ! cleaned ) {
		return { country: null, confidence: 'low', method: 'none' };
	}

	try {
		const url = new URL( 'https://nominatim.openstreetmap.org/search' );
		url.searchParams.set( 'q', cleaned );
		url.searchParams.set( 'format', 'json' );
		url.searchParams.set( 'addressdetails', '1' );
		url.searchParams.set( 'limit', '1' );

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

	// Return placeholder - actual geocoding happens in batch
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

		// Check cache
		if ( geocodeCache.has( location ) ) {
			results.set( location, geocodeCache.get( location )! );
		} else {
			const result = await extractCountryAsync( location );
			results.set( location, result );
			geocodeCache.set( location, result );
		}

		onProgress?.( i + 1, unique.length );

		// Rate limit (except for last item)
		if ( i < unique.length - 1 ) {
			await new Promise( resolve => setTimeout( resolve, delayMs ) );
		}
	}

	return results;
}

/**
 * Pre-populate cache for batch processing.
 */
export function setCachedResult( location: string, result: GeocodingResult ): void {
	geocodeCache.set( location, result );
}
