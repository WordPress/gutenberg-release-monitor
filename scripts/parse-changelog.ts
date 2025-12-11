import { parseArgs } from 'node:util';
import { fetchAllReleases, fetchReleaseByTag, filterReleasesByVersion } from './utils/github-api.js';
import type { ParseArgs } from './utils/types.js';

/**
 * Parse command line arguments.
 */
function getArgs(): ParseArgs {
  const { values } = parseArgs({
    options: {
      version: { type: 'string', short: 'v' },
      from: { type: 'string', short: 'f' },
      to: { type: 'string', short: 't' },
      output: { type: 'string', short: 'o', default: 'data/releases.json' },
      verbose: { type: 'boolean', default: false },
    },
  });

  return values as ParseArgs;
}

async function main() {
  const args = getArgs();

  console.log('Gutenberg Release Parser');
  console.log('========================');

  if (args.version) {
    console.log(`Parsing single version: ${args.version}`);
  } else if (args.from || args.to) {
    console.log(`Parsing version range: ${args.from ?? 'earliest'} to ${args.to ?? 'latest'}`);
  } else {
    console.log('Parsing all versions');
  }

  try {
    // Fetch releases
    let releases;
    if (args.version) {
      const release = await fetchReleaseByTag(args.version);
      releases = release ? [release] : [];
      if (releases.length === 0) {
        console.error(`Release not found: ${args.version}`);
        process.exit(1);
      }
    } else {
      const allReleases = await fetchAllReleases();
      releases = filterReleasesByVersion(allReleases, {
        from: args.from,
        to: args.to,
      });
    }

    console.log(`\nFound ${releases.length} releases to parse`);

    // TODO: Parse changelogs (next task)
    // TODO: Output to JSON (next task)

    console.log('\nParser structure ready. Changelog parsing not yet implemented.');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
