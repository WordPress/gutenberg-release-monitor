import '@wordpress/components/build-style/style.css';
import { Spinner } from '@wordpress/components';
import { useReleases, useSummary } from './hooks/useReleases';
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

  const isLoading = releasesLoading || summaryLoading;
  const error = releasesError || summaryError;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Gutenberg Release Monitor</h1>
        <p>Track Gutenberg release statistics and changelog data</p>
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

      {!isLoading && !error && summary && (
        <SummaryStats summary={summary} />
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
