import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { usePracticeState } from '@/pages/practice/usePracticeState';
import { usePromptLoader } from '@/pages/practice/usePromptLoader';

describe('usePromptLoader', () => {
  it('parses free-speaking route as free mode', () => {
    const { result } = renderHook(() => {
      const state = usePracticeState();
      return usePromptLoader(state);
    }, {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/practice/free-speaking']}>
          {children}
        </MemoryRouter>
      ),
    });

    expect(result.current.mode).toBe('free');
    expect(result.current.getModeTitle()).toBe('Free Speaking');
  });
});
