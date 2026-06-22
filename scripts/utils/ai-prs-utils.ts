/**
 * Pure helpers for the AI-assisted PR feature: classification, date attribution,
 * and per-release roll-up. No network or filesystem access, so they are unit-testable.
 * @module scripts/utils/ai-prs-utils
 */

export type AIMode = 'non-agent' | 'agent';

/** A single detected PR with disclosed AI involvement. */
export interface AIPullRequest {
  number: number;
  title: string;
  url: string;
  author: string;
  /** "agent" when opened by a known agent account, otherwise "non-agent". */
  mode: AIMode;
  /** Marker ids that matched (a PR can use more than one tool). */
  tools: string[];
  /** Which channel surfaced it. Precedence when several match: author > commit > body. */
  detectedVia: 'body' | 'author' | 'commit';
  /** Merge date, YYYY-MM-DD. */
  mergedAt: string;
}

/** AI counts for a release or cycle. */
export interface AIBreakdown {
  /** PRs per tool. A PR using two tools counts in both, so this can exceed aiPRs. */
  byTool: Record<string, number>;
  nonAgent: number;
  agent: number;
}

/** A release reduced to what attribution needs. */
export interface ReleaseWindow {
  version: string;
  /** Release date, YYYY-MM-DD. */
  date: string;
}

/** "agent" when the author is a known agent account, otherwise "non-agent". */
export function classifyMode(
  authorLogin: string,
  botLogins: Set<string>
): AIMode {
  return botLogins.has(authorLogin.toLowerCase()) ? 'agent' : 'non-agent';
}

/**
 * Resolve the mode for a detection. A PR surfaced through the bot-author channel is
 * agent-authored by definition, since GitHub exposes a different display login (e.g.
 * "Copilot") than the `author:` search qualifier (`copilot-swe-agent[bot]`), so the
 * login alone can't be trusted. Otherwise fall back to the author login.
 */
export function resolveMode(
  via: 'body' | 'author' | 'commit',
  authorLogin: string,
  botLogins: Set<string>
): AIMode {
  if (via === 'author') return 'agent';
  return classifyMode(authorLogin, botLogins);
}

/**
 * Pull the PR number out of a squash-merge commit subject, e.g.
 * "Popover: fix re-anchor (#78885)" -> 78885. Uses the last `(#N)` on the first
 * line, so a revert like `Revert "X (#1)" (#2)` attributes to the revert PR (#2).
 * Returns null when the subject has no PR reference (e.g. a direct push).
 */
export function extractPRNumber(commitMessage: string): number | null {
  const subject = commitMessage.split('\n', 1)[0];
  const matches = [...subject.matchAll(/\(#(\d+)\)/g)];
  if (matches.length === 0) return null;
  return parseInt(matches[matches.length - 1][1], 10);
}

/**
 * Attribute a merge date to the release that shipped it: the first release whose
 * date is on or after the merge date. Returns null for PRs merged after the latest
 * release (not shipped yet).
 *
 * @param mergedAt      Merge date (anything starting with YYYY-MM-DD).
 * @param releasesAsc   Releases sorted ascending by date.
 */
export function attributeToRelease(
  mergedAt: string,
  releasesAsc: ReleaseWindow[]
): string | null {
  const day = mergedAt.slice(0, 10);
  for (const release of releasesAsc) {
    if (release.date >= day) {
      return release.version;
    }
  }
  return null;
}

/**
 * Roll detected PRs up into per-release AI counts.
 * @returns Map of release version -> { aiPRs, ...breakdown }. Unreleased PRs are dropped.
 */
export function rollupByRelease(
  prs: AIPullRequest[],
  releasesAsc: ReleaseWindow[]
): Map<string, { aiPRs: number } & AIBreakdown> {
  const map = new Map<string, { aiPRs: number } & AIBreakdown>();

  for (const pr of prs) {
    const version = attributeToRelease(pr.mergedAt, releasesAsc);
    if (!version) {
      continue;
    }

    let agg = map.get(version);
    if (!agg) {
      agg = { aiPRs: 0, byTool: {}, nonAgent: 0, agent: 0 };
      map.set(version, agg);
    }

    agg.aiPRs += 1;
    if (pr.mode === 'agent') {
      agg.agent += 1;
    } else {
      agg.nonAgent += 1;
    }
    for (const tool of pr.tools) {
      agg.byTool[tool] = (agg.byTool[tool] || 0) + 1;
    }
  }

  return map;
}

/** Sum several breakdowns into one (used to roll releases up into a WP cycle). */
export function sumBreakdowns(
  parts: Array<{ aiPRs: number } & AIBreakdown>
): { aiPRs: number } & AIBreakdown {
  const total = { aiPRs: 0, byTool: {} as Record<string, number>, nonAgent: 0, agent: 0 };
  for (const part of parts) {
    total.aiPRs += part.aiPRs;
    total.nonAgent += part.nonAgent;
    total.agent += part.agent;
    for (const [tool, count] of Object.entries(part.byTool)) {
      total.byTool[tool] = (total.byTool[tool] || 0) + count;
    }
  }
  return total;
}
