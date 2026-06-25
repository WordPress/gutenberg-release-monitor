import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWPOrgProfile } from '../../../scripts/utils/wporg-api.js';

const RETRY_OPTIONS = {
	maxAttempts: 3,
	initialRetryDelayMs: 0,
};

const VALID_PROFILE_HTML = `
<html>
	<body>
		<li id="user-member-since"><strong>October 18th, 2016</strong></li>
		<li id="user-company"><strong>Automattic &amp; Partners</strong></li>
		<li id="user-location"><strong>Madrid, Spain</strong></li>
		<li id="user-github"><a href="https://github.com/example-user">GitHub</a></li>
		<ul id="user-badges">
			<li><div class="badge"></div>Core Contributor</li>
			<li><div class="badge"></div>Plugin Developer</li>
		</ul>
	</body>
</html>
`;

let originalFetch: typeof globalThis.fetch;

function response(
	status: number,
	body = '',
	headers?: Record< string, string >
): Response {
	return new Response( body, {
		status,
		statusText: status === 200 ? 'OK' : 'Error',
		headers,
	} );
}

function mockFetchResponses(
	...responses: Array< Response | Error >
): ReturnType< typeof vi.fn > {
	const fetchMock = vi.fn();

	for ( const fetchResponse of responses ) {
		if ( fetchResponse instanceof Error ) {
			fetchMock.mockRejectedValueOnce( fetchResponse );
		} else {
			fetchMock.mockResolvedValueOnce( fetchResponse );
		}
	}

	globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
	return fetchMock;
}

describe( 'WP.org profile API utilities', () => {
	beforeEach( () => {
		originalFetch = globalThis.fetch;
		vi.spyOn( console, 'warn' ).mockImplementation( () => undefined );
	} );

	afterEach( () => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	} );

	it( 'returns a missing profile for 404 without retrying', async () => {
		const fetchMock = mockFetchResponses( response( 404 ) );

		const profile = await fetchWPOrgProfile( 'missing-user', RETRY_OPTIONS );

		expect( fetchMock ).toHaveBeenCalledTimes( 1 );
		expect( profile ).toMatchObject( {
			username: 'missing-user',
			wpProfileExists: false,
			employer: null,
			location: null,
			wporgLinkedGitHubUsername: null,
		} );
	} );

	it( 'parses a valid profile response', async () => {
		mockFetchResponses( response( 200, VALID_PROFILE_HTML ) );

		const profile = await fetchWPOrgProfile( 'example', RETRY_OPTIONS );

		expect( profile ).toMatchObject( {
			username: 'example',
			wpProfileExists: true,
			employer: 'Automattic & Partners',
			location: 'Madrid, Spain',
			memberSince: '2016-10-18',
			badges: [ 'Core Contributor', 'Plugin Developer' ],
			wporgLinkedGitHubUsername: 'example-user',
			employerSource: 'wporg',
		} );
	} );

	it( 'retries a 429 and returns the later successful profile', async () => {
		const fetchMock = mockFetchResponses(
			response( 429, '', { 'retry-after': '0' } ),
			response( 200, VALID_PROFILE_HTML )
		);

		const profile = await fetchWPOrgProfile( 'rate-limited', RETRY_OPTIONS );

		expect( fetchMock ).toHaveBeenCalledTimes( 2 );
		expect( profile?.wpProfileExists ).toBe( true );
		expect( profile?.wporgLinkedGitHubUsername ).toBe( 'example-user' );
	} );

	it( 'returns null when 5xx responses keep failing', async () => {
		const fetchMock = mockFetchResponses(
			response( 503 ),
			response( 503 ),
			response( 503 )
		);

		const profile = await fetchWPOrgProfile( 'temporarily-down', RETRY_OPTIONS );

		expect( fetchMock ).toHaveBeenCalledTimes( 3 );
		expect( profile ).toBeNull();
	} );

	it( 'returns null when network errors keep happening', async () => {
		const fetchMock = mockFetchResponses(
			new Error( 'socket closed' ),
			new Error( 'socket closed' ),
			new Error( 'socket closed' )
		);

		const profile = await fetchWPOrgProfile( 'network-error', RETRY_OPTIONS );

		expect( fetchMock ).toHaveBeenCalledTimes( 3 );
		expect( profile ).toBeNull();
	} );
} );
