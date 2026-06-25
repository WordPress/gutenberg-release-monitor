/**
 * Computes contributor sponsor/country statistics for releases.
 *
 * Fetches WP.org profiles on-the-fly, computes aggregates, and stores them
 * in gb-releases.json and wp-cycles.json. Only aggregate counts are stored
 * (privacy-first): e.g. "15 Automattic, 3 Google" not individual usernames.
 *
 * Usage:
 *   npm run data-sync:contributor-stats -- --gb-version 21.0           # Single GB release
 *   npm run data-sync:contributor-stats -- --from-gb 20.0 --to-gb 21.9 # GB range
 *   npm run data-sync:contributor-stats -- --wp-version 7.0            # All releases in WP 7.0
 *
 * @module scripts/compute-contributor-stats
 */

import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { writeJsonIfChanged } from './utils/file-utils.js';
import { batchGeocodeLocations } from './utils/geocoding.js';
import { SponsorNormalizer } from './utils/sponsor-normalization.js';
import {
	loadUsernameMapping,
	fetchContributorProfiles,
} from './utils/contributor-data.js';
import {
	loadReleases,
	loadWPSchedule,
	toNormalizedRelease,
	compareVersions,
} from './utils/release-utils.js';
import {
	collectContributorUsernames,
	computeReleaseContributorAggregates,
	computeWPVersionContributorAggregates,
	getAffectedWPVersions,
	getGBRangeForWPVersion,
	getReleasesForWPVersion,
} from './utils/contributor-aggregates.js';
import type { Release } from './types.js';
import type { NormalizedRelease } from '../src/data/normalized.js';

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

async function main(): Promise< void > {
	const args = getArgs();

	// Load releases data
	const releasesPath = 'public/data/gb-releases.json';
	if ( ! existsSync( releasesPath ) ) {
		console.error( `\n❌ Releases file not found: ${ releasesPath }` );
		process.exit( 1 );
	}

	const releases: Release[] = loadReleases( releasesPath );

	// Load username mapping
	const mapping = loadUsernameMapping();
	if ( mapping ) {
		console.log( `\n📂 Loaded username mapping (${ Object.keys( mapping.githubToWporg ).length } entries)` );
	}

	// Load WP schedule for --wp-version mode
	const wpSchedule = loadWPSchedule();

	// Determine target releases and user-requested WP versions.
	let targetReleases: Release[] = [];
	const explicitWPVersions: string[] = [];

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
			explicitWPVersions.push( wpVer );

			// Add all releases in this GB range
			targetReleases.push(
				...getReleasesForWPVersion( wpVer, releases, wpSchedule )
			);
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
			if ( args.fromGb && compareVersions( r.gbVersion, args.fromGb ) < 0 ) {
				return false;
			}
			if ( args.toGb && compareVersions( r.gbVersion, args.toGb ) > 0 ) {
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

	const targetWPVersions = new Set< string >( explicitWPVersions );
	for ( const wpVersion of getAffectedWPVersions( needsGBAggregation, wpSchedule ) ) {
		targetWPVersions.add( wpVersion );
	}

	const wpReleasesByVersion = new Map< string, Release[] >();
	for ( const wpVersion of targetWPVersions ) {
		const wpReleases = getReleasesForWPVersion( wpVersion, releases, wpSchedule );
		if ( wpReleases.length === 0 ) {
			console.log( `   ⚠️  No releases found for WP ${ wpVersion }` );
			continue;
		}
		wpReleasesByVersion.set( wpVersion, wpReleases );
	}

	// Collect the profile data this run needs:
	// - contributors in GB releases being aggregated
	// - contributors from every release in each affected WP cycle
	const allContributors = new Set< string >();
	for ( const username of collectContributorUsernames( needsGBAggregation ) ) {
		allContributors.add( username );
	}
	for ( const wpReleases of wpReleasesByVersion.values() ) {
		for ( const username of collectContributorUsernames( wpReleases ) ) {
			allContributors.add( username );
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
	console.log(
		`WP versions to aggregate: ${
			wpReleasesByVersion.size > 0 ? [ ...wpReleasesByVersion.keys() ].join( ', ' ) : 'none'
		}`
	);
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

			release.contributorAggregates = computeReleaseContributorAggregates(
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
	let wpVersionData: NormalizedRelease[] = [];
	const wpStatsPath = 'public/data/wp-cycles.json';
	if ( wpReleasesByVersion.size > 0 ) {
		console.log( '🔄 Computing WP version aggregates...' );

		// Load existing WP version data (normalized format)
		if ( existsSync( wpStatsPath ) ) {
			wpVersionData = JSON.parse( readFileSync( wpStatsPath, 'utf-8' ) );
		}

		for ( const [ wpVersion, wpReleases ] of wpReleasesByVersion ) {
			// Compute WP-level aggregates
			const wpAggregates = computeWPVersionContributorAggregates(
				wpReleases,
				contributorDataMap,
				sponsorNormalizer
			);

			// Update the NormalizedRelease entry with contributor aggregates
			const existingIndex = wpVersionData.findIndex( ( s ) => s.version === wpVersion );
			if ( existingIndex >= 0 ) {
				wpVersionData[ existingIndex ].contributorAggregates = {
					sponsorBreakdown: wpAggregates.sponsorBreakdown,
					countryBreakdown: wpAggregates.countryBreakdown,
				};
			} else {
				console.warn( `   ⚠️  WP ${ wpVersion } not found in wp-cycles.json` );
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
		// Write gb-releases.json in normalized format
		if ( gbProcessed > 0 ) {
			const normalizedReleases = releases.map( ( r ) => toNormalizedRelease( r, 'gb-releases.json' ) );
			const written = writeJsonIfChanged( releasesPath, normalizedReleases );
			console.log( written ? `\n✅ Updated ${ releasesPath }` : `\n✅ No changes to ${ releasesPath }` );
		}

		// Write wp-cycles.json (already in normalized format)
		if ( wpReleasesByVersion.size > 0 && wpVersionData.length > 0 ) {
			const written = writeJsonIfChanged( wpStatsPath, wpVersionData );
			console.log( written ? `✅ Updated ${ wpStatsPath }` : `✅ No changes to ${ wpStatsPath }` );
		}
	}

	// Summary
	console.log( '\n📊 Summary' );
	console.log( '==========' );
	console.log( `Contributors fetched (in-memory only): ${ contributorDataMap.size }` );
	console.log( `GB releases aggregated: ${ gbProcessed }` );
	console.log( `WP versions aggregated: ${ wpReleasesByVersion.size }` );
	console.log( `Unique sponsors (after normalization): ${ sponsorNormalizer.getStats().uniqueSponsors }` );
	console.log( `Individual data persisted: 0 (privacy-first)` );
}

main().catch( error => {
	console.error( '\nError:', error );
	process.exit( 1 );
} );
