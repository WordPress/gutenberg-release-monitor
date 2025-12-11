import '@wordpress/components/build-style/style.css';
import {
  Card,
  CardBody,
  ExternalLink,
  Notice,
  Spinner,
  __experimentalText as Text,
  __experimentalHeading as Heading,
} from '@wordpress/components';
import { useReleases, useSummary, useWPVersionStats } from './hooks/useReleases';
import { ReleasesTable } from './components/ReleasesTable';
import { SummaryStats } from './components/SummaryStats';

function App() {
  const {
    data: releases,
    isLoading: releasesLoading,
    error: releasesError,
  } = useReleases();
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useSummary();
  const {
    data: wpVersionStats,
    isLoading: wpVersionStatsLoading,
    error: wpVersionStatsError,
  } = useWPVersionStats();

  const isLoading = releasesLoading || summaryLoading || wpVersionStatsLoading;
  const error = releasesError || summaryError || wpVersionStatsError;

  return (
    <div className="app">
      <header className="app-header">
        <Heading level={1}>Gutenberg Release Monitor</Heading>
        <Text>
          Track Gutenberg release statistics and changelog data
          <span className="header-separator">·</span>
          <ExternalLink href="https://github.com/WordPress/gutenberg">
            View Repository
          </ExternalLink>
        </Text>
      </header>

      {error && (
        <Notice status="error" isDismissible={false}>
          Failed to load data: {error.message}
        </Notice>
      )}

      {isLoading && (
        <div className="app-loading">
          <Spinner />
          <span>Loading releases...</span>
        </div>
      )}

      {!isLoading && !error && summary && wpVersionStats && (
        <SummaryStats summary={summary} wpVersionStats={wpVersionStats} />
      )}

      <main className="app-main">
        <Card>
          <CardBody>
            {!isLoading && !error && releases && (
              <ReleasesTable releases={releases} />
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

export default App;
