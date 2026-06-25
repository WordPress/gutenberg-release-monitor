import { describe, expect, it } from 'vitest';
import { validateWPCycleContributorAggregates } from '../../../scripts/validate-data.js';
import type { NormalizedRelease } from '../../../src/data/normalized.js';

function createCycle( overrides: Partial< NormalizedRelease > = {} ): NormalizedRelease {
	return {
		id: '7.0',
		version: '7.0',
		displayLabel: 'WordPress 7.0',
		isAggregated: true,
		totalPRs: 10,
		contributors: 3,
		newContributors: 1,
		hasContributorData: true,
		avgPRs: 5,
		avgContributors: 2,
		avgNewContributors: 1,
		groupedCount: 2,
		groupedRange: '23.1-23.2',
		...overrides,
	};
}

describe( 'validateWPCycleContributorAggregates', () => {
	it( 'accepts cycles where the breakdowns match the contributor count', () => {
		const issues = validateWPCycleContributorAggregates( [
			createCycle( {
				contributorAggregates: {
					sponsorBreakdown: { Automattic: 2, Google: 1 },
					countryBreakdown: { 'United States': 2, Spain: 1 },
				},
			} ),
		] );

		expect( issues ).toEqual( [] );
	} );

	it( 'reports breakdowns that no longer match the contributor count', () => {
		const issues = validateWPCycleContributorAggregates( [
			createCycle( {
				contributorAggregates: {
					sponsorBreakdown: { Automattic: 2, Google: 2 },
					countryBreakdown: { 'United States': 1 },
				},
			} ),
		] );

		expect( issues ).toEqual( [
			{
				version: '7.0',
				field: 'sponsorBreakdown',
				expected: 3,
				actual: 4,
			},
			{
				version: '7.0',
				field: 'countryBreakdown',
				expected: 3,
				actual: 1,
			},
		] );
	} );
} );
