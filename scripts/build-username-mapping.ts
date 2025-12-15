/**
 * Build a GitHub → WP.org username mapping from the WordPress Credits API.
 *
 * This script fetches WP.org profiles and extracts linked GitHub usernames
 * to create a reusable mapping file. Only username pairs are stored (no personal data).
 *
 * Usage: npx tsx scripts/build-username-mapping.ts [--wp-version 7.0] [--delay 500]
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { writeJsonIfChanged } from './utils/file-utils.js';
import { fetchWPOrgProfile } from './utils/wporg-api.js';

const CREDITS_API_BASE = 'https://api.wordpress.org/core/credits/1.1';

function delay( ms: number ): Promise< void > {
	return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
}

interface BuildArgs {
	wpVersion: string;
	delay: number;
	output: string;
}

function getArgs(): BuildArgs {
	const { values } = parseArgs( {
		options: {
			'wp-version': { type: 'string', short: 'w', default: '7.0' },
			delay: { type: 'string', short: 'd', default: '500' },
			output: {
				type: 'string',
				short: 'o',
				default: 'public/data/username-mapping.json',
			},
		},
	} );

	return {
		wpVersion: values[ 'wp-version' ] as string,
		delay: parseInt( values.delay as string, 10 ),
		output: values.output as string,
	};
}

interface CreditsResponse {
	groups: Record< string, {
		name: string;
		type: string;
		data: Record< string, [ string, string, string, string ] >;
	} >;
}

/**
 * Fetch all usernames from the Credits API for a given WP version.
 */
async function fetchCreditsUsernames( wpVersion: string ): Promise< string[] > {
	const url = `${ CREDITS_API_BASE }/?version=${ wpVersion }`;
	const response = await fetch( url );

	if ( ! response.ok ) {
		throw new Error( `Failed to fetch credits: ${ response.status }` );
	}

	const data = await response.json() as CreditsResponse;
	const usernames = new Set< string >();

	for ( const group of Object.values( data.groups ) ) {
		for ( const username of Object.keys( group.data ) ) {
			usernames.add( username );
		}
	}

	return [ ...usernames ].sort();
}

/**
 * Username mapping structure.
 */
interface UsernameMapping {
	// GitHub username (lowercase) → WP.org username
	githubToWporg: Record< string, string >;
	// Metadata
	meta: {
		wpVersion: string;
		totalScanned: number;
		withLinkedGithub: number;
		differentUsernames: number;
		builtAt: string;
	};
}

async function main(): Promise< void > {
	const args = getArgs();

	console.log( `\n🔍 Building GitHub → WP.org username mapping` );
	console.log( `   WordPress version: ${ args.wpVersion }` );

	// Fetch all usernames from Credits API
	console.log( '\n📥 Fetching Credits API usernames...' );
	const wporgUsernames = await fetchCreditsUsernames( args.wpVersion );
	console.log( `   Found ${ wporgUsernames.length } usernames` );

	const estimatedMinutes = Math.ceil( wporgUsernames.length * args.delay / 1000 / 60 );
	console.log( `\n⏱️  Estimated time: ~${ estimatedMinutes } minute(s)` );
	console.log( `   Rate limit: ${ args.delay }ms between requests\n` );

	const githubToWporg: Record< string, string > = {};
	let withLinkedGithub = 0;
	let differentUsernames = 0;

	for ( let i = 0; i < wporgUsernames.length; i++ ) {
		const wporgUsername = wporgUsernames[ i ];
		const profile = await fetchWPOrgProfile( wporgUsername );

		if ( profile.wpProfileExists && profile.wporgLinkedGitHubUsername ) {
			const githubUsername = profile.wporgLinkedGitHubUsername;
			const githubLower = githubUsername.toLowerCase();
			const wporgLower = wporgUsername.toLowerCase();

			withLinkedGithub++;

			// Only store mappings where usernames are different
			// (skip identical ones to reduce file size - they don't need mapping)
			if ( githubLower !== wporgLower ) {
				githubToWporg[ githubLower ] = wporgUsername;
				differentUsernames++;
			}
		}

		const pct = ( ( ( i + 1 ) / wporgUsernames.length ) * 100 ).toFixed( 0 );
		const elapsed = Math.floor( ( i + 1 ) * args.delay / 1000 / 60 );
		process.stdout.write(
			`\r   Progress: ${ i + 1 }/${ wporgUsernames.length } (${ pct }%) - ${ withLinkedGithub } with GitHub - ~${ elapsed }m elapsed`
		);

		if ( i < wporgUsernames.length - 1 ) {
			await delay( args.delay );
		}
	}

	console.log( '\n' );

	// Build output
	const mapping: UsernameMapping = {
		githubToWporg,
		meta: {
			wpVersion: args.wpVersion,
			totalScanned: wporgUsernames.length,
			withLinkedGithub,
			differentUsernames,
			builtAt: new Date().toISOString(),
		},
	};

	// Write output
	const outputDir = dirname( args.output );
	if ( ! existsSync( outputDir ) ) {
		mkdirSync( outputDir, { recursive: true } );
	}

	const written = writeJsonIfChanged( args.output, mapping );

	console.log( '📊 Results' );
	console.log( '==========' );
	console.log( `Total WP.org profiles scanned: ${ wporgUsernames.length }` );
	console.log( `With linked GitHub account:    ${ withLinkedGithub } (${ ( withLinkedGithub / wporgUsernames.length * 100 ).toFixed( 1 ) }%)` );
	console.log( `Different usernames (stored):  ${ differentUsernames }` );
	console.log( `Identical (not stored):        ${ withLinkedGithub - differentUsernames }` );
	console.log( written ? `\n✅ Wrote ${ args.output }` : `\n✅ No changes to ${ args.output }` );
}

main().catch( ( error ) => {
	console.error( 'Error:', error );
	process.exit( 1 );
} );
