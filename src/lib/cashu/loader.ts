/**
 * Dynamic import wrapper for @cashu/cashu-ts.
 * Enables code-splitting so the Cashu library is only loaded when needed,
 * reducing initial bundle size.
 */

let cachedModule: typeof import('@cashu/cashu-ts') | null = null;

/**
 * Lazily load the @cashu/cashu-ts module.
 * The module is cached after the first import so subsequent calls are synchronous.
 *
 * @returns The full @cashu/cashu-ts module
 */
export async function loadCashuModule(): Promise<typeof import('@cashu/cashu-ts')> {
	if (cachedModule) return cachedModule;
	cachedModule = await import('@cashu/cashu-ts');
	return cachedModule;
}
