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
 * Values that indicate self-sponsored contributors.
 * These people work for themselves, not for a company.
 */
const SELF_SPONSORED = [
	'freelance',
	'freelancer',
	'self-employed',
	'self employed',
	'independent',
	'open to work',
	'looking for work',
	'available for hire',
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
		return NOT_A_SPONSOR.some( pattern =>
			lower === pattern || lower.includes( pattern )
		);
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

		// Check for self-sponsored first (freelance, independent, etc.)
		if ( this.isSelfSponsored( trimmed ) ) {
			return 'Self-sponsored';
		}

		// Check for non-sponsor values (job-seeking status, n/a, etc.)
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
