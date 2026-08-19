import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetupCountdownPanel } from './SetupCountdownPanel';

describe('SetupCountdownPanel', () => {
  const defaultProps = {
    state: 'setup' as const,
    transcriptError: null,
    showMicRetry: false,
    handleRetryMicrophone: vi.fn(),
    timerLabel: 'Off',
    timerMenuOpen: false,
    setTimerMenuOpen: vi.fn(),
    selectedTimerSeconds: 0,
    setSelectedTimerSeconds: vi.fn(),
    timerOptions: [{ label: 'Off', seconds: 0 }],
    promptText: '',
    prompts: ['Prompt 1', 'Prompt 2'],
    onStart: vi.fn(),
    onOpenPrompts: vi.fn(),
    countdown: 3,
  };

  it('renders carousel with region role, aria-label, and tabIndex', () => {
    render(<SetupCountdownPanel {...defaultProps} />);

    const carousel = screen.getByRole('region', { name: /prompt carousel/i });
    expect(carousel).toBeInTheDocument();
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(carousel).toHaveAttribute('tabindex', '0');
  });

  it('sets aria-hidden on inactive slides', () => {
    const { container } = render(<SetupCountdownPanel {...defaultProps} />);

    const slides = container.querySelectorAll('[aria-hidden]');
    expect(slides.length).toBe(3); // free speak + 2 prompts
    expect(slides[0]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'true');
  });

  it('supports ArrowRight and ArrowLeft key navigation on carousel', () => {
    const { container } = render(<SetupCountdownPanel {...defaultProps} />);

    const carousel = screen.getByRole('region', { name: /prompt carousel/i });

    // Press ArrowRight -> moves to next slide
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    const slidesAfterRight = container.querySelectorAll('[aria-hidden]');
    expect(slidesAfterRight[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slidesAfterRight[1]).toHaveAttribute('aria-hidden', 'false');

    // Press ArrowLeft -> moves back to first slide
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    const slidesAfterLeft = container.querySelectorAll('[aria-hidden]');
    expect(slidesAfterLeft[0]).toHaveAttribute('aria-hidden', 'false');
  });

  it('renders countdown with aria-live="assertive" and aria-atomic="true"', () => {
    render(<SetupCountdownPanel {...defaultProps} state="countdown" countdown={3} />);

    const countdownNumber = screen.getByText('3');
    const countdownContainer = countdownNumber.parentElement;

    expect(countdownContainer).toHaveAttribute('aria-live', 'assertive');
    expect(countdownContainer).toHaveAttribute('aria-atomic', 'true');
  });
});
