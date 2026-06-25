/**
 * Types used by scripts for parsing and aggregating data.
 * These are internal to scripts - UI uses types from src/data/normalized.ts
 */

import type { AIBreakdown } from '../src/data/normalized.js';

/** Contributor aggregate statistics */
export interface ReleaseContributorAggregates {
  stats: {
    total: number;
    newContributors: number;
  };
  sponsorBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
  aggregatedAt: string;
}

/** Raw parsed release data (internal to scripts) */
export interface Release {
  gbVersion: string;
  wpVersion: string | null;
  date: string;
  isLastBeforeWPBeta: boolean;
  totalPRs: number;
  categories: Record<string, number>;
  contributors: number;
  newContributors: number;
  contributorsList: string[];
  newContributorsList: string[];
  contributorAggregates?: ReleaseContributorAggregates;
  changelogUrl: string;
  parsedAt: string;
  parserVersion: string;
  aiPRs?: number;
  aiBreakdown?: AIBreakdown;
}

/** WordPress release schedule entry */
export interface WPRelease {
  wpVersion: string;
  beta1Date: string;
  stableDate: string;
  lastGBVersion: string;
  gbVersionRange: string;
}
