/**
 * Pure contributor aggregate helpers shared by data pipeline scripts.
 * Profile data is passed in-memory; individual contributor data is never written.
 */

import { extractCountry } from './geocoding.js';
import { SponsorNormalizer } from './sponsor-normalization.js';
import type { ContributorData } from './contributor-data.js';
import type { Release, ReleaseContributorAggregates, WPRelease } from '../types.js';
import { compareVersions, getMinorVersion } from './release-utils.js';

export function getGBRangeForWPVersion(
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

export function getWPVersionForRelease(
	release: Release,
	schedule: WPRelease[]
): string | null {
	if ( release.wpVersion ) {
		return release.wpVersion;
	}

	const minorVersion = getMinorVersion( release.gbVersion );
	const matchingWP = schedule.find( ( wpRelease ) => {
		const [ fromGb, toGb ] = wpRelease.gbVersionRange.split( '-' );
		return (
			compareVersions( minorVersion, fromGb ) >= 0 &&
			compareVersions( minorVersion, toGb ) <= 0
		);
	} );

	return matchingWP?.wpVersion ?? null;
}

export function getAffectedWPVersions(
	releases: Release[],
	schedule: WPRelease[]
): string[] {
	const versions = new Set< string >();

	for ( const release of releases ) {
		const wpVersion = getWPVersionForRelease( release, schedule );
		if ( wpVersion ) {
			versions.add( wpVersion );
		}
	}

	return [ ...versions ];
}

export function getReleasesForWPVersion(
	wpVersion: string,
	releases: Release[],
	schedule: WPRelease[]
): Release[] {
	const range = getGBRangeForWPVersion( wpVersion, schedule );

	if ( range ) {
		return releases.filter( ( release ) => {
			const minorVersion = getMinorVersion( release.gbVersion );
			return (
				compareVersions( minorVersion, range.fromGb ) >= 0 &&
				compareVersions( minorVersion, range.toGb ) <= 0
			);
		} );
	}

	return releases.filter( ( release ) => release.wpVersion === wpVersion );
}

export function collectContributorUsernames( releases: Release[] ): string[] {
	const contributors = new Set< string >();

	for ( const release of releases ) {
		for ( const username of release.contributorsList || [] ) {
			contributors.add( username.toLowerCase() );
		}
	}

	return [ ...contributors ];
}

/**
 * Sort breakdown by value (descending), but keep "Unknown" at end.
 */
export function sortContributorBreakdown(
	obj: Record< string, number >
): Record< string, number > {
	const entries = Object.entries( obj );
	const unknown = entries.find( ( [ k ] ) => k === 'Unknown' );
	const others = entries
		.filter( ( [ k ] ) => k !== 'Unknown' )
		.sort( ( a, b ) => b[ 1 ] - a[ 1 ] );
	return Object.fromEntries( unknown ? [ ...others, unknown ] : others );
}

function getCountry( data: ContributorData | undefined ): string {
	if ( data?.location ) {
		const geo = extractCountry( data.location );
		if ( geo.country ) {
			return geo.country;
		}
	}

	return 'Unknown';
}

export function computeReleaseContributorAggregates(
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

		const sponsor = sponsorNormalizer.normalize( data?.sponsor || null );
		sponsorBreakdown[ sponsor ] = ( sponsorBreakdown[ sponsor ] || 0 ) + 1;

		const country = getCountry( data );
		countryBreakdown[ country ] = ( countryBreakdown[ country ] || 0 ) + 1;
	}

	return {
		stats,
		sponsorBreakdown: sortContributorBreakdown( sponsorBreakdown ),
		countryBreakdown: sortContributorBreakdown( countryBreakdown ),
		aggregatedAt: new Date().toISOString(),
	};
}

export function computeWPVersionContributorAggregates(
	wpReleases: Release[],
	contributorDataMap: Map< string, ContributorData >,
	sponsorNormalizer: SponsorNormalizer
): ReleaseContributorAggregates {
	const uniqueContributors = new Set< string >();
	const uniqueNewContributors = new Set< string >();

	for ( const release of wpReleases ) {
		for ( const username of release.contributorsList || [] ) {
			uniqueContributors.add( username.toLowerCase() );
		}
		for ( const username of release.newContributorsList || [] ) {
			uniqueNewContributors.add( username.toLowerCase() );
		}
	}

	const sponsorBreakdown: Record< string, number > = {};
	const countryBreakdown: Record< string, number > = {};

	for ( const username of uniqueContributors ) {
		const data = contributorDataMap.get( username );

		const sponsor = sponsorNormalizer.normalize( data?.sponsor || null );
		sponsorBreakdown[ sponsor ] = ( sponsorBreakdown[ sponsor ] || 0 ) + 1;

		const country = getCountry( data );
		countryBreakdown[ country ] = ( countryBreakdown[ country ] || 0 ) + 1;
	}

	return {
		stats: {
			total: uniqueContributors.size,
			newContributors: uniqueNewContributors.size,
		},
		sponsorBreakdown: sortContributorBreakdown( sponsorBreakdown ),
		countryBreakdown: sortContributorBreakdown( countryBreakdown ),
		aggregatedAt: new Date().toISOString(),
	};
}
