/**
 * Lazy-loading wrapper for @cashu/cashu-ts.
 *
 * Dynamically imports the Cashu library on first use and caches the module
 * reference for subsequent calls. This keeps @cashu/cashu-ts out of the
 * initial JavaScript bundle, reducing First Contentful Paint and Time to
 * Interactive for users who never interact with Cashu features.
 *
 * Usage:
 *   const { getDecodedToken } = await getCashu();
 *   const decoded = getDecodedToken(tokenStr);
 */

/** Cached module reference. Populated on first call to getCashu(). */
let cachedModule: typeof import('@cashu/cashu-ts') | null = null;

/** In-flight import promise to prevent duplicate imports during concurrent calls. */
let loadingPromise: Promise<typeof import('@cashu/cashu-ts')> | null = null;

/**
 * Lazily load and cache the @cashu/cashu-ts module.
 *
 * - First call triggers a dynamic `import()` and caches the result.
 * - Concurrent calls during the initial load share the same promise.
 * - Subsequent calls return the cached module synchronously (wrapped in a resolved promise).
 *
 * @returns The full @cashu/cashu-ts module namespace.
 */
export async function getCashu(): Promise<typeof import('@cashu/cashu-ts')> {
	if (cachedModule) return cachedModule;

	if (!loadingPromise) {
		loadingPromise = import('@cashu/cashu-ts').then((mod) => {
			cachedModule = mod;
			loadingPromise = null;
			return mod;
		});
	}

	return loadingPromise;
}

/**
 * Check whether the Cashu module has already been loaded.
 *
 * Useful for conditional synchronous paths or diagnostics.
 * Returns false until getCashu() has resolved at least once.
 */
export function isCashuLoaded(): boolean {
	return cachedModule !== null;
}

/**
 * Reset the cached module (for testing only).
 *
 * @internal
 */
export function _resetCashuCache(): void {
	cachedModule = null;
	loadingPromise = null;
}
