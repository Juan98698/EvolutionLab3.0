// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from '../useRestTimer';

describe('useRestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial idle state', () => {
    const { result } = renderHook(() => useRestTimer());
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isFinished).toBe(false);
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.progress).toBe(0);
  });

  it('should start countdown when start is called', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => {
      result.current.start(90);
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.isFinished).toBe(false);
    expect(result.current.totalSeconds).toBe(90);
    expect(result.current.secondsLeft).toBe(90);
    expect(result.current.progress).toBe(1);
  });

  it('should decrement secondsLeft as time passes', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => {
      result.current.start(90);
    });

    act(() => {
      // Advance virtual time by 10 seconds (10000ms)
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.secondsLeft).toBe(80);
    expect(result.current.progress).toBe(80 / 90);
  });

  it('should finish when timer reaches zero and call onFinish callback', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useRestTimer(onFinish));

    act(() => {
      result.current.start(90);
    });

    act(() => {
      vi.advanceTimersByTime(90000);
    });

    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isFinished).toBe(true);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('should pause countdown when pause is called', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => {
      result.current.start(90);
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.secondsLeft).toBe(80);

    act(() => {
      result.current.pause();
    });

    expect(result.current.isRunning).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should remain 80 seconds
    expect(result.current.secondsLeft).toBe(80);
  });

  it('should resume countdown when resume is called', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => {
      result.current.start(90);
    });

    act(() => {
      vi.advanceTimersByTime(10000);
      result.current.pause();
    });

    expect(result.current.secondsLeft).toBe(80);

    act(() => {
      result.current.resume();
    });

    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.secondsLeft).toBe(70);
  });

  it('should reset state completely when reset is called', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => {
      result.current.start(90);
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.secondsLeft).toBe(80);

    act(() => {
      result.current.reset();
    });

    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.totalSeconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isFinished).toBe(false);
  });
});
