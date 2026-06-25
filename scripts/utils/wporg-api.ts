/**
 * WordPress.org profile scraping utilities.
 * Extracts contributor data from profiles.wordpress.org HTML pages.
 * @module scripts/utils/wporg-api
 */

import type { ContributorProfile } from './types.js';

const WPORG_PROFILE_BASE = 'https://profiles.wordpress.org';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
const DEFAULT_BACKOFF_FACTOR = 2;

export interface FetchWPOrgProfileOptions {
	maxAttempts?: number;
	initialRetryDelayMs?: number;
	backoffFactor?: number;
}

/**
 * Delay helper for rate limiting.
 */
function delay( ms: number ): Promise< void > {
	return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
}

function createMissingProfile( username: string ): ContributorProfile {
	return {
		username,
		wpProfileExists: false,
		employer: null,
		location: null,
		memberSince: null,
		badges: [],
		wporgLinkedGitHubUsername: null,
		githubCompany: null,
		githubLocation: null,
		employerSource: null,
		fetchedAt: new Date().toISOString(),
	};
}

function shouldRetryStatus( status: number ): boolean {
	return status === 429 || status >= 500;
}

function parseRetryAfterMs( response: Response ): number | null {
	const retryAfter = response.headers.get( 'retry-after' );
	if ( ! retryAfter ) {
		return null;
	}

	const seconds = Number.parseFloat( retryAfter );
	if ( Number.isFinite( seconds ) ) {
		return Math.max( 0, seconds * 1000 );
	}

	const retryDate = Date.parse( retryAfter );
	if ( Number.isNaN( retryDate ) ) {
		return null;
	}

	return Math.max( 0, retryDate - Date.now() );
}

function getRetryDelayMs(
	attemptIndex: number,
	response: Response | null,
	options: Required< FetchWPOrgProfileOptions >
): number {
	if ( response ) {
		const retryAfterMs = parseRetryAfterMs( response );
		if ( retryAfterMs !== null ) {
			return retryAfterMs;
		}
	}

	return options.initialRetryDelayMs * options.backoffFactor ** attemptIndex;
}

/**
 * Extract text content from an HTML element by ID pattern.
 * Looks for: <li id="{id}">...<strong>{value}</strong></li>
 */
function extractFieldById( html: string, id: string ): string | null {
	const regex = new RegExp(
		`<li\\s+id="${ id }"[^>]*>[\\s\\S]*?<strong>([\\s\\S]*?)</strong>`,
		'i'
	);
	const match = html.match( regex );
	if ( ! match ) return null;

	// Clean up: remove HTML tags, decode entities, trim
	return cleanText( match[ 1 ] );
}

/**
 * Extract GitHub username from the user-github field.
 * Structure: <li id="user-github">...<a href="https://github.com/USERNAME">...</a></li>
 */
function extractGitHubUsername( html: string ): string | null {
	const regex = /<li\s+id="user-github"[^>]*>[\s\S]*?<a\s+href="https:\/\/github\.com\/([^/"]+)"/i;
	const match = html.match( regex );
	if ( ! match ) return null;
	return match[ 1 ].trim() || null;
}

/**
 * Extract badges from the user-badges list.
 * Structure: <ul id="user-badges">...<li>...<div class="badge..."></div>\nBadge Name</li>...</ul>
 */
function extractBadges( html: string ): string[] {
	const badgesSection = html.match(
		/<ul\s+id="user-badges"[^>]*>([\s\S]*?)<\/ul>/i
	);
	if ( ! badgesSection ) return [];

	const badges: string[] = [];
	const badgeRegex = /<li[^>]*>[\s\S]*?<\/div>\s*([^<]+)/gi;
	let match;

	while ( ( match = badgeRegex.exec( badgesSection[ 1 ] ) ) !== null ) {
		const badge = match[ 1 ].trim();
		if ( badge ) {
			badges.push( badge );
		}
	}

	return badges;
}

/**
 * Clean HTML text: decode entities, strip tags, normalize whitespace.
 */
function cleanText( text: string ): string {
	return text
		.replace( /<[^>]*>/g, '' ) // Strip HTML tags
		.replace( /&#8217;/g, "'" ) // Decode common entities
		.replace( /&#8220;/g, '"' )
		.replace( /&#8221;/g, '"' )
		.replace( /&amp;/g, '&' )
		.replace( /&lt;/g, '<' )
		.replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' )
		.replace( /\s+/g, ' ' ) // Normalize whitespace
		.trim();
}

/**
 * Parse member since date string to ISO format.
 * Input: "October 18th, 2016"
 * Output: "2016-10-18"
 */
function parseMemberSinceDate( dateStr: string ): string | null {
	if ( ! dateStr ) return null;

	const months: Record< string, string > = {
		january: '01',
		february: '02',
		march: '03',
		april: '04',
		may: '05',
		june: '06',
		july: '07',
		august: '08',
		september: '09',
		october: '10',
		november: '11',
		december: '12',
	};

	const match = dateStr
		.toLowerCase()
		.match( /(\w+)\s+(\d+)(?:st|nd|rd|th)?,?\s+(\d{4})/ );
	if ( ! match ) return null;

	const month = months[ match[ 1 ] ];
	const day = match[ 2 ].padStart( 2, '0' );
	const year = match[ 3 ];

	if ( ! month ) return null;

	return `${ year }-${ month }-${ day }`;
}

/**
 * Fetch and parse a single WordPress.org profile.
 */
export async function fetchWPOrgProfile(
	username: string,
	options?: FetchWPOrgProfileOptions
): Promise< ContributorProfile | null > {
	const url = `${ WPORG_PROFILE_BASE }/${ username }`;
	const retryOptions: Required< FetchWPOrgProfileOptions > = {
		maxAttempts: Math.max( 1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS ),
		initialRetryDelayMs: Math.max(
			0,
			options?.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS
		),
		backoffFactor: Math.max(
			1,
			options?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR
		),
	};

	for ( let attempt = 0; attempt < retryOptions.maxAttempts; attempt++ ) {
		try {
			const response = await fetch( url );

			if ( response.status === 404 ) {
				return createMissingProfile( username );
			}

			if ( ! response.ok ) {
				if (
					shouldRetryStatus( response.status ) &&
					attempt < retryOptions.maxAttempts - 1
				) {
					await delay( getRetryDelayMs( attempt, response, retryOptions ) );
					continue;
				}

				console.warn(
					`Could not fetch WP.org profile for ${ username }; leaving it out: ${ response.status } ${ response.statusText }`
				);
				return null;
			}

			const html = await response.text();

			// Treat a 200 response without the profile marker as a missing profile.
			if ( ! html.includes( 'id="user-member-since"' ) ) {
				return createMissingProfile( username );
			}

			const memberSinceRaw = extractFieldById( html, 'user-member-since' );
			const employer = extractFieldById( html, 'user-company' );
			const linkedGitHub = extractGitHubUsername( html );

			return {
				username,
				wpProfileExists: true,
				employer,
				location: extractFieldById( html, 'user-location' ),
				memberSince: parseMemberSinceDate( memberSinceRaw || '' ),
				badges: extractBadges( html ),
				wporgLinkedGitHubUsername: linkedGitHub,
				githubCompany: null,
				githubLocation: null,
				employerSource: employer ? 'wporg' : null,
				fetchedAt: new Date().toISOString(),
			};
		} catch ( error ) {
			if ( attempt < retryOptions.maxAttempts - 1 ) {
				await delay( getRetryDelayMs( attempt, null, retryOptions ) );
				continue;
			}

			console.warn(
				`Could not fetch WP.org profile for ${ username }; leaving it out:`,
				error
			);
			return null;
		}
	}

	return null;
}

/**
 * Fetch multiple WordPress.org profiles with rate limiting.
 */
export async function fetchContributorProfiles(
	usernames: string[],
	options?: {
		delayMs?: number;
		onProgress?: ( done: number, total: number ) => void;
	}
): Promise< ContributorProfile[] > {
	const delayMs = options?.delayMs ?? 500;
	const profiles: ContributorProfile[] = [];

	for ( let i = 0; i < usernames.length; i++ ) {
		const username = usernames[ i ];
		const profile = await fetchWPOrgProfile( username );
		if ( profile ) {
			profiles.push( profile );
		}

		if ( options?.onProgress ) {
			options.onProgress( i + 1, usernames.length );
		}

		// Rate limit: wait between requests (except for the last one)
		if ( i < usernames.length - 1 ) {
			await delay( delayMs );
		}
	}

	return profiles;
}
