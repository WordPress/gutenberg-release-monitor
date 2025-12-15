/**
 * Compute per-release contributor aggregates without storing individual data.
 *
 * This script fetches WP.org profiles on-the-fly, computes aggregates, and
 * stores them directly in releases.json. No individual contributor data is persisted.
 *
 * This is the privacy-first approach: only aggregate counts are stored,
 * e.g. "15 Automattic, 3 Google" not "alice@automattic, bob@google".
 *
 * Usage: npx tsx scripts/compute-release-aggregates.ts [--wp-version 7.0] [--delay 500]
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { writeJsonIfChanged } from './utils/file-utils.js';
import { fetchWPOrgProfile } from './utils/wporg-api.js';
import { fetchGitHubUserProfile } from './utils/github-api.js';
import { extractCountry, batchGeocodeLocations } from './utils/geocoding.js';
import { SponsorNormalizer } from './utils/sponsor-normalization.js';
import type { Release, ReleaseContributorAggregates } from '../src/data/types.js';

/**
 * Username mapping structure (from build-username-mapping.ts).
 */
interface UsernameMapping {
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
interface ContributorData {
	sponsor: string | null;
	location: string | null;
}

/**
 * Delay helper for rate limiting.
 */
function delay( ms: number ): Promise< void > {
	return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
}

interface ComputeArgs {
	wpVersion?: string;
	delay: number;
	force: boolean;
	dryRun: boolean;
	verbose: boolean;
}

function getArgs(): ComputeArgs {
	const { values } = parseArgs( {
		options: {
			'wp-version': { type: 'string', short: 'w' },
			delay: { type: 'string', short: 'd', default: '500' },
			force: { type: 'boolean', short: 'f', default: false },
			'dry-run': { type: 'boolean', default: false },
			verbose: { type: 'boolean', short: 'v', default: false },
		},
	} );

	return {
		wpVersion: values[ 'wp-version' ] as string | undefined,
		delay: parseInt( values.delay as string, 10 ),
		force: values.force as boolean,
		dryRun: values[ 'dry-run' ] as boolean,
		verbose: values.verbose as boolean,
	};
}

/**
 * Load the username mapping file if it exists.
 */
function loadUsernameMapping(): UsernameMapping | null {
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
function resolveWporgUsername(
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
async function fetchContributorData(
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
 * Compute aggregates for a single release.
 */
function computeAggregates(
	contributorDataMap: Map< string, ContributorData >,
	release: Release,
	sponsorNormalizer: SponsorNormalizer
): ReleaseContributorAggregates {
	const stats = {
		total: release.contributorsList.length,
		newContributors: release.newContributorsList.length,
	};

	const sponsorBreakdown: Record< string, number > = {};
	const countryBreakdown: Record< string, number > = {};

	for ( const username of release.contributorsList ) {
		const data = contributorDataMap.get( username.toLowerCase() );

		// Sponsor: normalize and deduplicate variations
		const sponsor = sponsorNormalizer.normalize( data?.sponsor || null );
		sponsorBreakdown[ sponsor ] = ( sponsorBreakdown[ sponsor ] || 0 ) + 1;

		// Country: resolved or "Unknown"
		let country = 'Unknown';
		if ( data?.location ) {
			const geo = extractCountry( data.location );
			if ( geo.country ) {
				country = geo.country;
			}
		}
		countryBreakdown[ country ] = ( countryBreakdown[ country ] || 0 ) + 1;
	}

	// Sort breakdowns by value (descending), but keep "Unknown" at end
	const sortByValue = ( obj: Record< string, number > ): Record< string, number > => {
		const entries = Object.entries( obj );
		const unknown = entries.find( ( [ k ] ) => k === 'Unknown' );
		const others = entries
			.filter( ( [ k ] ) => k !== 'Unknown' )
			.sort( ( a, b ) => b[ 1 ] - a[ 1 ] );
		return Object.fromEntries( unknown ? [ ...others, unknown ] : others );
	};

	return {
		stats,
		sponsorBreakdown: sortByValue( sponsorBreakdown ),
		countryBreakdown: sortByValue( countryBreakdown ),
		aggregatedAt: new Date().toISOString(),
	};
}

async function main(): Promise< void > {
	const args = getArgs();

	// Load releases data
	const releasesPath = 'public/data/releases.json';
	if ( ! existsSync( releasesPath ) ) {
		console.error( `\n❌ Releases file not found: ${ releasesPath }` );
		process.exit( 1 );
	}

	const releases: Release[] = JSON.parse( readFileSync( releasesPath, 'utf-8' ) );

	// Load username mapping
	const mapping = loadUsernameMapping();
	if ( mapping ) {
		console.log( `\n📂 Loaded username mapping (${ Object.keys( mapping.githubToWporg ).length } entries)` );
	}

	// Filter releases
	let targetReleases = releases;
	if ( args.wpVersion ) {
		targetReleases = releases.filter( r => r.wpVersion === args.wpVersion );
		console.log( `\n🔍 Filtering to WP ${ args.wpVersion }: ${ targetReleases.length } releases` );
	}

	// Find releases needing aggregation
	const needsAggregation = args.force
		? targetReleases
		: targetReleases.filter( r => ! r.contributorAggregates );

	if ( needsAggregation.length === 0 ) {
		console.log( '\n✅ All target releases already have aggregates!' );
		console.log( '   Use --force to recompute' );
		return;
	}

	console.log( `\n📊 Computing Aggregates for ${ needsAggregation.length } Releases` );
	console.log( '================================================' );

	// Collect all unique contributors
	const allContributors = new Set< string >();
	for ( const release of needsAggregation ) {
		for ( const username of release.contributorsList ) {
			allContributors.add( username.toLowerCase() );
		}
	}

	console.log( `Unique contributors to fetch: ${ allContributors.size }` );
	console.log( `Rate limit: ${ args.delay }ms between requests` );

	const estimatedMinutes = Math.ceil( allContributors.size * args.delay / 1000 / 60 );
	console.log( `Estimated time: ~${ estimatedMinutes } minute(s)\n` );

	// Fetch all contributor data (in-memory only)
	console.log( '📥 Fetching contributor profiles...' );
	const contributorDataMap = new Map< string, ContributorData >();
	const usernames = [ ...allContributors ];

	for ( let i = 0; i < usernames.length; i++ ) {
		const username = usernames[ i ];
		const data = await fetchContributorData(
			username,
			mapping,
			args.delay,
			args.verbose
		);
		contributorDataMap.set( username, data );

		const pct = ( ( ( i + 1 ) / usernames.length ) * 100 ).toFixed( 0 );
		process.stdout.write( `\r   Progress: ${ i + 1 }/${ usernames.length } (${ pct }%)` );

		if ( i < usernames.length - 1 ) {
			await delay( args.delay );
		}
	}

	console.log( '\n' );

	// Batch geocode all locations
	const allLocations = [ ...contributorDataMap.values() ]
		.map( d => d.location )
		.filter( ( loc ): loc is string => Boolean( loc ) );

	if ( allLocations.length > 0 ) {
		console.log( `🌍 Geocoding ${ allLocations.length } locations...` );
		await batchGeocodeLocations( allLocations, {
			delayMs: 1100, // Nominatim rate limit (1 req/sec)
			onProgress: ( done, total ) => {
				const pct = ( ( done / total ) * 100 ).toFixed( 0 );
				process.stdout.write( `\r   Progress: ${ done }/${ total } (${ pct }%)` );
			},
		} );
		console.log( '\n' );
	}

	// Compute aggregates for each release
	console.log( '🔄 Computing release aggregates...' );
	const sponsorNormalizer = new SponsorNormalizer();
	let processed = 0;

	for ( const release of releases ) {
		// Skip if not in our target set
		if ( ! needsAggregation.includes( release ) ) {
			continue;
		}

		release.contributorAggregates = computeAggregates( contributorDataMap, release, sponsorNormalizer );
		processed++;

		const pct = ( ( processed / needsAggregation.length ) * 100 ).toFixed( 0 );
		process.stdout.write( `\r   Processed: ${ processed }/${ needsAggregation.length } (${ pct }%)` );
	}

	console.log( '\n' );

	// Print summary
	const sample = needsAggregation[ needsAggregation.length - 1 ];
	if ( sample?.contributorAggregates ) {
		console.log( `📋 Sample: GB ${ sample.gbVersion } (WP ${ sample.wpVersion })` );
		console.log( `   Contributors: ${ sample.contributorAggregates.stats.total }` );
		console.log( `   New contributors: ${ sample.contributorAggregates.stats.newContributors }` );

		const topSponsors = Object.entries( sample.contributorAggregates.sponsorBreakdown )
			.filter( ( [ k ] ) => k !== 'Unknown' )
			.slice( 0, 5 );
		if ( topSponsors.length > 0 ) {
			console.log( `   Top sponsors: ${ topSponsors.map( ( [ s, c ] ) => `${ s } (${ c })` ).join( ', ' ) }` );
		}
	}

	// Write output
	if ( args.dryRun ) {
		console.log( '\n🔍 Dry run - no changes written' );
	} else {
		const written = writeJsonIfChanged( releasesPath, releases );
		console.log( written ? `\n✅ Updated ${ releasesPath }` : `\n✅ No changes to ${ releasesPath }` );
	}

	// Summary
	console.log( '\n📊 Summary' );
	console.log( '==========' );
	console.log( `Contributors fetched (in-memory only): ${ contributorDataMap.size }` );
	console.log( `Releases aggregated: ${ processed }` );
	console.log( `Unique sponsors (after normalization): ${ sponsorNormalizer.getStats().uniqueSponsors }` );
	console.log( `Individual data persisted: 0 (privacy-first)` );
}

main().catch( error => {
	console.error( '\nError:', error );
	process.exit( 1 );
} );
