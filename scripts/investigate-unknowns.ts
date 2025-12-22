/**
 * Investigation script to audit contributor profile data.
 * Outputs a detailed report of all contributors showing what data is available/missing.
 *
 * Usage: npx tsx scripts/investigate-unknowns.ts --wp-version 7.0 > /tmp/contributor-audit.txt
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { fetchWPOrgProfile } from './utils/wporg-api.js';
import { fetchGitHubUserProfile } from './utils/github-api.js';
import { SponsorNormalizer } from './utils/sponsor-normalization.js';
import { extractCountryAsync } from './utils/geocoding.js';
import type { Release, WPRelease } from './types.js';

interface UsernameMapping {
	githubToWporg: Record<string, string>;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadUsernameMapping(): UsernameMapping | null {
	const mappingPath = 'scripts/data/username-mapping.json';
	if (!existsSync(mappingPath)) return null;
	try {
		return JSON.parse(readFileSync(mappingPath, 'utf-8'));
	} catch {
		return null;
	}
}

function loadWPSchedule(): WPRelease[] {
	const schedulePath = 'scripts/data/wp-schedule.json';
	if (!existsSync(schedulePath)) return [];
	try {
		return JSON.parse(readFileSync(schedulePath, 'utf-8'));
	} catch {
		return [];
	}
}

function compareGbVersions(a: string, b: string): number {
	const [aMajor, aMinor] = a.split('.').map(Number);
	const [bMajor, bMinor] = b.split('.').map(Number);
	if (aMajor !== bMajor) return aMajor - bMajor;
	return (aMinor || 0) - (bMinor || 0);
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			'wp-version': { type: 'string', short: 'w', default: '7.0' },
			delay: { type: 'string', short: 'd', default: '300' },
		},
	});

	const wpVersion = values['wp-version'] as string;
	const delayMs = parseInt(values.delay as string, 10);

	console.log(`# Contributor Audit for WP ${wpVersion}`);
	console.log(`# Generated: ${new Date().toISOString()}`);
	console.log('');

	// Load data
	const releases: Release[] = JSON.parse(readFileSync('public/data/releases.json', 'utf-8'));
	const mapping = loadUsernameMapping();
	const wpSchedule = loadWPSchedule();
	const sponsorNormalizer = new SponsorNormalizer();

	// Get GB range for WP version
	const wpEntry = wpSchedule.find((s) => s.wpVersion === wpVersion);
	if (!wpEntry?.gbVersionRange) {
		console.error(`No GB range found for WP ${wpVersion}`);
		process.exit(1);
	}

	const [fromGb, toGb] = wpEntry.gbVersionRange.split('-');
	console.log(`# GB Range: ${fromGb} - ${toGb}`);
	console.log('');

	// Get unique contributors for this WP version
	const wpReleases = releases.filter(
		(r) =>
			compareGbVersions(r.gbVersion, fromGb) >= 0 &&
			compareGbVersions(r.gbVersion, toGb) <= 0
	);

	const uniqueContributors = new Set<string>();
	for (const release of wpReleases) {
		for (const username of release.contributorsList) {
			uniqueContributors.add(username.toLowerCase());
		}
	}

	console.log(`# Total unique contributors: ${uniqueContributors.size}`);
	console.log('');

	// Audit each contributor
	const results: Array<{
		github: string;
		wporg: string | null;
		wporgSponsor: string | null;
		wporgLocation: string | null;
		githubCompany: string | null;
		githubLocation: string | null;
		normalizedSponsor: string;
		resolvedCountry: string | null;
		profileUrls: { wporg: string; github: string };
	}> = [];

	const contributors = [...uniqueContributors].sort();

	console.error(`Fetching ${contributors.length} contributor profiles...`);

	for (let i = 0; i < contributors.length; i++) {
		const githubUsername = contributors[i];
		const wporgUsername = mapping?.githubToWporg[githubUsername] || githubUsername;

		process.stderr.write(`\r  ${i + 1}/${contributors.length}: ${githubUsername}...`);

		// Fetch WP.org profile
		const wpProfile = await fetchWPOrgProfile(wporgUsername);
		await delay(delayMs);

		// Fetch GitHub profile
		let ghProfile: { company: string | null; location: string | null } | null = null;
		try {
			ghProfile = await fetchGitHubUserProfile(githubUsername);
		} catch {
			// GitHub API error - continue
		}
		await delay(delayMs);

		// Determine final values (simulating current logic)
		let finalSponsor = wpProfile.employer || null;
		let finalLocation = wpProfile.location || null;

		// Current buggy logic: only check GitHub if no WP.org sponsor
		if (!finalSponsor && ghProfile) {
			if (ghProfile.company) {
				finalSponsor = ghProfile.company.replace(/^@/, '').trim() || null;
			}
			if (!finalLocation && ghProfile.location) {
				finalLocation = ghProfile.location;
			}
		}

		// Normalize sponsor
		const normalizedSponsor = sponsorNormalizer.normalize(finalSponsor);

		// Geocode location
		let resolvedCountry: string | null = null;
		if (finalLocation) {
			const geo = await extractCountryAsync(finalLocation);
			resolvedCountry = geo.country;
			await delay(1100); // Nominatim rate limit
		}

		results.push({
			github: githubUsername,
			wporg: wporgUsername !== githubUsername ? wporgUsername : null,
			wporgSponsor: wpProfile.employer || null,
			wporgLocation: wpProfile.location || null,
			githubCompany: ghProfile?.company || null,
			githubLocation: ghProfile?.location || null,
			normalizedSponsor,
			resolvedCountry,
			profileUrls: {
				wporg: `https://profiles.wordpress.org/${wporgUsername}`,
				github: `https://github.com/${githubUsername}`,
			},
		});
	}

	console.error('\n');

	// Output report
	const unknownSponsors = results.filter((r) => r.normalizedSponsor === 'Unknown');
	const unknownCountries = results.filter((r) => !r.resolvedCountry);

	console.log('## UNKNOWN SPONSORS');
	console.log(`Count: ${unknownSponsors.length}`);
	console.log('');
	for (const r of unknownSponsors) {
		console.log(`### ${r.github}`);
		console.log(`WP.org username: ${r.wporg || r.github}`);
		console.log(`WP.org employer: ${r.wporgSponsor || '(empty)'}`);
		console.log(`WP.org location: ${r.wporgLocation || '(empty)'}`);
		console.log(`GitHub company: ${r.githubCompany || '(empty)'}`);
		console.log(`GitHub location: ${r.githubLocation || '(empty)'}`);
		console.log(`→ ${r.profileUrls.wporg}`);
		console.log(`→ ${r.profileUrls.github}`);
		console.log('');
	}

	console.log('---');
	console.log('');

	console.log('## UNKNOWN COUNTRIES');
	console.log(`Count: ${unknownCountries.length}`);
	console.log('');
	for (const r of unknownCountries) {
		console.log(`### ${r.github}`);
		console.log(`WP.org username: ${r.wporg || r.github}`);
		console.log(`WP.org location: ${r.wporgLocation || '(empty)'}`);
		console.log(`GitHub location: ${r.githubLocation || '(empty)'}`);
		console.log(`Normalized sponsor: ${r.normalizedSponsor}`);
		const hasGHLocation = r.githubLocation && r.normalizedSponsor !== 'Unknown';
		if (hasGHLocation) {
			console.log(`⚠️  BUG: Has GitHub location "${r.githubLocation}" but not fetched (WP.org has sponsor)`);
		}
		console.log(`→ ${r.profileUrls.wporg}`);
		console.log(`→ ${r.profileUrls.github}`);
		console.log('');
	}

	console.log('---');
	console.log('');

	console.log('## SUMMARY');
	console.log(`Total contributors: ${results.length}`);
	console.log(`Unknown sponsors: ${unknownSponsors.length}`);
	console.log(`Unknown countries: ${unknownCountries.length}`);
	console.log('');

	// Identify bug-affected contributors
	const bugAffected = results.filter(
		(r) => !r.resolvedCountry && r.githubLocation && r.wporgSponsor
	);
	if (bugAffected.length > 0) {
		console.log('## BUG-AFFECTED (have GitHub location but WP.org sponsor blocks fallback)');
		console.log(`Count: ${bugAffected.length}`);
		for (const r of bugAffected) {
			console.log(`- ${r.github}: GitHub location="${r.githubLocation}", WP.org sponsor="${r.wporgSponsor}"`);
		}
	}
}

main().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
