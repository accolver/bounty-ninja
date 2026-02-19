/**
 * Shared reactive signal for the full-page loading overlay.
 * Pages set this to true while their loading overlay is visible,
 * allowing the layout to hide the footer during loading.
 */
class PageLoadingState {
	#active = $state(false);

	get active(): boolean {
		return this.#active;
	}

	set active(value: boolean) {
		this.#active = value;
	}
}

export const pageLoading = new PageLoadingState();
