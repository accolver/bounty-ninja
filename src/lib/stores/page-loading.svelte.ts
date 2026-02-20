/**
 * Shared reactive signal for the full-page loading overlay.
 * Pages set this to true while their loading overlay is visible,
 * allowing the layout to hide the footer during loading.
 */
class PageLoadingState {
	#active = $state(false);
	/** When true, the navbar logo should be visible (fades in after loading overlay exits). */
	#navLogoVisible = $state(true);

	get active(): boolean {
		return this.#active;
	}

	set active(value: boolean) {
		this.#active = value;
		// When loading starts, hide the navbar logo so it can fade in later
		if (value) {
			this.#navLogoVisible = false;
		}
	}

	get navLogoVisible(): boolean {
		return this.#navLogoVisible;
	}

	/** Call after loading overlay has exited to trigger the navbar logo fade-in with a delay. */
	showNavLogo(delayMs = 1000): void {
		setTimeout(() => {
			this.#navLogoVisible = true;
		}, delayMs);
	}
}

export const pageLoading = new PageLoadingState();
