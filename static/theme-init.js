(function () {
	try {
		// This key must match config.storagePrefix + ':theme'.
		var theme = localStorage.getItem('bounty.ninja:theme');
		var prefersLight =
			!theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
		if (theme === 'light' || prefersLight) {
			document.documentElement.classList.add('light');
			var meta = document.querySelector('meta[name="theme-color"]');
			if (meta) meta.setAttribute('content', '#EDEEE8');
		}
	} catch (_error) {
		// localStorage may be unavailable; dark remains the safe default.
	}
})();
