/**
 * Pure helpers for the AI-assisted PR feature: classification, date attribution,
 * and per-release roll-up. No network or filesystem access, so they are unit-testable.
 * @module scripts/utils/ai-prs-utils
 */

export type AIMode = 'assisted' | 'autonomous';

/** A single detected PR with disclosed AI involvement. */
export interface AIPullRequest {
  number: number;
  title: string;
  url: string;
  author: string;
  /** "autonomous" when opened by an agent bot, otherwise "assisted". */
  mode: AIMode;
  /** Marker ids that matched (a PR can use more than one tool). */
  tools: string[];
  /** Which channel surfaced it. "author" wins when both matched. */
  detectedVia: 'body' | 'author';
  /** Merge date, YYYY-MM-DD. */
  mergedAt: string;
}

/** AI counts for a release or cycle. */
export interface AIBreakdown {
  /** PRs per tool. A PR using two tools counts in both, so this can exceed aiPRs. */
  byTool: Record<string, number>;
  assisted: number;
  autonomous: number;
}

/** A release reduced to what attribution needs. */
export interface ReleaseWindow {
  version: string;
  /** Release date, YYYY-MM-DD. */
  date: string;
}

/** "autonomous" when the author is a known agent bot, otherwise "assisted". */
export function classifyMode(
  authorLogin: string,
  botLogins: Set<string>
): AIMode {
  return botLogins.has(authorLogin.toLowerCase()) ? 'autonomous' : 'assisted';
}

/**
 * Resolve the mode for a detection. A PR surfaced through the bot-author channel is
 * autonomous by definition, since GitHub exposes a different display login (e.g.
 * "Copilot") than the `author:` search qualifier (`copilot-swe-agent[bot]`), so the
 * login alone can't be trusted. Otherwise fall back to the author login.
 */
export function resolveMode(
  via: 'body' | 'author',
  authorLogin: string,
  botLogins: Set<string>
): AIMode {
  if (via === 'author') return 'autonomous';
  return classifyMode(authorLogin, botLogins);
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
      agg = { aiPRs: 0, byTool: {}, assisted: 0, autonomous: 0 };
      map.set(version, agg);
    }

    agg.aiPRs += 1;
    if (pr.mode === 'autonomous') {
      agg.autonomous += 1;
    } else {
      agg.assisted += 1;
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
  const total = { aiPRs: 0, byTool: {} as Record<string, number>, assisted: 0, autonomous: 0 };
  for (const part of parts) {
    total.aiPRs += part.aiPRs;
    total.assisted += part.assisted;
    total.autonomous += part.autonomous;
    for (const [tool, count] of Object.entries(part.byTool)) {
      total.byTool[tool] = (total.byTool[tool] || 0) + count;
    }
  }
  return total;
}
