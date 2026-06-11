import { describe, it, expect } from 'vitest';
import {
  classifyMode,
  resolveMode,
  extractPRNumber,
  attributeToRelease,
  rollupByRelease,
  sumBreakdowns,
  type AIPullRequest,
  type ReleaseWindow,
} from '../../../scripts/utils/ai-prs-utils.js';

const BOTS = new Set(['copilot-swe-agent[bot]', 'devin-ai-integration[bot]']);

// Releases ascending by date, as the script builds them.
const RELEASES: ReleaseWindow[] = [
  { version: '22.0', date: '2026-01-10' },
  { version: '22.1', date: '2026-01-24' },
  { version: '22.2', date: '2026-02-07' },
];

function pr(overrides: Partial<AIPullRequest>): AIPullRequest {
  return {
    number: 1,
    title: 'Some PR',
    url: 'https://example.test/1',
    author: 'human',
    mode: 'assisted',
    tools: ['claude-code'],
    detectedVia: 'body',
    mergedAt: '2026-01-15',
    ...overrides,
  };
}

describe('classifyMode', () => {
  it('marks PRs from a known agent bot as autonomous', () => {
    expect(classifyMode('copilot-swe-agent[bot]', BOTS)).toBe('autonomous');
  });

  it('is case-insensitive on the login', () => {
    expect(classifyMode('Copilot-SWE-Agent[bot]', BOTS)).toBe('autonomous');
  });

  it('marks everyone else as assisted', () => {
    expect(classifyMode('tyxla', BOTS)).toBe('assisted');
  });
});

describe('resolveMode', () => {
  it('treats the bot-author channel as autonomous regardless of the display login', () => {
    // The Search API returns "Copilot" as the login, not the search qualifier.
    expect(resolveMode('author', 'Copilot', BOTS)).toBe('autonomous');
  });

  it('falls back to the author login for body-channel detections', () => {
    expect(resolveMode('body', 'tyxla', BOTS)).toBe('assisted');
    expect(resolveMode('body', 'copilot-swe-agent[bot]', BOTS)).toBe('autonomous');
  });

  it('treats a commit-trailer detection as assisted for a human author', () => {
    expect(resolveMode('commit', 'tyxla', BOTS)).toBe('assisted');
  });
});

describe('extractPRNumber', () => {
  it('reads the PR number from a squash commit subject', () => {
    expect(extractPRNumber('Popover: fix re-anchor (#78885)\n\nCo-authored-by: x')).toBe(78885);
  });

  it('uses the last reference so reverts attribute to the revert PR', () => {
    expect(extractPRNumber('Revert "Add thing (#100)" (#205)')).toBe(205);
  });

  it('ignores PR references that appear only in the body', () => {
    expect(extractPRNumber('Fix something\n\nRelated to (#999)')).toBeNull();
  });

  it('returns null when there is no PR reference', () => {
    expect(extractPRNumber('Direct push to trunk')).toBeNull();
  });
});

describe('attributeToRelease', () => {
  it('attributes a PR to the first release on or after its merge date', () => {
    expect(attributeToRelease('2026-01-15', RELEASES)).toBe('22.1');
    expect(attributeToRelease('2026-01-30', RELEASES)).toBe('22.2');
  });

  it('treats a merge on the release date as part of that release', () => {
    expect(attributeToRelease('2026-01-24', RELEASES)).toBe('22.1');
  });

  it('attributes anything before the first release to that first release', () => {
    expect(attributeToRelease('2025-12-01', RELEASES)).toBe('22.0');
  });

  it('returns null for PRs merged after the latest release', () => {
    expect(attributeToRelease('2026-03-01', RELEASES)).toBeNull();
  });

  it('ignores a time component in the merge date', () => {
    expect(attributeToRelease('2026-01-15T09:30:00Z', RELEASES)).toBe('22.1');
  });
});

describe('rollupByRelease', () => {
  it('counts PRs, modes, and tools per release', () => {
    const prs: AIPullRequest[] = [
      pr({ number: 1, mergedAt: '2026-01-15', mode: 'assisted', tools: ['claude-code'] }),
      pr({ number: 2, mergedAt: '2026-01-16', mode: 'autonomous', tools: ['copilot'] }),
      pr({ number: 3, mergedAt: '2026-01-30', mode: 'assisted', tools: ['claude-code', 'copilot'] }),
    ];
    const map = rollupByRelease(prs, RELEASES);

    expect(map.get('22.1')).toEqual({
      aiPRs: 2,
      assisted: 1,
      autonomous: 1,
      byTool: { 'claude-code': 1, copilot: 1 },
    });
    // PR #3 uses two tools, so byTool sums to more than aiPRs for that release.
    expect(map.get('22.2')).toEqual({
      aiPRs: 1,
      assisted: 1,
      autonomous: 0,
      byTool: { 'claude-code': 1, copilot: 1 },
    });
  });

  it('drops PRs that have no release (merged after the latest)', () => {
    const prs = [pr({ number: 9, mergedAt: '2026-03-01' })];
    expect(rollupByRelease(prs, RELEASES).size).toBe(0);
  });
});

describe('sumBreakdowns', () => {
  it('adds counts and merges tool maps across parts', () => {
    const summed = sumBreakdowns([
      { aiPRs: 2, assisted: 1, autonomous: 1, byTool: { 'claude-code': 1, copilot: 1 } },
      { aiPRs: 1, assisted: 1, autonomous: 0, byTool: { 'claude-code': 1 } },
    ]);
    expect(summed).toEqual({
      aiPRs: 3,
      assisted: 2,
      autonomous: 1,
      byTool: { 'claude-code': 2, copilot: 1 },
    });
  });

  it('returns an empty breakdown for no parts', () => {
    expect(sumBreakdowns([])).toEqual({ aiPRs: 0, assisted: 0, autonomous: 0, byTool: {} });
  });
});
