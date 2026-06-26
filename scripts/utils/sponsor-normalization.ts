/**
 * Sponsor name normalization using suffix stripping.
 *
 * Consolidates variations like "Multidots Inc", "Multidots Solutions pvt ltd"
 * into a single canonical name by removing common business suffixes.
 */

/**
 * Values that indicate "no sponsor data" - treat as Unknown.
 */
const NOT_A_SPONSOR = [
	'n/a',
	'none',
	'-',
];

/**
 * Known GitHub usernames that are not company names.
 * These should be treated as Unknown.
 */
const KNOWN_USERNAMES: string[] = [];

/**
 * Values that indicate self-sponsored contributors.
 * These people work for themselves, not for a company.
 */
const SELF_SPONSORED = [
	'freelance',
	'freelancer',
	'self-employed',
	'self employed',
	'selfemployed',
	'independent',
	'open to work',
	'#opentowork',
	'looking for work',
	'looking for opportunity',
	'available for hire',
	'wordpress developer',
];

/**
 * Common business suffixes to strip for comparison.
 */
const BUSINESS_SUFFIXES = [
	// English
	'inc', 'incorporated', 'corp', 'corporation', 'co', 'company',
	'ltd', 'limited', 'llc', 'llp', 'plc',
	// International
	'pvt', 'private', 'gmbh', 'ag', 'sa', 'srl', 'bv', 'nv',
	// Descriptive
	'solutions', 'services', 'technologies', 'technology', 'tech',
	'software', 'systems', 'group', 'labs', 'studio', 'studios',
	'digital', 'media', 'agency', 'consulting',
];

/**
 * Normalize a sponsor name for comparison.
 * Strips suffixes, lowercases, removes punctuation.
 */
function normalizeSponsorName( name: string ): string {
	let normalized = name
		.toLowerCase()
		.replace( /[.,\-_'"()]/g, ' ' )
		.replace( /\s+/g, ' ' )
		.trim();

	// Remove business suffixes iteratively
	let changed = true;
	while ( changed ) {
		changed = false;
		for ( const suffix of BUSINESS_SUFFIXES ) {
			const pattern = new RegExp( `\\s+${ suffix }$`, 'i' );
			if ( pattern.test( normalized ) ) {
				normalized = normalized.replace( pattern, '' ).trim();
				changed = true;
			}
		}
	}

	return normalized;
}

/**
 * Sponsor normalizer that tracks canonical names.
 * Uses suffix stripping + exact match for deduplication.
 */
export class SponsorNormalizer {
	// Maps normalized name → canonical (display) name
	private canonicalNames = new Map< string, string >();

	/**
	 * Check if a value should be treated as "Unknown".
	 */
	private isNotASponsor( value: string ): boolean {
		const lower = value.toLowerCase().trim();
		return NOT_A_SPONSOR.includes( lower ) || KNOWN_USERNAMES.includes( lower );
	}

	/**
	 * Extract company name from @company patterns (e.g., "Lead Engineer @bigbite" -> "bigbite").
	 */
	private extractAtMention( value: string ): string | null {
		const match = value.match( /@([a-zA-Z0-9_-]+)/ );
		return match ? match[ 1 ] : null;
	}

	/**
	 * Check if a value indicates self-sponsorship.
	 */
	private isSelfSponsored( value: string ): boolean {
		const lower = value.toLowerCase().trim();
		return SELF_SPONSORED.some( pattern =>
			lower === pattern || lower.includes( pattern )
		);
	}

	/**
	 * Normalize a sponsor name, returning the canonical form.
	 * First occurrence of a normalized name becomes the canonical version.
	 */
	normalize( rawSponsor: string | null ): string {
		if ( ! rawSponsor ) {
			return 'Unknown';
		}

		const trimmed = rawSponsor.trim();
		if ( ! trimmed ) {
			return 'Unknown';
		}

		// Check for @company patterns first (e.g., "Lead Engineer @bigbite")
		const atMention = this.extractAtMention( trimmed );
		if ( atMention ) {
			// Recursively normalize the extracted company name
			return this.normalize( atMention );
		}

		// Check for self-sponsored first (freelance, independent, etc.)
		if ( this.isSelfSponsored( trimmed ) ) {
			return 'Self-sponsored';
		}

		// Check for non-sponsor values (job-seeking status, n/a, usernames, etc.)
		if ( this.isNotASponsor( trimmed ) ) {
			return 'Unknown';
		}

		const normalized = normalizeSponsorName( trimmed );
		if ( ! normalized ) {
			return 'Unknown';
		}

		// Check for existing exact match after normalization
		const existingCanonical = this.canonicalNames.get( normalized );
		if ( existingCanonical ) {
			return existingCanonical;
		}

		// New sponsor - use original (trimmed) as canonical
		this.canonicalNames.set( normalized, trimmed );
		return trimmed;
	}

	/**
	 * Get statistics about normalization.
	 */
	getStats(): { uniqueSponsors: number } {
		return {
			uniqueSponsors: this.canonicalNames.size,
		};
	}
}
