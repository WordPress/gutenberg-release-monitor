/**
 * Shared contributor data fetching utilities.
 *
 * Extracted from compute-release-aggregates.ts for reuse in WP-level aggregation.
 * Privacy-first: fetches profiles on-the-fly, no individual data persisted.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fetchWPOrgProfile } from './wporg-api.js';
import { fetchGitHubUserProfile } from './github-api.js';

/**
 * Username mapping structure (from build-username-mapping.ts).
 */
export interface UsernameMapping {
	githubToWporg: Record< string, string >;
	meta: {
		wpVersion: string;
		totalScanned: number;
		withLinkedGithub: number;
		differentUsernames: number;
		builtAt: string;
	};
}

/**
 * In-memory contributor profile (not persisted).
 */
export interface ContributorData {
	sponsor: string | null;
	location: string | null;
}

/**
 * Delay helper for rate limiting.
 */
export function delay( ms: number ): Promise< void > {
	return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
}

/**
 * Load the username mapping file if it exists.
 */
export function loadUsernameMapping(): UsernameMapping | null {
	const mappingPath = 'public/data/username-mapping.json';
	if ( ! existsSync( mappingPath ) ) {
		return null;
	}

	try {
		return JSON.parse( readFileSync( mappingPath, 'utf-8' ) );
	} catch {
		console.warn( '⚠️  Failed to parse username mapping file' );
		return null;
	}
}

/**
 * Resolve GitHub username to WP.org username using the mapping.
 */
export function resolveWporgUsername(
	githubUsername: string,
	mapping: UsernameMapping | null
): string {
	const githubLower = githubUsername.toLowerCase();

	// Check if we have a mapping for this GitHub username
	if ( mapping && mapping.githubToWporg[ githubLower ] ) {
		return mapping.githubToWporg[ githubLower ];
	}

	// No mapping found - assume GitHub username = WP.org username
	return githubUsername;
}

/**
 * Fetch contributor data for a single username.
 * Returns in-memory data structure (not persisted).
 */
export async function fetchContributorData(
	githubUsername: string,
	mapping: UsernameMapping | null,
	delayMs: number,
	verbose: boolean
): Promise< ContributorData > {
	const wporgUsername = resolveWporgUsername( githubUsername, mapping );

	// Fetch WP.org profile
	const wpProfile = await fetchWPOrgProfile( wporgUsername );

	let sponsor = wpProfile.employer || null;
	let location = wpProfile.location || null;

	// If no sponsor from WP.org, try GitHub
	if ( ! sponsor ) {
		const ghUsername = wpProfile.wporgLinkedGitHubUsername || githubUsername;
		try {
			const ghProfile = await fetchGitHubUserProfile( ghUsername );
			if ( ghProfile?.company ) {
				sponsor = ghProfile.company.replace( /^@/, '' ).trim() || null;
			}
			if ( ! location && ghProfile?.location ) {
				location = ghProfile.location;
			}
		} catch ( error ) {
			if ( verbose ) {
				console.error( `\n   Warning: GitHub fetch failed for ${ ghUsername }` );
			}
		}
		await delay( delayMs );
	}

	return { sponsor, location };
}

/**
 * Fetch contributor data for multiple usernames with progress tracking.
 * Returns a Map of username -> ContributorData.
 */
export async function fetchContributorProfiles(
	usernames: string[],
	mapping: UsernameMapping | null,
	options: {
		delayMs: number;
		verbose: boolean;
		existingData?: Map< string, ContributorData >;
		onProgress?: ( done: number, total: number ) => void;
	}
): Promise< Map< string, ContributorData > > {
	const { delayMs, verbose, existingData, onProgress } = options;
	const contributorDataMap = new Map< string, ContributorData >(
		existingData || []
	);

	// Filter to usernames we don't already have
	const toFetch = usernames.filter(
		( u ) => ! contributorDataMap.has( u.toLowerCase() )
	);

	for ( let i = 0; i < toFetch.length; i++ ) {
		const username = toFetch[ i ];
		const data = await fetchContributorData(
			username,
			mapping,
			delayMs,
			verbose
		);
		contributorDataMap.set( username.toLowerCase(), data );

		if ( onProgress ) {
			onProgress( i + 1, toFetch.length );
		}

		if ( i < toFetch.length - 1 ) {
			await delay( delayMs );
		}
	}

	return contributorDataMap;
}
