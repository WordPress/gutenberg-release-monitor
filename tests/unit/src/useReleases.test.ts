import { describe, expect, it } from 'vitest';
import { resolveSummaryEndpoint } from '../../../src/hooks/useReleases.js';
import type { ProjectConfig, TabLabels } from '../../../src/config/types.js';

const labels: TabLabels = {
  averagesToggle: null,
  statsHeader: null,
  childItem: null,
  versionColumn: 'Version',
  childVersionColumn: null,
  parentVersionColumn: null,
  parentVersionPrefix: null,
  itemContext: null,
  specialMarkerTooltip: null,
  chartSecondaryLabel: null,
};

const config: ProjectConfig = {
  version: '1.0.0',
  project: {
    name: 'Test Project',
    description: 'Test data',
    projectUrl: 'https://example.com',
    projectLabel: 'Test',
    disclaimer: 'Test disclaimer',
    learnMoreUrl: 'https://example.com/docs',
  },
  tabs: [
    {
      id: 'by-gb-release',
      title: 'By GB Release',
      dataEndpoint: 'gb-releases.json',
      isAggregated: false,
      versionPrefix: 'Gutenberg',
      supportedViewModes: ['averages'],
      tableCardClass: null,
      urlParamKey: 'gb',
      defaultItemSummaryField: null,
      showReferenceLines: false,
      labels,
    },
    {
      id: 'scf-releases',
      title: 'SCF Releases',
      dataEndpoint: 'scf/scf-by-major.json',
      summaryEndpoint: 'scf/scf-summary.json',
      isAggregated: true,
      hidden: true,
      versionPrefix: 'SCF',
      supportedViewModes: ['averages'],
      tableCardClass: null,
      urlParamKey: 'scf',
      defaultItemSummaryField: null,
      showReferenceLines: false,
      labels,
    },
  ],
  dataSources: {
    summary: 'summary.json',
  },
  defaults: {
    tab: 'by-gb-release',
    viewMode: 'averages',
    chartType: 'stacked',
    metric: 'prs',
    releaseCount: 50,
  },
};

describe('resolveSummaryEndpoint', () => {
  it('returns a tab-specific summary endpoint when configured', () => {
    expect(resolveSummaryEndpoint(config, 'scf-releases')).toBe('scf/scf-summary.json');
  });

  it('falls back to the global summary endpoint when a tab has no override', () => {
    expect(resolveSummaryEndpoint(config, 'by-gb-release')).toBe('summary.json');
  });

  it('falls back to the global summary endpoint for an unknown tab', () => {
    expect(resolveSummaryEndpoint(config, 'unknown-tab')).toBe('summary.json');
  });
});
