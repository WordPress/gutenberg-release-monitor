import '@wordpress/components/build-style/style.css';
import { Spinner } from '@wordpress/components';
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
        <h1>Gutenberg Release Monitor</h1>
        <p>
          Track Gutenberg release statistics and changelog data
          <span className="header-separator">·</span>
          <a
            href="https://github.com/WordPress/gutenberg"
            target="_blank"
            rel="noopener noreferrer"
            className="header-link"
          >
            View Repository
          </a>
        </p>
      </header>

      {error && (
        <div className="app-error">
          Failed to load data: {error.message}
        </div>
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
        {!isLoading && !error && releases && (
          <ReleasesTable releases={releases} />
        )}
      </main>
    </div>
  );
}

export default App;
