import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing state that syncs with URL query parameters.
 * Removes the parameter when value equals defaultValue for cleaner URLs.
 */
export function useURLState(
  paramName: string,
  defaultValue: string,
  validValues?: string[]
): [string, (value: string) => void] {
  // Initialize from URL or default
  const [value, setValue] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlValue = params.get(paramName);
    // Validate against valid values if provided
    if (urlValue && (!validValues || validValues.includes(urlValue))) {
      return urlValue;
    }
    return defaultValue;
  });

  // Sync to URL when value changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (value === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [paramName, value, defaultValue]);

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

  return [value, setValueWithValidation];
}
