/**
 * Shared reactive state for the global search dialog.
 * Allows Header, MobileNav, and keyboard shortcuts to open/close the dialog.
 */
class SearchDialogState {
	#open = $state(false);

	get open(): boolean {
		return this.#open;
	}

	set open(value: boolean) {
		this.#open = value;
	}

	toggle() {
		this.#open = !this.#open;
	}
}

export const searchDialog = new SearchDialogState();
