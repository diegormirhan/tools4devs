import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useTheme } from './useTheme';

// The legacy stylesheet keys off data-theme; the shadcn tokens key off the .dark class.
// Both have to agree or half the window renders in the other theme.
it('marks the dark theme with both data-theme and the .dark class', () => {
  const { result } = renderHook(() => useTheme());

  act(() => result.current.setPreference('dark'));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);

  act(() => result.current.setPreference('light'));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
