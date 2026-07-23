import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetupCountdownPanel } from './SetupCountdownPanel';

describe('SetupCountdownPanel keyboard navigation and accessibility', () => {
  const defaultProps = {
    state: 'setup' as const,
    transcriptError: null,
    showMicRetry: false,
    handleRetryMicrophone: vi.fn(),
    timerLabel: 'No timer',
    timerMenuOpen: false,
    setTimerMenuOpen: vi.fn(),
    selectedTimerSeconds: 0,
    setSelectedTimerSeconds: vi.fn(),
    timerOptions: [{ label: 'No timer', seconds: 0 }],
    promptText: '',
    prompts: ['Describe a beautiful place', 'Talk about your hobbies'],
    onStart: vi.fn(),
    onOpenPrompts: vi.fn(),
    countdown: 0,
  };

  it('renders with appropriate carousel region attributes and is focusable', () => {
    render(<SetupCountdownPanel {...defaultProps} />);

    const carousel = screen.getByRole('region', { name: 'Speaking prompt selector' });
    expect(carousel).toBeInTheDocument();
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(carousel).toHaveAttribute('tabIndex', '0');
  });

  it('sets aria-hidden correctly for active and inactive slides', () => {
    render(<SetupCountdownPanel {...defaultProps} />);

    // slides: ['__free__', 'Describe a beautiful place', 'Talk about your hobbies']
    // Active index is 0 by default when promptText is empty.
    const slides = screen.getAllByText(/Speaking Mode/i).map(el => el.closest('[aria-hidden]'));
    expect(slides).toHaveLength(3);

    expect(slides[0]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'true');
  });

  it('handles horizontal keyboard navigation with ArrowRight and ArrowLeft', () => {
    render(<SetupCountdownPanel {...defaultProps} />);

    const carousel = screen.getByRole('region', { name: 'Speaking prompt selector' });
    const slides = screen.getAllByText(/Speaking Mode/i).map(el => el.closest('[aria-hidden]'));

    // Move right -> active index 1
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'true');

    // Move right again -> active index 2
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'false');

    // Move right again -> stays at index 2 (boundary check)
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(slides[2]).toHaveAttribute('aria-hidden', 'false');

    // Move left -> active index 1
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'true');
  });
});
