// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const workboxRequire = createRequire(require.resolve('workbox-build'));
const resolverRequire = createRequire(workboxRequire.resolve('@rollup/plugin-node-resolve'));
const merge = resolverRequire('deepmerge');

describe('Build dependency merge security patch', () => {
  it('rejects dangerous keys from a null-prototype source and target', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const malicious = Object.assign(Object.create(null), { [key]: { polluted: true } });
      for (const result of [merge({}, malicious), merge(malicious, {})]) {
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(Object.prototype.hasOwnProperty.call(result, key)).toBe(false);
        expect(result.polluted).toBeUndefined();
      }
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('rejects nested JSON prototype poisoning', () => {
    const result = merge({ settings: {} }, JSON.parse('{"settings":{"__proto__":{"polluted":true},"safe":1}}'));
    expect(result.settings).toEqual({ safe: 1 });
    expect(Object.getPrototypeOf(result.settings)).toBe(Object.prototype);
  });
  it('retains cloning, arrays, symbols and custom merge behavior', () => {
    const symbol = Symbol('own');
    const target = { options: { a: 1 }, extensions: ['js'], [symbol]: true };
    const result = merge(target, { options: { b: 2 }, extensions: ['ts'] });
    expect(result.options).toEqual({ a: 1, b: 2 });
    expect(result.extensions).toEqual(['js', 'ts']);
    expect(result[symbol]).toBe(true);
    expect(result.options).not.toBe(target.options);
    expect(merge.all([{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 });
    expect(merge({ a: [1] }, { a: [2] }, { arrayMerge: (_a: unknown[], b: unknown[]) => b })).toEqual({ a: [2] });
  });
});
