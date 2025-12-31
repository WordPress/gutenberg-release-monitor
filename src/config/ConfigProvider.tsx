/**
 * Configuration context provider and hooks.
 * Loads config/project.json and provides it to the component tree.
 * @module config/ConfigProvider
 */

import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProjectConfig, TabConfig } from './types';

/**
 * Context for the project configuration.
 */
const ConfigContext = createContext<ProjectConfig | null>(null);

/**
 * Fetch the project configuration from the JSON file.
 */
async function fetchConfig(): Promise<ProjectConfig> {
  // Use relative path - resolves correctly from current page location
  const response = await fetch('config/project.json');
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status}`);
  }
  return response.json();
}

interface ConfigProviderProps {
  children: ReactNode;
}

/**
 * Provider component that loads and provides the project configuration.
 * Renders children only when config is loaded.
 */
export function ConfigProvider({ children }: ConfigProviderProps) {
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['project-config'],
    queryFn: fetchConfig,
    staleTime: Infinity, // Config doesn't change during a session
  });

  if (isLoading) {
    return null; // Let parent handle loading state
  }

  if (error || !config) {
    throw error || new Error('Failed to load configuration');
  }

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * Hook to access the full project configuration.
 *
 * @returns The complete ProjectConfig object
 * @throws Error if used outside of ConfigProvider
 */
export function useConfig(): ProjectConfig {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return config;
}

/**
 * Hook to access configuration for a specific tab.
 * @param tabId - The tab identifier
 * @returns TabConfig for the specified tab
 * @throws Error if tab is not found or used outside of ConfigProvider
 */
export function useTabConfig(tabId: string): TabConfig {
  const config = useConfig();
  const tabConfig = config.tabs.find((tab) => tab.id === tabId);
  if (!tabConfig) {
    throw new Error(`Tab "${tabId}" not found in configuration`);
  }
  return tabConfig;
}

/**
 * Get the set of tab IDs that should be visible based on URL params.
 * Hidden tabs are only visible if explicitly requested via ?tab=<tabId>.
 */
function getVisibleTabs(tabs: ProjectConfig['tabs']): ProjectConfig['tabs'] {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get('tab');

  return tabs.filter((tab) => {
    // Show non-hidden tabs always
    if (!tab.hidden) return true;
    // Show hidden tabs only if explicitly requested via URL
    return requestedTab === tab.id;
  });
}

/**
 * Hook to get the list of tab IDs from configuration.
 * Hidden tabs are excluded unless explicitly requested via URL.
 *
 * @returns Array of tab ID strings (e.g., `['by-wp-version', 'by-gb-release']`)
 */
export function useTabIds(): string[] {
  const config = useConfig();
  return getVisibleTabs(config.tabs).map((tab) => tab.id);
}

/**
 * Hook to get tabs formatted for @wordpress/components TabPanel.
 * Hidden tabs are excluded unless explicitly requested via URL.
 *
 * @returns Array of tab objects with `name` and `title` properties
 */
export function useTabPanelTabs(): Array<{ name: string; title: string }> {
  const config = useConfig();
  return getVisibleTabs(config.tabs).map((tab) => ({
    name: tab.id,
    title: tab.title,
  }));
}
