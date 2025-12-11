import '@wordpress/components/build-style/style.css';
import {
  Button,
  Card,
  CardBody,
  ExternalLink,
  Notice,
  Spinner,
  TabPanel,
  __experimentalText as Text,
  __experimentalHeading as Heading,
} from '@wordpress/components';
import { useReleases, useSummary, useWPVersionStats } from './hooks/useReleases';
import { useDarkMode } from './hooks/useDarkMode';
import { ReleasesTable } from './components/ReleasesTable';
import { SummaryStats } from './components/SummaryStats';
import { WPVersionTable } from './components/WPVersionTable';

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

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
  const { isDark, toggle } = useDarkMode();

  const isLoading = releasesLoading || summaryLoading || wpVersionStatsLoading;
  const error = releasesError || summaryError || wpVersionStatsError;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <Heading level={1}>Gutenberg Release Monitor</Heading>
          <Button
            variant="tertiary"
            onClick={toggle}
            label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            icon={isDark ? SunIcon : MoonIcon}
          />
        </div>
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

      {!isLoading && !error && summary && wpVersionStats && releases && (
        <main className="app-main">
          <TabPanel
            className="app-tabs"
            tabs={[
              { name: 'by-wp-version', title: 'WordPress Releases' },
              { name: 'releases', title: 'Gutenberg Releases' },
            ]}
          >
            {(tab) => (
              <>
                {tab.name === 'by-wp-version' && (
                  <div className="tab-content">
                    <SummaryStats summary={summary} wpVersionStats={wpVersionStats} />
                    <Card className="wp-version-table-card">
                      <CardBody>
                        <WPVersionTable wpVersionStats={wpVersionStats} />
                      </CardBody>
                    </Card>
                  </div>
                )}
                {tab.name === 'releases' && (
                  <div className="tab-content">
                    <Card>
                      <CardBody>
                        <ReleasesTable releases={releases} />
                      </CardBody>
                    </Card>
                  </div>
                )}
              </>
            )}
          </TabPanel>
        </main>
      )}
    </div>
  );
}

export default App;
