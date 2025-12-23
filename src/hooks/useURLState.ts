/* eslint-disable react-hooks/set-state-in-effect -- This hook legitimately syncs with URL (external system) */
import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Hook for managing state that syncs with URL query parameters.
 * Removes the parameter when value equals defaultValue for cleaner URLs.
 * Re-validates and updates when paramName, defaultValue, or validValues change.
 *
 * @param paramName - URL query parameter name (e.g., 'tab', 'view')
 * @param defaultValue - Default value when parameter is absent from URL
 * @param validValues - Optional array of valid values for validation
 * @returns Tuple of [currentValue, setValue] for state management
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [tab, setTab] = useURLState('tab', 'home');
 *
 * // With validation
 * const [view, setView] = useURLState('view', 'grid', ['grid', 'list']);
 * ```
 */
export function useURLState(
  paramName: string,
  defaultValue: string,
  validValues?: string[]
): [string, (value: string) => void] {
  // Helper to get value from URL
  const getValueFromURL = useCallback(
    (param: string, defVal: string, valid?: string[]) => {
      const params = new URLSearchParams(window.location.search);
      const urlValue = params.get(param);
      if (urlValue && (!valid || valid.includes(urlValue))) {
        return urlValue;
      }
      return defVal;
    },
    []
  );

  // Initialize from URL or default
  const [value, setValue] = useState(() =>
    getValueFromURL(paramName, defaultValue, validValues)
  );

  // Track paramName to detect changes and reinitialize
  const [trackedParamName, setTrackedParamName] = useState(paramName);

  // Compute effective value: use fresh URL value when paramName changes
  const effectiveValue = useMemo(() => {
    if (trackedParamName === paramName) {
      return value;
    }
    // paramName changed - compute new value from URL
    return getValueFromURL(paramName, defaultValue, validValues);
  }, [paramName, defaultValue, validValues, value, trackedParamName, getValueFromURL]);

  // Re-initialize state when paramName changes (e.g., switching tabs)
  // This is a legitimate sync pattern - state must match the URL source of truth
  useEffect(() => {
    if (trackedParamName !== paramName) {
      setTrackedParamName(paramName);
      setValue(getValueFromURL(paramName, defaultValue, validValues));
    }
  }, [paramName, defaultValue, validValues, trackedParamName, getValueFromURL]);

  // Re-validate when validValues changes (e.g., data loads)
  // This is a legitimate sync pattern - ensuring state matches valid options
  useEffect(() => {
    if (validValues && validValues.length > 0) {
      // If current value is not valid, reset to default
      if (!validValues.includes(value)) {
        // Check URL first
        const params = new URLSearchParams(window.location.search);
        const urlValue = params.get(paramName);
        if (urlValue && validValues.includes(urlValue)) {
          setValue(urlValue);
        } else if (validValues.includes(defaultValue)) {
          setValue(defaultValue);
        } else {
          setValue(validValues[0]);
        }
      }
    }
  }, [validValues, paramName, defaultValue, value]);

  // Sync to URL when value changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (effectiveValue === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, effectiveValue);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [paramName, effectiveValue, defaultValue]);

  // Memoized setter
  const setValueWithValidation = useCallback(
    (newValue: string) => {
      // Only set if valid (or no validation required)
      if (!validValues || validValues.includes(newValue)) {
        setValue(newValue);
      }
    },
    [validValues]
  );

  return [effectiveValue, setValueWithValidation];
}
