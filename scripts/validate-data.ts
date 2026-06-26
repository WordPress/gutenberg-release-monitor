/**
 * Check generated public data for mistakes we do not want to publish.
 *
 * Usage:
 *   npm run data:validate
 *   npm run validate:data
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NormalizedRelease, SourceSummary } from '../src/data/normalized.js';
import type { ProjectConfig, TabConfig } from '../src/config/types.js';

const DATA_ROOT = 'public/data';
const PROJECT_CONFIG_PATH = 'public/config/project.json';
const GENERATED_DATA_FILES = [
	'gb-releases.json',
	'wp-cycles.json',
	'scf/scf-releases.json',
	'scf/scf-by-major.json',
];

type ValidationField =
	| 'sponsorBreakdown'
	| 'countryBreakdown'
	| 'dataEndpoint'
	| 'summaryEndpoint'
	| 'latestRelease'
	| 'oldestRelease'
	| 'totalReleases';

export interface DataValidationIssue {
	file: string;
	field: ValidationField;
	expected: number | string;
	actual: number | string;
	version?: string;
	message: string;
}

interface ValidationOptions {
	configPath?: string;
	dataRoot?: string;
	generatedDataFiles?: string[];
	fileExists?: ( path: string ) => boolean;
	readJson?: < T >( path: string ) => T;
}

interface SummaryCandidate {
	summaryPath: string;
	dataPath: string;
	data: NormalizedRelease[];
	summary: SourceSummary;
}

function defaultReadJson< T >( path: string ): T {
	return JSON.parse( readFileSync( path, 'utf-8' ) ) as T;
}

function sumValues( values: Record< string, number > | undefined ): number {
	return Object.values( values || {} ).reduce( ( total, value ) => total + value, 0 );
}

function dataPathForEndpoint( dataRoot: string, endpoint: string ): string {
	return join( dataRoot, endpoint );
}

function getOldestRelease( data: NormalizedRelease[] ): string {
	return data.length > 0 ? data[ data.length - 1 ].version : '';
}

function createIssue(
	issue: Omit< DataValidationIssue, 'message' >,
	message: string
): DataValidationIssue {
	return {
		...issue,
		message,
	};
}

export function validateContributorAggregates(
	releases: NormalizedRelease[],
	file: string
): DataValidationIssue[] {
	const issues: DataValidationIssue[] = [];

	for ( const release of releases ) {
		const aggregates = release.contributorAggregates;
		if ( ! aggregates ) {
			continue;
		}

		const expected = release.contributors;
		const sponsorTotal = sumValues( aggregates.sponsorBreakdown );
		const countryTotal = sumValues( aggregates.countryBreakdown );

		if ( sponsorTotal !== expected ) {
			issues.push(
				createIssue(
					{
						file,
						version: release.version,
						field: 'sponsorBreakdown',
						expected,
						actual: sponsorTotal,
					},
					`${ file } ${ release.version } sponsorBreakdown sums to ${ sponsorTotal }, expected ${ expected }`
				)
			);
		}

		if ( countryTotal !== expected ) {
			issues.push(
				createIssue(
					{
						file,
						version: release.version,
						field: 'countryBreakdown',
						expected,
						actual: countryTotal,
					},
					`${ file } ${ release.version } countryBreakdown sums to ${ countryTotal }, expected ${ expected }`
				)
			);
		}
	}

	return issues;
}

export function validateWPCycleContributorAggregates(
	cycles: NormalizedRelease[]
): DataValidationIssue[] {
	return validateContributorAggregates( cycles, dataPathForEndpoint( DATA_ROOT, 'wp-cycles.json' ) );
}

export function validateSummaryMetadata(
	summary: SourceSummary,
	data: NormalizedRelease[],
	dataFile: string,
	summaryFile: string
): DataValidationIssue[] {
	const expected = {
		latestRelease: data[ 0 ]?.version ?? '',
		oldestRelease: getOldestRelease( data ),
		totalReleases: data.length,
	};
	const issues: DataValidationIssue[] = [];

	for ( const field of [ 'latestRelease', 'oldestRelease', 'totalReleases' ] as const ) {
		if ( summary[ field ] === expected[ field ] ) {
			continue;
		}

		issues.push(
			createIssue(
				{
					file: summaryFile,
					field,
					expected: expected[ field ],
					actual: summary[ field ],
				},
				`${ summaryFile } ${ field } is ${ summary[ field ] }, expected ${ expected[ field ] } from ${ dataFile }`
			)
		);
	}

	return issues;
}

function validateEndpointExists(
	path: string,
	field: 'dataEndpoint' | 'summaryEndpoint',
	fileExists: ( path: string ) => boolean
): DataValidationIssue[] {
	if ( fileExists( path ) ) {
		return [];
	}

	return [
		createIssue(
			{
				file: path,
				field,
				expected: 'file to exist',
				actual: 'missing',
			},
			`${ path } is configured but does not exist`
		),
	];
}

function getGlobalSummaryCandidates(
	config: ProjectConfig,
	summaryPath: string,
	summary: SourceSummary,
	dataByEndpoint: Map< string, NormalizedRelease[] >,
	dataRoot: string
): SummaryCandidate[] {
	const candidates = config.tabs
		.filter( ( tab ) => ! tab.summaryEndpoint )
		.filter( ( tab ) => ! tab.isAggregated )
		.map( ( tab ) => {
			const data = dataByEndpoint.get( tab.dataEndpoint );
			if ( ! data ) {
				return null;
			}
			return {
				summaryPath,
				summary,
				dataPath: dataPathForEndpoint( dataRoot, tab.dataEndpoint ),
				data,
			};
		} )
		.filter( ( candidate ): candidate is SummaryCandidate => Boolean( candidate ) );

	if ( candidates.length > 0 ) {
		return candidates;
	}

	return config.tabs
		.filter( ( tab ) => ! tab.summaryEndpoint )
		.map( ( tab ) => {
			const data = dataByEndpoint.get( tab.dataEndpoint );
			if ( ! data ) {
				return null;
			}
			return {
				summaryPath,
				summary,
				dataPath: dataPathForEndpoint( dataRoot, tab.dataEndpoint ),
				data,
			};
		} )
		.filter( ( candidate ): candidate is SummaryCandidate => Boolean( candidate ) );
}

function summaryMatchesAnyCandidate( candidates: SummaryCandidate[] ): boolean {
	return candidates.some(
		( candidate ) =>
			validateSummaryMetadata(
				candidate.summary,
				candidate.data,
				candidate.dataPath,
				candidate.summaryPath
			).length === 0
	);
}

function validateExplicitTabSummary(
	tab: TabConfig,
	summaryPath: string,
	dataByEndpoint: Map< string, NormalizedRelease[] >,
	dataRoot: string,
	readJson: < T >( path: string ) => T
): DataValidationIssue[] {
	if ( ! tab.summaryEndpoint ) {
		return [];
	}

	const data = dataByEndpoint.get( tab.dataEndpoint );
	if ( ! data ) {
		return [];
	}

	const summary = readJson< SourceSummary >( summaryPath );
	return validateSummaryMetadata(
		summary,
		data,
		dataPathForEndpoint( dataRoot, tab.dataEndpoint ),
		summaryPath
	);
}

export function validateGeneratedData( options: ValidationOptions = {} ): DataValidationIssue[] {
	const configPath = options.configPath ?? PROJECT_CONFIG_PATH;
	const dataRoot = options.dataRoot ?? DATA_ROOT;
	const generatedDataFiles = options.generatedDataFiles ?? GENERATED_DATA_FILES;
	const fileExists = options.fileExists ?? existsSync;
	const readJson = options.readJson ?? defaultReadJson;
	const issues: DataValidationIssue[] = [];
	const dataByEndpoint = new Map< string, NormalizedRelease[] >();

	const configuredDataEndpoints = new Set< string >(
		readJson< ProjectConfig >( configPath ).tabs.map( ( tab ) => tab.dataEndpoint )
	);
	for ( const endpoint of generatedDataFiles ) {
		configuredDataEndpoints.add( endpoint );
	}

	for ( const endpoint of configuredDataEndpoints ) {
		const path = dataPathForEndpoint( dataRoot, endpoint );
		issues.push( ...validateEndpointExists( path, 'dataEndpoint', fileExists ) );
		if ( ! fileExists( path ) ) {
			continue;
		}
		const data = readJson< NormalizedRelease[] >( path );
		dataByEndpoint.set( endpoint, data );
		issues.push( ...validateContributorAggregates( data, path ) );
	}

	const config = readJson< ProjectConfig >( configPath );
	const summaryEndpoints = new Set< string >( [ config.dataSources.summary ] );
	for ( const tab of config.tabs ) {
		if ( tab.summaryEndpoint ) {
			summaryEndpoints.add( tab.summaryEndpoint );
		}
	}

	for ( const endpoint of summaryEndpoints ) {
		issues.push(
			...validateEndpointExists(
				dataPathForEndpoint( dataRoot, endpoint ),
				'summaryEndpoint',
				fileExists
			)
		);
	}

	for ( const tab of config.tabs ) {
		if ( ! tab.summaryEndpoint ) {
			continue;
		}
		const summaryPath = dataPathForEndpoint( dataRoot, tab.summaryEndpoint );
		if ( fileExists( summaryPath ) ) {
			issues.push(
				...validateExplicitTabSummary( tab, summaryPath, dataByEndpoint, dataRoot, readJson )
			);
		}
	}

	const globalSummaryPath = dataPathForEndpoint( dataRoot, config.dataSources.summary );
	if ( fileExists( globalSummaryPath ) ) {
		const globalSummary = readJson< SourceSummary >( globalSummaryPath );
		const candidates = getGlobalSummaryCandidates(
			config,
			globalSummaryPath,
			globalSummary,
			dataByEndpoint,
			dataRoot
		);

		if ( candidates.length > 0 && ! summaryMatchesAnyCandidate( candidates ) ) {
			const firstCandidate = candidates[ 0 ];
			issues.push(
				...validateSummaryMetadata(
					firstCandidate.summary,
					firstCandidate.data,
					firstCandidate.dataPath,
					firstCandidate.summaryPath
				)
			);
		}
	}

	return issues;
}

function main(): void {
	const issues = validateGeneratedData();

	if ( issues.length === 0 ) {
		console.log( 'Data validation passed.' );
		return;
	}

	console.error( 'Data validation failed.' );
	for ( const issue of issues ) {
		console.error( `- ${ issue.message }` );
	}
	process.exitCode = 1;
}

if ( import.meta.url === `file://${ process.argv[ 1 ] }` ) {
	main();
}
