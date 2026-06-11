/**
 * Detect merged PRs in WordPress/gutenberg that disclose AI involvement and turn
 * them into release metrics.
 *
 * Two cheap Search API channels are used:
 *   - body markers (a phrase the tool writes into the PR title/body)
 *   - bot authors (PRs opened directly by a coding agent -> "autonomous")
 *
 * Output:
 *   - public/data/ai-prs.json: the raw detected PR list plus totals.
 *   - aiPRs / aiBreakdown injected per release into gb-releases.json.
 *   - aiPRs / aiBreakdown injected per WP cycle into wp-cycles.json.
 *
 * This measures *disclosed* AI use, so the numbers are a lower bound: the Search
 * API does not index commit messages, and not everyone discloses.
 *
 * Usage:
 *   GITHUB_TOKEN=... npm run data-sync:ai-prs
 *
 * @module scripts/build-ai-prs
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { searchMergedPRs } from './utils/github-api.js';
import { writeJsonIfChanged } from './utils/file-utils.js';
import { AI_MARKERS, BOT_AUTHOR_LOGINS } from './utils/ai-markers.js';
import {
  resolveMode,
  rollupByRelease,
  sumBreakdowns,
  type AIPullRequest,
  type AIBreakdown,
  type ReleaseWindow,
} from './utils/ai-prs-utils.js';

interface ParseArgs {
  releases: string;
  cycles: string;
  output: string;
  delay: string;
  verbose: boolean;
}

function getArgs(): ParseArgs {
  const { values } = parseArgs({
    options: {
      releases: { type: 'string', default: 'public/data/gb-releases.json' },
      cycles: { type: 'string', default: 'public/data/wp-cycles.json' },
      output: { type: 'string', short: 'o', default: 'public/data/ai-prs.json' },
      delay: { type: 'string', short: 'd', default: '1000' },
      verbose: { type: 'boolean', default: false },
    },
  });
  return values as ParseArgs;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Minimal shape of a normalized release on disk; we only touch a few fields. */
interface DiskRelease {
  version: string;
  date?: string;
  memberOf?: string;
  isAggregated?: boolean;
  aiPRs?: number;
  aiBreakdown?: AIBreakdown;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const args = getArgs();
  const delayMs = parseInt(args.delay, 10);

  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠️  No GITHUB_TOKEN set; the Search API rate limit will be very low.');
  }

  // 1. Collect detected PRs, keyed by number, merging across markers/channels.
  const detected = new Map<number, AIPullRequest>();

  const upsert = (
    pr: { number: number; title: string; url: string; author: string; mergedAt: string },
    toolId: string,
    via: 'body' | 'author'
  ) => {
    const existing = detected.get(pr.number);
    if (existing) {
      if (!existing.tools.includes(toolId)) existing.tools.push(toolId);
      if (via === 'author') {
        existing.detectedVia = 'author';
        existing.mode = 'autonomous';
      }
      return;
    }
    detected.set(pr.number, {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      author: pr.author,
      mode: resolveMode(via, pr.author, BOT_AUTHOR_LOGINS),
      tools: [toolId],
      detectedVia: via,
      mergedAt: pr.mergedAt,
    });
  };

  const queries: Array<{ q: string; toolId: string; via: 'body' | 'author' }> = [];
  for (const marker of AI_MARKERS) {
    for (const phrase of marker.bodyMarkers) {
      queries.push({ q: `"${phrase}"`, toolId: marker.id, via: 'body' });
    }
    for (const login of marker.botAuthors) {
      queries.push({ q: `author:${login}`, toolId: marker.id, via: 'author' });
    }
  }

  console.log(`🔎 Running ${queries.length} Search API queries...`);
  for (let i = 0; i < queries.length; i++) {
    const { q, toolId, via } = queries[i];
    const found = await searchMergedPRs(q);
    for (const item of found) {
      const mergedAt = (item.merged_at || item.closed_at || '').slice(0, 10);
      if (!mergedAt) continue;
      upsert(
        {
          number: item.number,
          title: item.title,
          url: item.html_url,
          author: item.user?.login ?? 'unknown',
          mergedAt,
        },
        toolId,
        via
      );
    }
    if (args.verbose) {
      console.log(`   [${i + 1}/${queries.length}] ${toolId} via ${via}: ${found.length} hits (${q})`);
    }
    if (i < queries.length - 1) await sleep(delayMs);
  }

  const prs = [...detected.values()].sort((a, b) => b.number - a.number);
  console.log(`✅ ${prs.length} unique PRs with disclosed AI involvement.`);

  // 2. Load releases and build the attribution windows (sorted ascending by date).
  const releases = JSON.parse(readFileSync(args.releases, 'utf-8')) as DiskRelease[];
  const releasesAsc: ReleaseWindow[] = releases
    .filter((r): r is DiskRelease & { date: string } => Boolean(r.date) && !r.isAggregated)
    .map((r) => ({ version: r.version, date: r.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const perRelease = rollupByRelease(prs, releasesAsc);

  const unreleased = prs.length - [...perRelease.values()].reduce((s, a) => s + a.aiPRs, 0);
  if (unreleased > 0) {
    console.log(`   ${unreleased} PR(s) merged after the latest release (not attributed).`);
  }

  // 3. Write the raw list + totals.
  const totals = sumBreakdowns([...perRelease.values()]);
  const output = {
    totals: {
      aiPRs: prs.length,
      assisted: prs.filter((p) => p.mode === 'assisted').length,
      autonomous: prs.filter((p) => p.mode === 'autonomous').length,
      byTool: totals.byTool,
    },
    prs,
  };
  const wroteList = writeJsonIfChanged(args.output, output);

  // 4. Inject per-release counts into gb-releases.json.
  for (const release of releases) {
    if (release.isAggregated || !release.date) continue;
    const agg = perRelease.get(release.version);
    release.aiPRs = agg ? agg.aiPRs : 0;
    if (agg && agg.aiPRs > 0) {
      release.aiBreakdown = { byTool: agg.byTool, assisted: agg.assisted, autonomous: agg.autonomous };
    } else {
      delete release.aiBreakdown;
    }
  }
  const wroteReleases = writeJsonIfChanged(args.releases, releases);

  // 5. Inject per-cycle counts into wp-cycles.json (sum of member releases).
  const byCycle = new Map<string, Array<{ aiPRs: number } & AIBreakdown>>();
  for (const release of releases) {
    if (release.isAggregated || !release.memberOf) continue;
    const agg = perRelease.get(release.version);
    if (!agg) continue;
    const list = byCycle.get(release.memberOf) ?? [];
    list.push(agg);
    byCycle.set(release.memberOf, list);
  }

  const cycles = JSON.parse(readFileSync(args.cycles, 'utf-8')) as DiskRelease[];
  for (const cycle of cycles) {
    const parts = byCycle.get(cycle.version);
    if (parts && parts.length > 0) {
      const summed = sumBreakdowns(parts);
      cycle.aiPRs = summed.aiPRs;
      cycle.aiBreakdown = { byTool: summed.byTool, assisted: summed.assisted, autonomous: summed.autonomous };
    } else {
      cycle.aiPRs = 0;
      delete cycle.aiBreakdown;
    }
  }
  const wroteCycles = writeJsonIfChanged(args.cycles, cycles);

  console.log('\n📊 By tool:', JSON.stringify(totals.byTool));
  console.log(`📝 Wrote: ai-prs.json=${wroteList} gb-releases.json=${wroteReleases} wp-cycles.json=${wroteCycles}`);
}

main().catch((error) => {
  console.error('\n❌ build-ai-prs failed:', error);
  process.exit(1);
});
