/**
 * Check generated public data for mistakes we do not want to publish.
 *
 * Usage:
 *   npm run validate:data
 */

import { readFileSync } from 'node:fs';
import type { NormalizedRelease } from '../src/data/normalized.js';

const WP_CYCLES_PATH = 'public/data/wp-cycles.json';

export interface DataValidationIssue {
	version: string;
	field: 'sponsorBreakdown' | 'countryBreakdown';
	expected: number;
	actual: number;
}

function sumValues( values: Record< string, number > | undefined ): number {
	return Object.values( values || {} ).reduce( ( total, value ) => total + value, 0 );
}

export function validateWPCycleContributorAggregates(
	cycles: NormalizedRelease[]
): DataValidationIssue[] {
	const issues: DataValidationIssue[] = [];

	for ( const cycle of cycles ) {
		const aggregates = cycle.contributorAggregates;
		if ( ! aggregates ) {
			continue;
		}

		const expected = cycle.contributors;
		const sponsorTotal = sumValues( aggregates.sponsorBreakdown );
		const countryTotal = sumValues( aggregates.countryBreakdown );

		if ( sponsorTotal !== expected ) {
			issues.push( {
				version: cycle.version,
				field: 'sponsorBreakdown',
				expected,
				actual: sponsorTotal,
			} );
		}

		if ( countryTotal !== expected ) {
			issues.push( {
				version: cycle.version,
				field: 'countryBreakdown',
				expected,
				actual: countryTotal,
			} );
		}
	}

	return issues;
}

function main(): void {
	const cycles = JSON.parse( readFileSync( WP_CYCLES_PATH, 'utf-8' ) ) as NormalizedRelease[];
	const issues = validateWPCycleContributorAggregates( cycles );

	if ( issues.length === 0 ) {
		console.log( `✅ Data looks good (${ WP_CYCLES_PATH })` );
		return;
	}

	console.error( `❌ Data check failed (${ WP_CYCLES_PATH })` );
	for ( const issue of issues ) {
		console.error(
			`   WP ${ issue.version } ${ issue.field } sums to ${ issue.actual }, expected ${ issue.expected }`
		);
	}
	process.exitCode = 1;
}

if ( import.meta.url === `file://${ process.argv[ 1 ] }` ) {
	main();
}
