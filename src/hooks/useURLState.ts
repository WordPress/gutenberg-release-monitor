import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Hook for managing state that syncs with URL query parameters.
 * Removes the parameter when value equals defaultValue for cleaner URLs.
 * Re-validates and updates when paramName, defaultValue, or validValues change.
 */
export function useURLState(
  paramName: string,
  defaultValue: string,
  validValues?: string[]
): [string, (value: string) => void] {
  // Track previous paramName to detect changes (e.g., tab switch)
  const prevParamName = useRef(paramName);

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

  // Compute the correct value synchronously when paramName changes
  // This prevents the "flash" of wrong data before the effect runs
  const effectiveValue = useMemo(() => {
    if (prevParamName.current === paramName) {
      return value;
    }
    // paramName changed - compute new value synchronously
    const params = new URLSearchParams(window.location.search);
    const urlValue = params.get(paramName);
    if (urlValue && (!validValues || validValues.includes(urlValue))) {
      return urlValue;
    }
    return defaultValue;
  }, [paramName, defaultValue, validValues, value]);

  // Re-initialize state when paramName changes (keeps state in sync)
  useEffect(() => {
    if (prevParamName.current !== paramName) {
      prevParamName.current = paramName;
      const params = new URLSearchParams(window.location.search);
      const urlValue = params.get(paramName);
      if (urlValue && (!validValues || validValues.includes(urlValue))) {
        setValue(urlValue);
      } else {
        setValue(defaultValue);
      }
    }
  }, [paramName, defaultValue, validValues]);

  // Re-validate when validValues changes (e.g., data loads)
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
          // Fallback to first valid value
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
