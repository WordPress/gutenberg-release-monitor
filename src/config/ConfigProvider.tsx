/**
 * Configuration context provider and hooks.
 * Loads project-config.json and provides it to the component tree.
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
  const response = await fetch('data/project-config.json');
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
 * Hook to get the list of tab IDs from configuration.
 */
export function useTabIds(): string[] {
  const config = useConfig();
  return config.tabs.map((tab) => tab.id);
}

/**
 * Hook to get tabs formatted for TabPanel component.
 */
export function useTabPanelTabs(): Array<{ name: string; title: string }> {
  const config = useConfig();
  return config.tabs.map((tab) => ({
    name: tab.id,
    title: tab.title,
  }));
}
