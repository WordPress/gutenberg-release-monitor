/**
 * Compute per-release and per-WP-version contributor aggregates without storing individual data.
 *
 * This script fetches WP.org profiles on-the-fly, computes aggregates, and
 * stores them directly in releases.json and by-wp-version.json.
 * No individual contributor data is persisted.
 *
 * This is the privacy-first approach: only aggregate counts are stored,
 * e.g. "15 Automattic, 3 Google" not "alice@automattic, bob@google".
 *
 * Usage:
 *   npx tsx scripts/compute-release-aggregates.ts [--gb-version 21.0] [--from-gb 20.0] [--to-gb 21.9] [--delay 500]
 *   npx tsx scripts/compute-release-aggregates.ts --wp-version 7.0  # Computes GB + WP aggregates for all releases in WP 7.0
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { writeJsonIfChanged } from './utils/file-utils.js';
import { extractCountry, batchGeocodeLocations } from './utils/geocoding.js';
import { SponsorNormalizer } from './utils/sponsor-normalization.js';
import {
	loadUsernameMapping,
	fetchContributorProfiles,
	type ContributorData,
} from './utils/contributor-data.js';
import type {
	Release,
	ReleaseContributorAggregates,
	WPVersionStats,
	WPVersionContributorAggregates,
	WPRelease,
} from '../src/data/types.js';

interface ComputeArgs {
	wpVersion?: string[];
	gbVersion?: string;
	fromGb?: string;
	toGb?: string;
	delay: number;
	force: boolean;
	dryRun: boolean;
	verbose: boolean;
}

function getArgs(): ComputeArgs {
	const { values } = parseArgs( {
		options: {
			'wp-version': { type: 'string', short: 'w' },
			'gb-version': { type: 'string', short: 'g' },
			'from-gb': { type: 'string' },
			'to-gb': { type: 'string' },
			delay: { type: 'string', short: 'd', default: '500' },
			force: { type: 'boolean', short: 'f', default: false },
			'dry-run': { type: 'boolean', default: false },
			verbose: { type: 'boolean', short: 'v', default: false },
		},
	} );

	// Parse --wp-version as comma-separated list (e.g., "6.9,7.0")
	const wpVersionArg = values[ 'wp-version' ] as string | undefined;
	const wpVersions = wpVersionArg
		? wpVersionArg.split( ',' ).map( ( v ) => v.trim() )
		: undefined;

	return {
		wpVersion: wpVersions,
		gbVersion: values[ 'gb-version' ] as string | undefined,
		fromGb: values[ 'from-gb' ] as string | undefined,
		toGb: values[ 'to-gb' ] as string | undefined,
		delay: parseInt( values.delay as string, 10 ),
		force: values.force as boolean,
		dryRun: values[ 'dry-run' ] as boolean,
		verbose: values.verbose as boolean,
	};
}

/**
 * Compare GB version strings (e.g., "20.0" vs "21.5").
 */
function compareGbVersions( a: string, b: string ): number {
	const [ aMajor, aMinor ] = a.split( '.' ).map( Number );
	const [ bMajor, bMinor ] = b.split( '.' ).map( Number );
	if ( aMajor !== bMajor ) return aMajor - bMajor;
	return ( aMinor || 0 ) - ( bMinor || 0 );
}

/**
 * Load WP schedule to get GB version ranges for WP versions.
 */
function loadWPSchedule(): WPRelease[] {
	const schedulePath = 'public/data/wp-schedule.json';
	if ( ! existsSync( schedulePath ) ) {
		console.warn( '⚠️  WP schedule file not found' );
		return [];
	}

	try {
		return JSON.parse( readFileSync( schedulePath, 'utf-8' ) );
	} catch {
		console.warn( '⚠️  Failed to parse WP schedule file' );
		return [];
	}
}

/**
 * Get GB version range for a WP version from the schedule.
 */
function getGBRangeForWPVersion(
	wpVersion: string,
	schedule: WPRelease[]
): { fromGb: string; toGb: string } | null {
	const entry = schedule.find( ( s ) => s.wpVersion === wpVersion );
	if ( ! entry?.gbVersionRange ) {
		return null;
	}

	const [ fromGb, toGb ] = entry.gbVersionRange.split( '-' );
	return { fromGb, toGb };
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

	return {
		stats,
		sponsorBreakdown: sortByValue( sponsorBreakdown ),
		countryBreakdown: sortByValue( countryBreakdown ),
		aggregatedAt: new Date().toISOString(),
	};
}

/**
 * Sort breakdown by value (descending), but keep "Unknown" at end.
 */
function sortByValue( obj: Record< string, number > ): Record< string, number > {
	const entries = Object.entries( obj );
	const unknown = entries.find( ( [ k ] ) => k === 'Unknown' );
	const others = entries
		.filter( ( [ k ] ) => k !== 'Unknown' )
		.sort( ( a, b ) => b[ 1 ] - a[ 1 ] );
	return Object.fromEntries( unknown ? [ ...others, unknown ] : others );
}

/**
 * Compute aggregates for a WP version from unique contributors across all its GB releases.
 */
function computeWPVersionAggregates(
	_wpVersion: string,
	wpReleases: Release[],
	contributorDataMap: Map< string, ContributorData >,
	sponsorNormalizer: SponsorNormalizer
): WPVersionContributorAggregates {
	// Collect unique contributors and new contributors across all releases
	const uniqueContributors = new Set< string >();
	const uniqueNewContributors = new Set< string >();

	for ( const release of wpReleases ) {
		for ( const username of release.contributorsList ) {
			uniqueContributors.add( username.toLowerCase() );
		}
		for ( const username of release.newContributorsList ) {
			uniqueNewContributors.add( username.toLowerCase() );
		}
	}

	const stats = {
		total: uniqueContributors.size,
		newContributors: uniqueNewContributors.size,
	};

	// Compute breakdown from unique contributors (not per-appearance)
	const sponsorBreakdown: Record< string, number > = {};
	const countryBreakdown: Record< string, number > = {};

	for ( const username of uniqueContributors ) {
		const data = contributorDataMap.get( username );

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

	// Load WP schedule for --wp-version mode
	const wpSchedule = loadWPSchedule();

	// Determine target releases and WP versions to aggregate
	let targetReleases: Release[] = [];
	const targetWPVersions: string[] = [];

	if ( args.wpVersion && args.wpVersion.length > 0 ) {
		// Enhanced --wp-version mode: find all GB releases in the WP version range
		console.log( `\n🔍 WP Version Mode: ${ args.wpVersion.join( ', ' ) }` );

		for ( const wpVer of args.wpVersion ) {
			const range = getGBRangeForWPVersion( wpVer, wpSchedule );
			if ( ! range ) {
				console.warn( `   ⚠️  No GB range found for WP ${ wpVer }` );
				continue;
			}

			console.log( `   WP ${ wpVer } → GB ${ range.fromGb } - ${ range.toGb }` );
			targetWPVersions.push( wpVer );

			// Add all releases in this GB range
			const wpReleases = releases.filter( ( r ) => {
				return (
					compareGbVersions( r.gbVersion, range.fromGb ) >= 0 &&
					compareGbVersions( r.gbVersion, range.toGb ) <= 0
				);
			} );
			targetReleases.push( ...wpReleases );
		}

		// Deduplicate (in case of overlapping ranges)
		targetReleases = [ ...new Set( targetReleases ) ];
		console.log( `   Total releases: ${ targetReleases.length }` );
	} else if ( args.gbVersion ) {
		// Single GB version
		targetReleases = releases.filter( ( r ) => r.gbVersion === args.gbVersion );
		console.log( `\n🔍 Filtering to GB ${ args.gbVersion }: ${ targetReleases.length } releases` );
	} else if ( args.fromGb || args.toGb ) {
		// GB version range
		targetReleases = releases.filter( ( r ) => {
			if ( args.fromGb && compareGbVersions( r.gbVersion, args.fromGb ) < 0 ) {
				return false;
			}
			if ( args.toGb && compareGbVersions( r.gbVersion, args.toGb ) > 0 ) {
				return false;
			}
			return true;
		} );
		const rangeStr =
			args.fromGb && args.toGb
				? `GB ${ args.fromGb } - ${ args.toGb }`
				: args.fromGb
					? `GB ${ args.fromGb }+`
					: `GB up to ${ args.toGb }`;
		console.log( `\n🔍 Filtering to ${ rangeStr }: ${ targetReleases.length } releases` );
	} else {
		// Default: all releases
		targetReleases = releases;
	}

	// Find releases needing GB-level aggregation
	const needsGBAggregation = args.force
		? targetReleases
		: targetReleases.filter( ( r ) => ! r.contributorAggregates );

	// Collect ALL unique contributors needed:
	// - From releases needing GB aggregation
	// - From ALL releases in target WP versions (for WP-level aggregates)
	const allContributors = new Set< string >();

	// Contributors from releases needing GB aggregation
	for ( const release of needsGBAggregation ) {
		for ( const username of release.contributorsList ) {
			allContributors.add( username.toLowerCase() );
		}
	}

	// Contributors from ALL releases in target WP versions (for WP-level unique counts)
	if ( targetWPVersions.length > 0 ) {
		for ( const release of targetReleases ) {
			for ( const username of release.contributorsList ) {
				allContributors.add( username.toLowerCase() );
			}
		}
	}

	if ( allContributors.size === 0 ) {
		console.log( '\n✅ No contributors to fetch!' );
		if ( needsGBAggregation.length === 0 ) {
			console.log( '   All target releases already have aggregates. Use --force to recompute.' );
		}
		return;
	}

	console.log( `\n📊 Computing Aggregates` );
	console.log( '=======================' );
	console.log( `GB releases to aggregate: ${ needsGBAggregation.length }` );
	console.log( `WP versions to aggregate: ${ targetWPVersions.length > 0 ? targetWPVersions.join( ', ' ) : 'none' }` );
	console.log( `Unique contributors to fetch: ${ allContributors.size }` );
	console.log( `Rate limit: ${ args.delay }ms between requests` );

	const estimatedMinutes = Math.ceil( ( allContributors.size * args.delay ) / 1000 / 60 );
	console.log( `Estimated time: ~${ estimatedMinutes } minute(s)\n` );

	// Fetch all contributor data (in-memory only)
	console.log( '📥 Fetching contributor profiles...' );
	const contributorDataMap = await fetchContributorProfiles(
		[ ...allContributors ],
		mapping,
		{
			delayMs: args.delay,
			verbose: args.verbose,
			onProgress: ( done, total ) => {
				const pct = ( ( done / total ) * 100 ).toFixed( 0 );
				process.stdout.write( `\r   Progress: ${ done }/${ total } (${ pct }%)` );
			},
		}
	);

	console.log( '\n' );

	// Batch geocode all locations
	const allLocations = [ ...contributorDataMap.values() ]
		.map( ( d ) => d.location )
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

	// Compute GB-level aggregates for each release
	const sponsorNormalizer = new SponsorNormalizer();
	let gbProcessed = 0;

	if ( needsGBAggregation.length > 0 ) {
		console.log( '🔄 Computing GB release aggregates...' );

		for ( const release of releases ) {
			// Skip if not in our target set
			if ( ! needsGBAggregation.includes( release ) ) {
				continue;
			}

			release.contributorAggregates = computeAggregates(
				contributorDataMap,
				release,
				sponsorNormalizer
			);
			gbProcessed++;

			const pct = ( ( gbProcessed / needsGBAggregation.length ) * 100 ).toFixed( 0 );
			process.stdout.write( `\r   Processed: ${ gbProcessed }/${ needsGBAggregation.length } (${ pct }%)` );
		}

		console.log( '\n' );
	}

	// Compute WP-level aggregates
	let wpVersionStats: WPVersionStats[] = [];
	if ( targetWPVersions.length > 0 ) {
		console.log( '🔄 Computing WP version aggregates...' );

		// Load existing WP version stats
		const wpStatsPath = 'public/data/aggregated/by-wp-version.json';
		if ( existsSync( wpStatsPath ) ) {
			wpVersionStats = JSON.parse( readFileSync( wpStatsPath, 'utf-8' ) );
		}

		for ( const wpVersion of targetWPVersions ) {
			// Get releases for this WP version
			const wpReleases = targetReleases.filter( ( r ) => r.wpVersion === wpVersion );

			if ( wpReleases.length === 0 ) {
				console.log( `   ⚠️  No releases found for WP ${ wpVersion }` );
				continue;
			}

			// Compute WP-level aggregates
			const wpAggregates = computeWPVersionAggregates(
				wpVersion,
				wpReleases,
				contributorDataMap,
				sponsorNormalizer
			);

			// Update or add to wpVersionStats
			const existingIndex = wpVersionStats.findIndex( ( s ) => s.wpVersion === wpVersion );
			if ( existingIndex >= 0 ) {
				wpVersionStats[ existingIndex ].contributorAggregates = wpAggregates;
			} else {
				console.warn( `   ⚠️  WP ${ wpVersion } not found in by-wp-version.json` );
			}

			console.log(
				`   WP ${ wpVersion }: ${ wpAggregates.stats.total } unique contributors, ` +
					`${ wpAggregates.stats.newContributors } new`
			);
		}

		console.log( '' );
	}

	// Print sample
	const sample = needsGBAggregation[ needsGBAggregation.length - 1 ];
	if ( sample?.contributorAggregates ) {
		console.log( `📋 Sample GB: ${ sample.gbVersion } (WP ${ sample.wpVersion })` );
		console.log( `   Contributors: ${ sample.contributorAggregates.stats.total }` );
		console.log( `   New contributors: ${ sample.contributorAggregates.stats.newContributors }` );

		const topSponsors = Object.entries( sample.contributorAggregates.sponsorBreakdown )
			.filter( ( [ k ] ) => k !== 'Unknown' )
			.slice( 0, 5 );
		if ( topSponsors.length > 0 ) {
			console.log(
				`   Top sponsors: ${ topSponsors.map( ( [ s, c ] ) => `${ s } (${ c })` ).join( ', ' ) }`
			);
		}
	}

	// Write output
	if ( args.dryRun ) {
		console.log( '\n🔍 Dry run - no changes written' );
	} else {
		// Write releases.json
		if ( gbProcessed > 0 ) {
			const written = writeJsonIfChanged( releasesPath, releases );
			console.log( written ? `\n✅ Updated ${ releasesPath }` : `\n✅ No changes to ${ releasesPath }` );
		}

		// Write by-wp-version.json
		if ( targetWPVersions.length > 0 && wpVersionStats.length > 0 ) {
			const wpStatsPath = 'public/data/aggregated/by-wp-version.json';
			const written = writeJsonIfChanged( wpStatsPath, wpVersionStats );
			console.log( written ? `✅ Updated ${ wpStatsPath }` : `✅ No changes to ${ wpStatsPath }` );
		}
	}

	// Summary
	console.log( '\n📊 Summary' );
	console.log( '==========' );
	console.log( `Contributors fetched (in-memory only): ${ contributorDataMap.size }` );
	console.log( `GB releases aggregated: ${ gbProcessed }` );
	console.log( `WP versions aggregated: ${ targetWPVersions.length }` );
	console.log( `Unique sponsors (after normalization): ${ sponsorNormalizer.getStats().uniqueSponsors }` );
	console.log( `Individual data persisted: 0 (privacy-first)` );
}

main().catch( error => {
	console.error( '\nError:', error );
	process.exit( 1 );
} );
