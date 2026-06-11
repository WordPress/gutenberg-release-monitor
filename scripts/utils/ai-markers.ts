/**
 * Configuration of AI tool "markers" used to detect disclosed AI involvement in PRs.
 *
 * Two detection channels:
 *  - bodyMarkers: phrases a tool writes into the PR title/body, found via the Search API.
 *  - botAuthors: GitHub login of an autonomous coding agent that opens PRs directly.
 *
 * Markers and bot accounts change often and new agents keep appearing, so this list
 * is meant to be edited as they show up in the repository.
 * @module scripts/utils/ai-markers
 */

export interface AIMarker {
  /** Stable id, used as the breakdown key. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Phrases searched in the PR title/body via the Search API. */
  bodyMarkers: string[];
  /** Author logins of autonomous agents. PRs they open count as "autonomous". */
  botAuthors: string[];
}

export const AI_MARKERS: AIMarker[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    bodyMarkers: ['Generated with Claude Code', 'Co-authored-by: Claude'],
    botAuthors: [],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    bodyMarkers: ['Co-authored-by: Copilot'],
    botAuthors: ['copilot-swe-agent[bot]'],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    bodyMarkers: ['Generated with Cursor', 'cursoragent'],
    botAuthors: ['cursor[bot]'],
  },
  {
    id: 'devin',
    label: 'Devin',
    bodyMarkers: [],
    botAuthors: ['devin-ai-integration[bot]'],
  },
  // codex (chatgpt-codex-connector[bot]), jules (google-labs-jules[bot]),
  // openhands, codegen-sh[bot], sweep-ai[bot] ... add as they appear.
];

/** All bot-author logins across markers, lowercased, for quick membership checks. */
export const BOT_AUTHOR_LOGINS = new Set<string>(
  AI_MARKERS.flatMap((m) => m.botAuthors.map((a) => a.toLowerCase()))
);
