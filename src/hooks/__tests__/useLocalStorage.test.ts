// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return initial value if storage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-val'));
    const [value] = result.current;
    expect(value).toBe('default-val');
  });

  it('should return cached value if storage has item', () => {
    localStorage.setItem('test-key', JSON.stringify('cached-val'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-val'));
    const [value] = result.current;
    expect(value).toBe('cached-val');
  });

  it('should update storage and state when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-val'));
    const [, setValue] = result.current;

    act(() => {
      setValue('new-val');
    });

    const [value] = result.current;
    expect(value).toBe('new-val');
    expect(JSON.parse(localStorage.getItem('test-key') || '')).toBe('new-val');
  });

  it('should accept a functional updater in setValue', () => {
    const { result } = renderHook(() => useLocalStorage<number>('counter-key', 10));
    const [, setValue] = result.current;

    act(() => {
      setValue((prev) => prev + 5);
    });

    const [value] = result.current;
    expect(value).toBe(15);
    expect(JSON.parse(localStorage.getItem('counter-key') || '')).toBe(15);
  });

  it('should remove value and reset to default when removeValue is called', () => {
    localStorage.setItem('test-key', JSON.stringify('cached-val'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-val'));
    const [, , removeValue] = result.current;

    act(() => {
      removeValue();
    });

    const [value] = result.current;
    expect(value).toBe('default-val');
    expect(localStorage.getItem('test-key')).toBeNull();
  });
});
