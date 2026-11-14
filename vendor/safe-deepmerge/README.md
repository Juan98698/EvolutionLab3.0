# Temporary build dependency patch

This is the MIT-licensed CommonJS distribution of `deepmerge@4.3.1`, with a narrowly scoped fix for [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Upstream has no published patched release at the time of this change.

Changes to `mergeObject`:

- Drop `__proto__`, `constructor`, and `prototype` keys from both source and target.
- Define own data properties instead of invoking setters on the destination prototype.

The public merge API, cloning, arrays, symbols, and custom merge options are retained. Regression cases in `src/lib/__tests__/buildDependencySecurity.test.ts` exercise prototype poisoning and ordinary merges. The npm override is limited to this dependency; this package has no install scripts and is only consumed by build tooling through Workbox/Rollup.

Replace the override with the upstream fixed version when one is published, preserving the regression tests. This patch is explicitly vendored; an empty advisory report alone is not evidence of its correctness.

The root dev dependency resolves this directory and the override references `$deepmerge`. The committed `.npmrc` sets `install-links=true`, so npm packs the local source as a regular dependency instead of relying on a nested directory junction. Keep that configuration with the lockfile; it is required for the same clean-install layout in development and CI.
