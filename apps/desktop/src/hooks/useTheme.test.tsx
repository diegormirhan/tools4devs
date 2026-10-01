import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useTheme } from './useTheme';

// The tokens key off the .dark class; the native parts (scrollbars, pickers) off color-scheme.
it('marks the dark theme with the .dark class and the colour scheme', () => {
  const { result } = renderHook(() => useTheme());

  act(() => result.current.setPreference('dark'));
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);

  act(() => result.current.setPreference('light'));
  expect(document.documentElement.style.colorScheme).toBe('light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
