import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetupCountdownPanel } from './SetupCountdownPanel';

describe('SetupCountdownPanel keyboard and accessibility', () => {
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
    prompts: ['Prompt 1', 'Prompt 2'],
    onStart: vi.fn(),
    onOpenPrompts: vi.fn(),
    countdown: 3,
  };

  it('renders carousel with ARIA attributes and keyboard support', () => {
    render(<SetupCountdownPanel {...defaultProps} />);

    const carousel = screen.getByRole('region', { name: /practice prompt carousel/i });
    expect(carousel).toBeInTheDocument();
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(carousel).toHaveAttribute('tabIndex', '0');
  });

  it('navigates prompts using ArrowRight and ArrowLeft keys', () => {
    const onStart = vi.fn();
    render(<SetupCountdownPanel {...defaultProps} onStart={onStart} />);

    const carousel = screen.getByRole('region', { name: /practice prompt carousel/i });

    // Press ArrowRight to move to Prompt 1
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });

    // Click Start Speaking button to verify active slide selection
    const startButton = screen.getByRole('button', { name: /start speaking/i });
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenCalledWith({
      type: 'prompt',
      text: 'Prompt 1',
    });

    // Press ArrowLeft to move back to Speak freely (slide 0)
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenLastCalledWith({
      type: 'free',
    });
  });
});
