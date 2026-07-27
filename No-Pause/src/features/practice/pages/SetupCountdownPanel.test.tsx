import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupCountdownPanel } from './SetupCountdownPanel';

describe('SetupCountdownPanel keyboard navigation and accessibility', () => {
  const mockProps = {
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
    promptText: 'Specific Prompt Topic',
    prompts: ['First prompt', 'Second prompt'],
    onStart: vi.fn(),
    onOpenPrompts: vi.fn(),
    countdown: 3,
  };

  it('renders carousel with proper accessibility attributes', () => {
    render(<SetupCountdownPanel {...mockProps} />);

    const carousel = screen.getByRole('region', { name: 'Practice topics carousel' });
    expect(carousel).toBeInTheDocument();
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(carousel).toHaveAttribute('tabindex', '0');
  });

  it('navigates with ArrowRight and ArrowLeft keyboard events', () => {
    render(<SetupCountdownPanel {...mockProps} />);

    const carousel = screen.getByRole('region', { name: 'Practice topics carousel' });

    // In slides setup:
    // With promptText = 'Specific Prompt Topic', the slides are:
    // ['__free__', 'Specific Prompt Topic', 'First prompt', 'Second prompt']
    // Since promptText is truthy, activeIndex is initialized to 1 ('Specific Prompt Topic').

    // We expect 4 slides.
    // Slide index 1 should have aria-hidden="false", others "true"
    const slides = carousel.querySelectorAll('[aria-hidden]');
    expect(slides).toHaveLength(4);

    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[3]).toHaveAttribute('aria-hidden', 'true');

    // Press ArrowRight to move from index 1 to 2
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[3]).toHaveAttribute('aria-hidden', 'true');

    // Press ArrowRight to move from index 2 to 3
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(slides[3]).toHaveAttribute('aria-hidden', 'false');

    // Press ArrowRight at the boundary (should not go beyond index 3)
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(slides[3]).toHaveAttribute('aria-hidden', 'false');

    // Press ArrowLeft to move back to index 2
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(slides[2]).toHaveAttribute('aria-hidden', 'false');

    // Press ArrowLeft to move to index 1
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');

    // Press ArrowLeft to move to index 0 (Speak freely)
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(slides[0]).toHaveAttribute('aria-hidden', 'false');

    // Press ArrowLeft at the boundary (should stay at index 0)
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(slides[0]).toHaveAttribute('aria-hidden', 'false');
  });
});
