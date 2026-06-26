import { describe, expect, it } from 'vitest';
import {
	validateContributorAggregates,
	validateGeneratedData,
	validateSummaryMetadata,
} from '../../../scripts/validate-data.js';
import type { NormalizedRelease, SourceSummary } from '../../../src/data/normalized.js';
import type { ProjectConfig } from '../../../src/config/types.js';

function createRelease( overrides: Partial< NormalizedRelease > = {} ): NormalizedRelease {
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

function createSummary( overrides: Partial< SourceSummary > = {} ): SourceSummary {
	return {
		currentPeriod: '7.0',
		lastCutoffVersion: '23.0',
		releasesSinceCutoff: 2,
		avgPRsSinceCutoff: 10,
		avgContributorsSinceCutoff: 3,
		avgNewContributorsSinceCutoff: 1,
		totalPRsSinceCutoff: 20,
		uniqueContributorsSinceCutoff: 3,
		uniqueNewContributorsSinceCutoff: 1,
		avgPRsTotal: 10,
		avgContributorsTotal: 3,
		avgNewContributorsTotal: 1,
		latestRelease: '7.0',
		oldestRelease: '6.9',
		totalReleases: 2,
		lastUpdated: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

function createConfig( overrides: Partial< ProjectConfig > = {} ): ProjectConfig {
	return {
		version: '1.0.0',
		project: {
			name: 'Test',
			description: 'Test project',
			projectUrl: 'https://example.test',
			projectLabel: 'Test',
			disclaimer: '',
			learnMoreUrl: 'https://example.test/docs',
		},
		tabs: [
			{
				id: 'by-wp-version',
				title: 'By WP Version',
				dataEndpoint: 'wp-cycles.json',
				isAggregated: true,
				versionPrefix: 'WordPress',
				supportedViewModes: [ 'averages' ],
				tableCardClass: null,
				urlParamKey: 'wp',
				defaultItemSummaryField: 'currentPeriod',
				showReferenceLines: false,
				labels: {
					averagesToggle: null,
					statsHeader: null,
					childItem: null,
					versionColumn: null,
					childVersionColumn: null,
					parentVersionColumn: null,
					parentVersionPrefix: null,
					itemContext: null,
					specialMarkerTooltip: null,
					chartSecondaryLabel: null,
				},
			},
			{
				id: 'by-gb-release',
				title: 'By GB Release',
				dataEndpoint: 'gb-releases.json',
				isAggregated: false,
				versionPrefix: 'Gutenberg',
				supportedViewModes: [ 'averages' ],
				tableCardClass: null,
				urlParamKey: 'gb',
				defaultItemSummaryField: null,
				showReferenceLines: false,
				labels: {
					averagesToggle: null,
					statsHeader: null,
					childItem: null,
					versionColumn: null,
					childVersionColumn: null,
					parentVersionColumn: null,
					parentVersionPrefix: null,
					itemContext: null,
					specialMarkerTooltip: null,
					chartSecondaryLabel: null,
				},
			},
			{
				id: 'scf-releases',
				title: 'SCF Releases',
				dataEndpoint: 'scf/scf-by-major.json',
				summaryEndpoint: 'scf/scf-summary.json',
				isAggregated: true,
				versionPrefix: 'SCF',
				supportedViewModes: [ 'averages' ],
				tableCardClass: null,
				urlParamKey: 'scf',
				defaultItemSummaryField: null,
				showReferenceLines: false,
				labels: {
					averagesToggle: null,
					statsHeader: null,
					childItem: null,
					versionColumn: null,
					childVersionColumn: null,
					parentVersionColumn: null,
					parentVersionPrefix: null,
					itemContext: null,
					specialMarkerTooltip: null,
					chartSecondaryLabel: null,
				},
			},
		],
		dataSources: {
			summary: 'summary.json',
		},
		defaults: {
			tab: 'by-wp-version',
			viewMode: 'averages',
			chartType: 'stacked',
			metric: 'prs',
			releaseCount: 50,
		},
		...overrides,
	};
}

describe( 'validateContributorAggregates', () => {
	it( 'accepts releases where the breakdowns match the contributor count', () => {
		const issues = validateContributorAggregates(
			[
				createRelease( {
					contributorAggregates: {
						sponsorBreakdown: { Automattic: 2, Google: 1 },
						countryBreakdown: { 'United States': 2, Spain: 1 },
					},
				} ),
			],
			'public/data/wp-cycles.json'
		);

		expect( issues ).toEqual( [] );
	} );

	it( 'reports breakdowns that no longer match the contributor count', () => {
		const issues = validateContributorAggregates(
			[
				createRelease( {
					contributorAggregates: {
						sponsorBreakdown: { Automattic: 2, Google: 2 },
						countryBreakdown: { 'United States': 1 },
					},
				} ),
			],
			'public/data/wp-cycles.json'
		);

		expect( issues ).toMatchObject( [
			{
				file: 'public/data/wp-cycles.json',
				version: '7.0',
				field: 'sponsorBreakdown',
				expected: 3,
				actual: 4,
			},
			{
				file: 'public/data/wp-cycles.json',
				version: '7.0',
				field: 'countryBreakdown',
				expected: 3,
				actual: 1,
			},
		] );
	} );
} );

describe( 'validateSummaryMetadata', () => {
	it( 'checks summary metadata against the data source it describes', () => {
		const data = [
			createRelease( { version: '6.9', id: '6.9' } ),
			createRelease( { version: '6.8', id: '6.8' } ),
		];
		const issues = validateSummaryMetadata(
			createSummary( { latestRelease: '6.9', oldestRelease: '6.7' } ),
			data,
			'public/data/scf/scf-by-major.json',
			'public/data/scf/scf-summary.json'
		);

		expect( issues ).toMatchObject( [
			{
				file: 'public/data/scf/scf-summary.json',
				field: 'oldestRelease',
				expected: '6.8',
				actual: '6.7',
			},
		] );
	} );
} );

describe( 'validateGeneratedData', () => {
	it( 'validates configured endpoints and explicit tab summaries', () => {
		const files = new Map< string, unknown >();
		files.set( 'public/config/project.json', createConfig() );
		files.set( 'public/data/gb-releases.json', [
			createRelease( { version: '23.4', id: '23.4' } ),
			createRelease( { version: '23.3', id: '23.3' } ),
		] );
		files.set( 'public/data/wp-cycles.json', [ createRelease() ] );
		files.set( 'public/data/scf/scf-releases.json', [
			createRelease( { version: '6.9.0', id: '6.9.0', isAggregated: false } ),
		] );
		files.set( 'public/data/scf/scf-by-major.json', [
			createRelease( { version: '6.9', id: '6.9' } ),
		] );
		files.set(
			'public/data/summary.json',
			createSummary( {
				latestRelease: '23.4',
				oldestRelease: '23.3',
				totalReleases: 2,
			} )
		);
		files.set(
			'public/data/scf/scf-summary.json',
			createSummary( {
				latestRelease: '6.9',
				oldestRelease: '6.9',
				totalReleases: 1,
			} )
		);

		const issues = validateGeneratedData( {
			fileExists: ( path ) => files.has( path ),
			readJson: < T >( path: string ) => files.get( path ) as T,
		} );

		expect( issues ).toEqual( [] );
	} );

	it( 'fails when a configured data endpoint is missing', () => {
		const config = createConfig( {
			tabs: [
				{
					...createConfig().tabs[ 1 ],
					dataEndpoint: 'missing.json',
				},
			],
		} );
		const files = new Map< string, unknown >();
		files.set( 'public/config/project.json', config );
		files.set(
			'public/data/summary.json',
			createSummary( {
				latestRelease: '',
				oldestRelease: '',
				totalReleases: 0,
			} )
		);

		const issues = validateGeneratedData( {
			generatedDataFiles: [],
			fileExists: ( path ) => files.has( path ),
			readJson: < T >( path: string ) => files.get( path ) as T,
		} );

		expect( issues ).toMatchObject( [
			{
				file: 'public/data/missing.json',
				field: 'dataEndpoint',
				expected: 'file to exist',
				actual: 'missing',
			},
		] );
	} );

	it( 'fails when an explicit summary endpoint does not match its tab data', () => {
		const files = new Map< string, unknown >();
		files.set( 'public/config/project.json', createConfig() );
		files.set( 'public/data/gb-releases.json', [
			createRelease( { version: '23.4', id: '23.4' } ),
		] );
		files.set( 'public/data/wp-cycles.json', [ createRelease() ] );
		files.set( 'public/data/scf/scf-releases.json', [
			createRelease( { version: '6.9.0', id: '6.9.0', isAggregated: false } ),
		] );
		files.set( 'public/data/scf/scf-by-major.json', [
			createRelease( { version: '6.9', id: '6.9' } ),
		] );
		files.set(
			'public/data/summary.json',
			createSummary( {
				latestRelease: '23.4',
				oldestRelease: '23.4',
				totalReleases: 1,
			} )
		);
		files.set(
			'public/data/scf/scf-summary.json',
			createSummary( {
				latestRelease: '6.8',
				oldestRelease: '6.8',
				totalReleases: 1,
			} )
		);

		const issues = validateGeneratedData( {
			fileExists: ( path ) => files.has( path ),
			readJson: < T >( path: string ) => files.get( path ) as T,
		} );

		expect( issues ).toMatchObject( [
			{
				file: 'public/data/scf/scf-summary.json',
				field: 'latestRelease',
				expected: '6.9',
				actual: '6.8',
			},
			{
				file: 'public/data/scf/scf-summary.json',
				field: 'oldestRelease',
				expected: '6.9',
				actual: '6.8',
			},
		] );
	} );
} );
