<svelte:head><title>Bounty.ninja — Logo Picker</title></svelte:head>

<h1>🥷 Bounty.ninja Logo Candidates</h1>
<p class="sub">Tap a card to select. Each shows icon at multiple sizes + wordmark.</p>

<div class="grid">
	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">A — Shuriken</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M32 4 L36 28 L60 32 L36 36 L32 60 L28 36 L4 32 L28 28 Z" fill="#6B9E7E" />
					<circle cx="32" cy="32" r="6" fill="#C49A3C" />
					<circle cx="32" cy="32" r="3" fill="#0e1215" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M32 4 L36 28 L60 32 L36 36 L32 60 L28 36 L4 32 L28 28 Z" fill="#4a7a5c" />
					<circle cx="32" cy="32" r="6" fill="#b8892e" />
					<circle cx="32" cy="32" r="3" fill="#f5f5f0" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			4-pointed throwing star. Bitcoin gold center. Clean, geometric, very "ninja".
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">B — Crosshair Target (current)</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="32" r="24" stroke="#6B9E7E" stroke-width="3" fill="none" />
					<circle cx="32" cy="32" r="14" stroke="#6B9E7E" stroke-width="2" fill="none" />
					<circle cx="32" cy="32" r="5" fill="#C49A3C" />
					<line
						x1="32"
						y1="4"
						x2="32"
						y2="18"
						stroke="#6B9E7E"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="46"
						x2="32"
						y2="60"
						stroke="#6B9E7E"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<line
						x1="4"
						y1="32"
						x2="18"
						y2="32"
						stroke="#6B9E7E"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<line
						x1="46"
						y1="32"
						x2="60"
						y2="32"
						stroke="#6B9E7E"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="32" r="24" stroke="#4a7a5c" stroke-width="3" fill="none" />
					<circle cx="32" cy="32" r="14" stroke="#4a7a5c" stroke-width="2" fill="none" />
					<circle cx="32" cy="32" r="5" fill="#b8892e" />
					<line
						x1="32"
						y1="4"
						x2="32"
						y2="18"
						stroke="#4a7a5c"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="46"
						x2="32"
						y2="60"
						stroke="#4a7a5c"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<line
						x1="4"
						y1="32"
						x2="18"
						y2="32"
						stroke="#4a7a5c"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<line
						x1="46"
						y1="32"
						x2="60"
						y2="32"
						stroke="#4a7a5c"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Current favicon refined. Bounty hunter crosshair. Recognizable, works small.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">C — Ninja Mask</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<ellipse cx="32" cy="34" rx="22" ry="14" fill="#2a3a30" />
					<rect x="8" y="28" width="48" height="10" rx="5" fill="#6B9E7E" />
					<ellipse cx="22" cy="33" rx="5" ry="3.5" fill="#C49A3C" />
					<ellipse cx="42" cy="33" rx="5" ry="3.5" fill="#C49A3C" />
					<ellipse cx="22" cy="33" rx="2.5" ry="2" fill="#0e1215" />
					<ellipse cx="42" cy="33" rx="2.5" ry="2" fill="#0e1215" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<ellipse cx="32" cy="34" rx="22" ry="14" fill="#d4ddd7" />
					<rect x="8" y="28" width="48" height="10" rx="5" fill="#4a7a5c" />
					<ellipse cx="22" cy="33" rx="5" ry="3.5" fill="#b8892e" />
					<ellipse cx="42" cy="33" rx="5" ry="3.5" fill="#b8892e" />
					<ellipse cx="22" cy="33" rx="2.5" ry="2" fill="#f5f5f0" />
					<ellipse cx="42" cy="33" rx="2.5" ry="2" fill="#f5f5f0" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Ninja eyes peering through mask. Playful but recognizable. Gold eyes = bitcoin.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">D — Bitcoin Shuriken</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M32 2 L38 26 L62 32 L38 38 L32 62 L26 38 L2 32 L26 26 Z"
						fill="none"
						stroke="#6B9E7E"
						stroke-width="2"
					/>
					<circle cx="32" cy="32" r="12" fill="#C49A3C" />
					<text
						x="32"
						y="38"
						text-anchor="middle"
						font-family="system-ui"
						font-size="18"
						font-weight="700"
						fill="#0e1215">₿</text
					>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M32 2 L38 26 L62 32 L38 38 L32 62 L26 38 L2 32 L26 26 Z"
						fill="none"
						stroke="#4a7a5c"
						stroke-width="2"
					/>
					<circle cx="32" cy="32" r="12" fill="#b8892e" />
					<text
						x="32"
						y="38"
						text-anchor="middle"
						font-family="system-ui"
						font-size="18"
						font-weight="700"
						fill="#f5f5f0">₿</text
					>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Shuriken outline with bitcoin symbol center. Merges both brand concepts directly.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">E — Slash Mark</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<line
						x1="16"
						y1="52"
						x2="48"
						y2="12"
						stroke="#6B9E7E"
						stroke-width="8"
						stroke-linecap="round"
					/>
					<line
						x1="8"
						y1="44"
						x2="28"
						y2="16"
						stroke="#C49A3C"
						stroke-width="4"
						stroke-linecap="round"
					/>
					<line
						x1="36"
						y1="48"
						x2="56"
						y2="20"
						stroke="#C49A3C"
						stroke-width="4"
						stroke-linecap="round"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<line
						x1="16"
						y1="52"
						x2="48"
						y2="12"
						stroke="#4a7a5c"
						stroke-width="8"
						stroke-linecap="round"
					/>
					<line
						x1="8"
						y1="44"
						x2="28"
						y2="16"
						stroke="#b8892e"
						stroke-width="4"
						stroke-linecap="round"
					/>
					<line
						x1="36"
						y1="48"
						x2="56"
						y2="20"
						stroke="#b8892e"
						stroke-width="4"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Three diagonal slash marks. Aggressive, minimal, ninja claw marks. Very fast read.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">F — Katana Coin</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<line
						x1="12"
						y1="52"
						x2="52"
						y2="12"
						stroke="#6B9E7E"
						stroke-width="3"
						stroke-linecap="round"
					/>
					<rect
						x="8"
						y="48"
						width="12"
						height="4"
						rx="2"
						fill="#6B9E7E"
						transform="rotate(-45 14 50)"
					/>
					<circle cx="38" cy="38" r="14" fill="none" stroke="#C49A3C" stroke-width="2.5" />
					<text
						x="38"
						y="44"
						text-anchor="middle"
						font-family="system-ui"
						font-size="16"
						font-weight="700"
						fill="#C49A3C">₿</text
					>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<line
						x1="12"
						y1="52"
						x2="52"
						y2="12"
						stroke="#4a7a5c"
						stroke-width="3"
						stroke-linecap="round"
					/>
					<rect
						x="8"
						y="48"
						width="12"
						height="4"
						rx="2"
						fill="#4a7a5c"
						transform="rotate(-45 14 50)"
					/>
					<circle cx="38" cy="38" r="14" fill="none" stroke="#b8892e" stroke-width="2.5" />
					<text
						x="38"
						y="44"
						text-anchor="middle"
						font-family="system-ui"
						font-size="16"
						font-weight="700"
						fill="#b8892e">₿</text
					>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">Katana blade cutting through a bitcoin coin. Ninja + bounty in one mark.</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">G — Hex Badge</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<polygon
						points="32,4 56,18 56,46 32,60 8,46 8,18"
						fill="none"
						stroke="#6B9E7E"
						stroke-width="2.5"
					/>
					<polygon
						points="32,14 46,22 46,42 32,50 18,42 18,22"
						fill="none"
						stroke="#6B9E7E"
						stroke-width="1.5"
					/>
					<circle cx="32" cy="32" r="6" fill="#C49A3C" />
					<text
						x="32"
						y="36.5"
						text-anchor="middle"
						font-family="system-ui"
						font-size="10"
						font-weight="700"
						fill="#0e1215">₿</text
					>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<polygon
						points="32,4 56,18 56,46 32,60 8,46 8,18"
						fill="none"
						stroke="#4a7a5c"
						stroke-width="2.5"
					/>
					<polygon
						points="32,14 46,22 46,42 32,50 18,42 18,22"
						fill="none"
						stroke="#4a7a5c"
						stroke-width="1.5"
					/>
					<circle cx="32" cy="32" r="6" fill="#b8892e" />
					<text
						x="32"
						y="36.5"
						text-anchor="middle"
						font-family="system-ui"
						font-size="10"
						font-weight="700"
						fill="#f5f5f0">₿</text
					>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Double hex frame (bounty badge/shield vibe) with bitcoin center. Authoritative.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">H — Dot Ninja</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="32" r="26" fill="#6B9E7E" />
					<circle cx="32" cy="32" r="22" fill="#0e1215" />
					<circle cx="32" cy="32" r="4" fill="#C49A3C" />
					<path d="M32 10 L35 28 L32 32 L29 28 Z" fill="#6B9E7E" />
					<path d="M54 32 L36 35 L32 32 L36 29 Z" fill="#6B9E7E" />
					<path d="M32 54 L29 36 L32 32 L35 36 Z" fill="#6B9E7E" />
					<path d="M10 32 L28 29 L32 32 L28 35 Z" fill="#6B9E7E" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="32" r="26" fill="#4a7a5c" />
					<circle cx="32" cy="32" r="22" fill="#f5f5f0" />
					<circle cx="32" cy="32" r="4" fill="#b8892e" />
					<path d="M32 10 L35 28 L32 32 L29 28 Z" fill="#4a7a5c" />
					<path d="M54 32 L36 35 L32 32 L36 29 Z" fill="#4a7a5c" />
					<path d="M32 54 L29 36 L32 32 L35 36 Z" fill="#4a7a5c" />
					<path d="M10 32 L28 29 L32 32 L28 35 Z" fill="#4a7a5c" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Compass rose / shuriken hybrid inside a circle. The "dot" in bounty.ninja. Works great as app
			icon.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">I — Minimal N</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M16 48 L16 16 L48 48 L48 16"
						stroke="#6B9E7E"
						stroke-width="5"
						stroke-linecap="round"
						stroke-linejoin="round"
						fill="none"
					/>
					<circle cx="48" cy="16" r="4" fill="#C49A3C" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M16 48 L16 16 L48 48 L48 16"
						stroke="#4a7a5c"
						stroke-width="5"
						stroke-linecap="round"
						stroke-linejoin="round"
						fill="none"
					/>
					<circle cx="48" cy="16" r="4" fill="#b8892e" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Lettermark "N" with gold accent dot. Ultra minimal. Reads fast at any size.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">J — Kunai</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M32 6 L40 30 L32 36 L24 30 Z" fill="#6B9E7E" />
					<line
						x1="32"
						y1="36"
						x2="32"
						y2="52"
						stroke="#6B9E7E"
						stroke-width="3"
						stroke-linecap="round"
					/>
					<circle cx="32" cy="56" r="4" fill="none" stroke="#C49A3C" stroke-width="2" />
					<circle cx="32" cy="22" r="3" fill="#C49A3C" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M32 6 L40 30 L32 36 L24 30 Z" fill="#4a7a5c" />
					<line
						x1="32"
						y1="36"
						x2="32"
						y2="52"
						stroke="#4a7a5c"
						stroke-width="3"
						stroke-linecap="round"
					/>
					<circle cx="32" cy="56" r="4" fill="none" stroke="#b8892e" stroke-width="2" />
					<circle cx="32" cy="22" r="3" fill="#b8892e" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Kunai throwing knife. Classic ninja weapon. Gold coin on blade tip. Vertical, distinctive.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">K — Stacked BN</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<rect
						x="6"
						y="6"
						width="52"
						height="52"
						rx="10"
						fill="none"
						stroke="#6B9E7E"
						stroke-width="2.5"
					/>
					<text
						x="32"
						y="30"
						text-anchor="middle"
						font-family="system-ui"
						font-size="20"
						font-weight="800"
						fill="#6B9E7E">B</text
					>
					<text
						x="32"
						y="52"
						text-anchor="middle"
						font-family="system-ui"
						font-size="20"
						font-weight="800"
						fill="#C49A3C">N</text
					>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<rect
						x="6"
						y="6"
						width="52"
						height="52"
						rx="10"
						fill="none"
						stroke="#4a7a5c"
						stroke-width="2.5"
					/>
					<text
						x="32"
						y="30"
						text-anchor="middle"
						font-family="system-ui"
						font-size="20"
						font-weight="800"
						fill="#4a7a5c">B</text
					>
					<text
						x="32"
						y="52"
						text-anchor="middle"
						font-family="system-ui"
						font-size="20"
						font-weight="800"
						fill="#b8892e">N</text
					>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Monogram "BN" stacked in rounded square. App icon friendly. Clean typography.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">L — Smoke Ring</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle
						cx="32"
						cy="32"
						r="24"
						stroke="#6B9E7E"
						stroke-width="3"
						stroke-dasharray="8 4"
						fill="none"
					/>
					<circle
						cx="32"
						cy="32"
						r="15"
						stroke="#6B9E7E"
						stroke-width="2"
						stroke-dasharray="5 3"
						fill="none"
						opacity="0.6"
					/>
					<circle cx="32" cy="32" r="5" fill="#C49A3C" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle
						cx="32"
						cy="32"
						r="24"
						stroke="#4a7a5c"
						stroke-width="3"
						stroke-dasharray="8 4"
						fill="none"
					/>
					<circle
						cx="32"
						cy="32"
						r="15"
						stroke="#4a7a5c"
						stroke-width="2"
						stroke-dasharray="5 3"
						fill="none"
						opacity="0.6"
					/>
					<circle cx="32" cy="32" r="5" fill="#b8892e" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Dashed concentric circles — ninja smoke bomb / vanishing. Mysterious, ethereal.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">M — Dual Kunai</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M24 8 L30 28 L24 34 L18 28 Z" fill="#6B9E7E" />
					<line
						x1="24"
						y1="34"
						x2="24"
						y2="48"
						stroke="#6B9E7E"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<circle cx="24" cy="52" r="3.5" fill="none" stroke="#C49A3C" stroke-width="2" />
					<path d="M40 14 L46 34 L40 40 L34 34 Z" fill="#C49A3C" />
					<line
						x1="40"
						y1="40"
						x2="40"
						y2="54"
						stroke="#C49A3C"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<circle cx="40" cy="58" r="3.5" fill="none" stroke="#6B9E7E" stroke-width="2" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M24 8 L30 28 L24 34 L18 28 Z" fill="#4a7a5c" />
					<line
						x1="24"
						y1="34"
						x2="24"
						y2="48"
						stroke="#4a7a5c"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<circle cx="24" cy="52" r="3.5" fill="none" stroke="#b8892e" stroke-width="2" />
					<path d="M40 14 L46 34 L40 40 L34 34 Z" fill="#b8892e" />
					<line
						x1="40"
						y1="40"
						x2="40"
						y2="54"
						stroke="#b8892e"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<circle cx="40" cy="58" r="3.5" fill="none" stroke="#4a7a5c" stroke-width="2" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Two kunai at different angles. Dynamic, suggests action. Dual-tone green + gold.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">N — Kunai Cross</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<g transform="rotate(-30 32 32)">
						<path d="M32 4 L38 26 L32 32 L26 26 Z" fill="#6B9E7E" />
						<line
							x1="32"
							y1="32"
							x2="32"
							y2="56"
							stroke="#6B9E7E"
							stroke-width="2.5"
							stroke-linecap="round"
						/>
						<circle cx="32" cy="59" r="3" fill="none" stroke="#6B9E7E" stroke-width="1.5" />
					</g>
					<g transform="rotate(30 32 32)">
						<path d="M32 4 L38 26 L32 32 L26 26 Z" fill="#C49A3C" />
						<line
							x1="32"
							y1="32"
							x2="32"
							y2="56"
							stroke="#C49A3C"
							stroke-width="2.5"
							stroke-linecap="round"
						/>
						<circle cx="32" cy="59" r="3" fill="none" stroke="#C49A3C" stroke-width="1.5" />
					</g>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<g transform="rotate(-30 32 32)">
						<path d="M32 4 L38 26 L32 32 L26 26 Z" fill="#4a7a5c" />
						<line
							x1="32"
							y1="32"
							x2="32"
							y2="56"
							stroke="#4a7a5c"
							stroke-width="2.5"
							stroke-linecap="round"
						/>
						<circle cx="32" cy="59" r="3" fill="none" stroke="#4a7a5c" stroke-width="1.5" />
					</g>
					<g transform="rotate(30 32 32)">
						<path d="M32 4 L38 26 L32 32 L26 26 Z" fill="#b8892e" />
						<line
							x1="32"
							y1="32"
							x2="32"
							y2="56"
							stroke="#b8892e"
							stroke-width="2.5"
							stroke-linecap="round"
						/>
						<circle cx="32" cy="59" r="3" fill="none" stroke="#b8892e" stroke-width="1.5" />
					</g>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Two kunai crossed. Classic emblem style. Green + gold blades overlapping.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">O — Mando Helmet</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<!-- Helmet outer shape -->
					<path
						d="M12 28 C12 16 20 6 32 6 C44 6 52 16 52 28 L52 42 C52 46 50 48 48 50 L42 54 L38 54 L36 48 L28 48 L26 54 L22 54 L16 50 C14 48 12 46 12 42 Z"
						fill="#6B9E7E"
					/>
					<!-- Visor -->
					<path
						d="M16 26 L32 30 L48 26 L48 34 C48 36 46 38 44 38 L20 38 C18 38 16 36 16 34 Z"
						fill="#C49A3C"
					/>
					<!-- Center line -->
					<line x1="32" y1="6" x2="32" y2="26" stroke="#4a7a5c" stroke-width="2" />
					<!-- Cheek vents -->
					<line
						x1="18"
						y1="42"
						x2="24"
						y2="42"
						stroke="#4a7a5c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="40"
						y1="42"
						x2="46"
						y2="42"
						stroke="#4a7a5c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="18"
						y1="45"
						x2="23"
						y2="45"
						stroke="#4a7a5c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="41"
						y1="45"
						x2="46"
						y2="45"
						stroke="#4a7a5c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M12 28 C12 16 20 6 32 6 C44 6 52 16 52 28 L52 42 C52 46 50 48 48 50 L42 54 L38 54 L36 48 L28 48 L26 54 L22 54 L16 50 C14 48 12 46 12 42 Z"
						fill="#4a7a5c"
					/>
					<path
						d="M16 26 L32 30 L48 26 L48 34 C48 36 46 38 44 38 L20 38 C18 38 16 36 16 34 Z"
						fill="#b8892e"
					/>
					<line x1="32" y1="6" x2="32" y2="26" stroke="#3a6a4c" stroke-width="2" />
					<line
						x1="18"
						y1="42"
						x2="24"
						y2="42"
						stroke="#3a6a4c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="40"
						y1="42"
						x2="46"
						y2="42"
						stroke="#3a6a4c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="18"
						y1="45"
						x2="23"
						y2="45"
						stroke="#3a6a4c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="41"
						y1="45"
						x2="46"
						y2="45"
						stroke="#3a6a4c"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Mandalorian-style bounty hunter helmet. T-visor in gold. "This is the way."
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">P — Mando Minimal</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<!-- Simplified helmet silhouette -->
					<path
						d="M14 24 C14 14 22 6 32 6 C42 6 50 14 50 24 L50 44 L44 52 L36 52 L34 46 L30 46 L28 52 L20 52 L14 44 Z"
						stroke="#6B9E7E"
						stroke-width="2.5"
						fill="none"
					/>
					<!-- T-visor only -->
					<path d="M18 28 L46 28" stroke="#C49A3C" stroke-width="3" stroke-linecap="round" />
					<line
						x1="32"
						y1="28"
						x2="32"
						y2="40"
						stroke="#C49A3C"
						stroke-width="3"
						stroke-linecap="round"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M14 24 C14 14 22 6 32 6 C42 6 50 14 50 24 L50 44 L44 52 L36 52 L34 46 L30 46 L28 52 L20 52 L14 44 Z"
						stroke="#4a7a5c"
						stroke-width="2.5"
						fill="none"
					/>
					<path d="M18 28 L46 28" stroke="#b8892e" stroke-width="3" stroke-linecap="round" />
					<line
						x1="32"
						y1="28"
						x2="32"
						y2="40"
						stroke="#b8892e"
						stroke-width="3"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Line-art Mando helmet with gold T-visor. Minimal, works tiny. Pure bounty hunter energy.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">Q — Ninja Head</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<!-- Head wrap -->
					<circle cx="32" cy="30" r="20" fill="#6B9E7E" />
					<!-- Face opening -->
					<path d="M16 26 Q32 22 48 26 L48 34 Q32 38 16 34 Z" fill="#0e1215" />
					<!-- Eyes -->
					<ellipse cx="24" cy="30" rx="3.5" ry="2.5" fill="#C49A3C" />
					<ellipse cx="40" cy="30" rx="3.5" ry="2.5" fill="#C49A3C" />
					<!-- Wrap tail -->
					<path
						d="M48 24 Q56 28 54 40 Q52 48 46 52"
						stroke="#6B9E7E"
						stroke-width="4"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="30" r="20" fill="#4a7a5c" />
					<path d="M16 26 Q32 22 48 26 L48 34 Q32 38 16 34 Z" fill="#f5f5f0" />
					<ellipse cx="24" cy="30" rx="3.5" ry="2.5" fill="#b8892e" />
					<ellipse cx="40" cy="30" rx="3.5" ry="2.5" fill="#b8892e" />
					<path
						d="M48 24 Q56 28 54 40 Q52 48 46 52"
						stroke="#4a7a5c"
						stroke-width="4"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Classic ninja head with wrap and trailing cloth. Gold eyes. Iconic, friendly but sharp.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">R — Ninja Silhouette</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<!-- Minimal head outline -->
					<path
						d="M16 22 C16 12 22 6 32 6 C42 6 48 12 48 22 L48 36 C48 44 42 50 32 50 C22 50 16 44 16 36 Z"
						stroke="#6B9E7E"
						stroke-width="2.5"
						fill="none"
					/>
					<!-- Eye band -->
					<rect x="14" y="24" width="36" height="8" rx="4" fill="#6B9E7E" />
					<!-- Eyes cut out -->
					<ellipse cx="25" cy="28" rx="4" ry="2.5" fill="#C49A3C" />
					<ellipse cx="39" cy="28" rx="4" ry="2.5" fill="#C49A3C" />
					<!-- Wrap tail -->
					<path
						d="M46 22 C52 24 56 32 52 42"
						stroke="#6B9E7E"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M16 22 C16 12 22 6 32 6 C42 6 48 12 48 22 L48 36 C48 44 42 50 32 50 C22 50 16 44 16 36 Z"
						stroke="#4a7a5c"
						stroke-width="2.5"
						fill="none"
					/>
					<rect x="14" y="24" width="36" height="8" rx="4" fill="#4a7a5c" />
					<ellipse cx="25" cy="28" rx="4" ry="2.5" fill="#b8892e" />
					<ellipse cx="39" cy="28" rx="4" ry="2.5" fill="#b8892e" />
					<path
						d="M46 22 C52 24 56 32 52 42"
						stroke="#4a7a5c"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Line-art ninja face with mask band and trailing wrap. Clean, works at any size.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">S — Hunter Visor</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<!-- Helmet shape -->
					<path
						d="M10 30 C10 14 20 6 32 6 C44 6 54 14 54 30 L54 38 L50 46 L42 50 L22 50 L14 46 L10 38 Z"
						fill="#2a3a30"
					/>
					<!-- Angular visor -->
					<path d="M14 26 L32 32 L50 26 L50 32 L32 38 L14 32 Z" fill="#C49A3C" />
					<!-- Antenna -->
					<line
						x1="14"
						y1="14"
						x2="14"
						y2="26"
						stroke="#6B9E7E"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<circle cx="14" cy="12" r="2" fill="#6B9E7E" />
					<!-- Helmet edge highlight -->
					<path
						d="M10 30 C10 14 20 6 32 6 C44 6 54 14 54 30"
						stroke="#6B9E7E"
						stroke-width="2"
						fill="none"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M10 30 C10 14 20 6 32 6 C44 6 54 14 54 30 L54 38 L50 46 L42 50 L22 50 L14 46 L10 38 Z"
						fill="#d4ddd7"
					/>
					<path d="M14 26 L32 32 L50 26 L50 32 L32 38 L14 32 Z" fill="#b8892e" />
					<line
						x1="14"
						y1="14"
						x2="14"
						y2="26"
						stroke="#4a7a5c"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<circle cx="14" cy="12" r="2" fill="#4a7a5c" />
					<path
						d="M10 30 C10 14 20 6 32 6 C44 6 54 14 54 30"
						stroke="#4a7a5c"
						stroke-width="2"
						fill="none"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Boba Fett-inspired helmet with angular visor and rangefinder antenna. Full bounty hunter.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">T — Kunai Outline</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M32 6 L42 30 L32 38 L22 30 Z" stroke="#6B9E7E" stroke-width="2.5" fill="none" />
					<line
						x1="32"
						y1="38"
						x2="32"
						y2="52"
						stroke="#6B9E7E"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<circle cx="32" cy="56" r="4" fill="none" stroke="#C49A3C" stroke-width="2" />
					<line
						x1="26"
						y1="30"
						x2="38"
						y2="30"
						stroke="#C49A3C"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M32 6 L42 30 L32 38 L22 30 Z" stroke="#4a7a5c" stroke-width="2.5" fill="none" />
					<line
						x1="32"
						y1="38"
						x2="32"
						y2="52"
						stroke="#4a7a5c"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<circle cx="32" cy="56" r="4" fill="none" stroke="#b8892e" stroke-width="2" />
					<line
						x1="26"
						y1="30"
						x2="38"
						y2="30"
						stroke="#b8892e"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Line-art kunai with gold guard and ring. Clean, minimal, scales perfectly.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">U — Hooded Figure</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<!-- Hood -->
					<path
						d="M12 48 L18 20 C20 10 26 6 32 6 C38 6 44 10 46 20 L52 48"
						stroke="#6B9E7E"
						stroke-width="2.5"
						fill="none"
						stroke-linecap="round"
					/>
					<!-- Face shadow -->
					<path
						d="M20 28 C20 24 25 20 32 20 C39 20 44 24 44 28 L44 36 C44 40 39 44 32 44 C25 44 20 40 20 36 Z"
						fill="#1a2520"
					/>
					<!-- Eyes -->
					<ellipse cx="26" cy="32" rx="3" ry="1.5" fill="#C49A3C" />
					<ellipse cx="38" cy="32" rx="3" ry="1.5" fill="#C49A3C" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M12 48 L18 20 C20 10 26 6 32 6 C38 6 44 10 46 20 L52 48"
						stroke="#4a7a5c"
						stroke-width="2.5"
						fill="none"
						stroke-linecap="round"
					/>
					<path
						d="M20 28 C20 24 25 20 32 20 C39 20 44 24 44 28 L44 36 C44 40 39 44 32 44 C25 44 20 40 20 36 Z"
						fill="#dde5df"
					/>
					<ellipse cx="26" cy="32" rx="3" ry="1.5" fill="#b8892e" />
					<ellipse cx="38" cy="32" rx="3" ry="1.5" fill="#b8892e" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Hooded assassin/ninja figure. Mysterious, only eyes visible. Dark and stealthy.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">V — Hood Angular</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M10 52 L16 18 C18 8 24 4 32 4 C40 4 46 8 48 18 L54 52"
						stroke="#6B9E7E"
						stroke-width="2"
						fill="none"
					/>
					<path d="M16 18 L32 12 L48 18" stroke="#6B9E7E" stroke-width="2" fill="none" />
					<path d="M22 30 L42 30" stroke="#C49A3C" stroke-width="2.5" stroke-linecap="round" />
					<circle cx="27" cy="30" r="1.5" fill="#0e1215" />
					<circle cx="37" cy="30" r="1.5" fill="#0e1215" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M10 52 L16 18 C18 8 24 4 32 4 C40 4 46 8 48 18 L54 52"
						stroke="#4a7a5c"
						stroke-width="2"
						fill="none"
					/>
					<path d="M16 18 L32 12 L48 18" stroke="#4a7a5c" stroke-width="2" fill="none" />
					<path d="M22 30 L42 30" stroke="#b8892e" stroke-width="2.5" stroke-linecap="round" />
					<circle cx="27" cy="30" r="1.5" fill="#f5f5f0" />
					<circle cx="37" cy="30" r="1.5" fill="#f5f5f0" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Sharp angular hood with peak. Gold eye slit. Geometric assassin — clean at small sizes.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">W — Hood Filled</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M8 56 L14 20 C16 8 23 2 32 2 C41 2 48 8 50 20 L56 56 Z" fill="#6B9E7E" />
					<path
						d="M18 26 C18 22 24 18 32 18 C40 18 46 22 46 26 L46 34 C46 36 40 38 32 38 C24 38 18 36 18 34 Z"
						fill="#0e1215"
					/>
					<ellipse cx="26" cy="30" rx="4" ry="2" fill="#C49A3C" />
					<ellipse cx="38" cy="30" rx="4" ry="2" fill="#C49A3C" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M8 56 L14 20 C16 8 23 2 32 2 C41 2 48 8 50 20 L56 56 Z" fill="#4a7a5c" />
					<path
						d="M18 26 C18 22 24 18 32 18 C40 18 46 22 46 26 L46 34 C46 36 40 38 32 38 C24 38 18 36 18 34 Z"
						fill="#f5f5f0"
					/>
					<ellipse cx="26" cy="30" rx="4" ry="2" fill="#b8892e" />
					<ellipse cx="38" cy="30" rx="4" ry="2" fill="#b8892e" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Solid filled hood silhouette with face cutout. Bold, iconic. Strong favicon potential.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">X — Hood Profile</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M20 54 L22 18 C23 8 28 4 36 4 C42 4 46 10 46 18 L46 30 C46 36 42 40 38 42 L34 54"
						fill="#6B9E7E"
					/>
					<path d="M28 22 L44 22 L44 32 L36 36 L28 32 Z" fill="#0e1215" />
					<ellipse cx="38" cy="27" rx="3" ry="2" fill="#C49A3C" />
					<path
						d="M46 16 Q54 14 56 20"
						stroke="#6B9E7E"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M20 54 L22 18 C23 8 28 4 36 4 C42 4 46 10 46 18 L46 30 C46 36 42 40 38 42 L34 54"
						fill="#4a7a5c"
					/>
					<path d="M28 22 L44 22 L44 32 L36 36 L28 32 Z" fill="#f5f5f0" />
					<ellipse cx="38" cy="27" rx="3" ry="2" fill="#b8892e" />
					<path
						d="M46 16 Q54 14 56 20"
						stroke="#4a7a5c"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Side profile hooded figure with trailing wrap. Single gold eye. Dramatic, cinematic.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">Y — Hood Slit</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M12 54 L18 22 C20 10 25 4 32 4 C39 4 44 10 46 22 L52 54" fill="#6B9E7E" />
					<path d="M20 28 L44 28" stroke="#C49A3C" stroke-width="4" stroke-linecap="round" />
					<path d="M12 54 L32 46 L52 54" fill="#4a7a5c" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path d="M12 54 L18 22 C20 10 25 4 32 4 C39 4 44 10 46 22 L52 54" fill="#4a7a5c" />
					<path d="M20 28 L44 28" stroke="#b8892e" stroke-width="4" stroke-linecap="round" />
					<path d="M12 54 L32 46 L52 54" fill="#3a6a4c" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Ultra-minimal hood with single gold slit. Maximum mystery. Reads at 16px favicon size.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">Z — Smoke Burst</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="32" r="8" fill="#C49A3C" />
					<circle cx="20" cy="22" r="10" fill="#6B9E7E" opacity="0.7" />
					<circle cx="44" cy="20" r="8" fill="#6B9E7E" opacity="0.5" />
					<circle cx="18" cy="38" r="7" fill="#6B9E7E" opacity="0.4" />
					<circle cx="46" cy="36" r="9" fill="#6B9E7E" opacity="0.6" />
					<circle cx="32" cy="48" r="8" fill="#6B9E7E" opacity="0.3" />
					<circle cx="36" cy="14" r="6" fill="#6B9E7E" opacity="0.35" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="32" r="8" fill="#b8892e" />
					<circle cx="20" cy="22" r="10" fill="#4a7a5c" opacity="0.7" />
					<circle cx="44" cy="20" r="8" fill="#4a7a5c" opacity="0.5" />
					<circle cx="18" cy="38" r="7" fill="#4a7a5c" opacity="0.4" />
					<circle cx="46" cy="36" r="9" fill="#4a7a5c" opacity="0.6" />
					<circle cx="32" cy="48" r="8" fill="#4a7a5c" opacity="0.3" />
					<circle cx="36" cy="14" r="6" fill="#4a7a5c" opacity="0.35" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Smoke bomb mid-explosion. Layered translucent circles. Gold core. Organic, dynamic.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">AA — Smoke Spiral</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M32 56 C32 56 28 48 28 42 C28 36 36 34 36 28 C36 22 28 20 28 14 C28 8 32 4 38 4"
						stroke="#6B9E7E"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
					/>
					<path
						d="M32 56 C32 56 36 46 36 40 C36 34 28 32 28 26 C28 20 36 18 36 12 C36 6 32 4 26 4"
						stroke="#6B9E7E"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
						opacity="0.5"
					/>
					<circle cx="32" cy="56" r="5" fill="#C49A3C" />
					<circle cx="32" cy="4" r="2" fill="#6B9E7E" opacity="0.3" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<path
						d="M32 56 C32 56 28 48 28 42 C28 36 36 34 36 28 C36 22 28 20 28 14 C28 8 32 4 38 4"
						stroke="#4a7a5c"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
					/>
					<path
						d="M32 56 C32 56 36 46 36 40 C36 34 28 32 28 26 C28 20 36 18 36 12 C36 6 32 4 26 4"
						stroke="#4a7a5c"
						stroke-width="3"
						stroke-linecap="round"
						fill="none"
						opacity="0.5"
					/>
					<circle cx="32" cy="56" r="5" fill="#b8892e" />
					<circle cx="32" cy="4" r="2" fill="#4a7a5c" opacity="0.3" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Rising smoke wisps from a gold ember. Elegant, vertical. Ninja vanishing in smoke.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">AB — Smoke Eyes</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<ellipse cx="32" cy="32" rx="26" ry="18" fill="#6B9E7E" opacity="0.25" />
					<ellipse cx="32" cy="32" rx="20" ry="14" fill="#6B9E7E" opacity="0.35" />
					<ellipse cx="32" cy="32" rx="14" ry="10" fill="#6B9E7E" opacity="0.5" />
					<ellipse cx="25" cy="31" rx="4" ry="2.5" fill="#C49A3C" />
					<ellipse cx="39" cy="31" rx="4" ry="2.5" fill="#C49A3C" />
					<ellipse cx="25" cy="31" rx="1.5" ry="1.5" fill="#0e1215" />
					<ellipse cx="39" cy="31" rx="1.5" ry="1.5" fill="#0e1215" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<ellipse cx="32" cy="32" rx="26" ry="18" fill="#4a7a5c" opacity="0.2" />
					<ellipse cx="32" cy="32" rx="20" ry="14" fill="#4a7a5c" opacity="0.3" />
					<ellipse cx="32" cy="32" rx="14" ry="10" fill="#4a7a5c" opacity="0.45" />
					<ellipse cx="25" cy="31" rx="4" ry="2.5" fill="#b8892e" />
					<ellipse cx="39" cy="31" rx="4" ry="2.5" fill="#b8892e" />
					<ellipse cx="25" cy="31" rx="1.5" ry="1.5" fill="#f5f5f0" />
					<ellipse cx="39" cy="31" rx="1.5" ry="1.5" fill="#f5f5f0" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Gold eyes peering through layered smoke clouds. Ninja emerging from stealth. Haunting.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">AC — Smoke Bomb</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<!-- Bomb body -->
					<circle cx="32" cy="42" r="14" fill="#6B9E7E" />
					<circle cx="32" cy="42" r="10" fill="#4a7a5c" />
					<!-- Fuse -->
					<path
						d="M32 28 C32 24 36 20 36 16"
						stroke="#C49A3C"
						stroke-width="2"
						stroke-linecap="round"
						fill="none"
					/>
					<!-- Spark -->
					<circle cx="36" cy="14" r="3" fill="#C49A3C" />
					<line
						x1="36"
						y1="8"
						x2="36"
						y2="11"
						stroke="#C49A3C"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="30"
						y1="12"
						x2="33"
						y2="13"
						stroke="#C49A3C"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="40"
						y1="10"
						x2="38"
						y2="12"
						stroke="#C49A3C"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<!-- Smoke wisps -->
					<circle cx="22" cy="20" r="5" fill="#6B9E7E" opacity="0.3" />
					<circle cx="44" cy="16" r="4" fill="#6B9E7E" opacity="0.2" />
					<circle cx="28" cy="12" r="3" fill="#6B9E7E" opacity="0.15" />
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="32" cy="42" r="14" fill="#4a7a5c" />
					<circle cx="32" cy="42" r="10" fill="#3a6a4c" />
					<path
						d="M32 28 C32 24 36 20 36 16"
						stroke="#b8892e"
						stroke-width="2"
						stroke-linecap="round"
						fill="none"
					/>
					<circle cx="36" cy="14" r="3" fill="#b8892e" />
					<line
						x1="36"
						y1="8"
						x2="36"
						y2="11"
						stroke="#b8892e"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="30"
						y1="12"
						x2="33"
						y2="13"
						stroke="#b8892e"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<line
						x1="40"
						y1="10"
						x2="38"
						y2="12"
						stroke="#b8892e"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<circle cx="22" cy="20" r="5" fill="#4a7a5c" opacity="0.3" />
					<circle cx="44" cy="16" r="4" fill="#4a7a5c" opacity="0.2" />
					<circle cx="28" cy="12" r="3" fill="#4a7a5c" opacity="0.15" />
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Classic round smoke bomb with lit fuse and sparks. Playful but ninja-authentic.
		</div>
	</button>

	<button type="button" class="card" onclick={(e) => e.currentTarget.classList.toggle('selected')}>
		<div class="label">AD — Smoke Poof</div>
		<div class="both-row">
			<div style="background:#0e1215">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="24" cy="36" r="12" fill="#6B9E7E" opacity="0.6" />
					<circle cx="40" cy="34" r="11" fill="#6B9E7E" opacity="0.5" />
					<circle cx="32" cy="26" r="13" fill="#6B9E7E" opacity="0.7" />
					<circle cx="20" cy="24" r="8" fill="#6B9E7E" opacity="0.35" />
					<circle cx="44" cy="24" r="7" fill="#6B9E7E" opacity="0.3" />
					<circle cx="32" cy="44" r="9" fill="#6B9E7E" opacity="0.4" />
					<!-- Star burst lines from center -->
					<line
						x1="32"
						y1="24"
						x2="32"
						y2="16"
						stroke="#C49A3C"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="24"
						y2="18"
						stroke="#C49A3C"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="40"
						y2="18"
						stroke="#C49A3C"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="26"
						y2="28"
						stroke="#C49A3C"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="38"
						y2="28"
						stroke="#C49A3C"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</div>
			<div style="background:#f5f5f0">
				<svg
					viewBox="0 0 64 64"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
				>
					<circle cx="24" cy="36" r="12" fill="#4a7a5c" opacity="0.5" />
					<circle cx="40" cy="34" r="11" fill="#4a7a5c" opacity="0.4" />
					<circle cx="32" cy="26" r="13" fill="#4a7a5c" opacity="0.6" />
					<circle cx="20" cy="24" r="8" fill="#4a7a5c" opacity="0.3" />
					<circle cx="44" cy="24" r="7" fill="#4a7a5c" opacity="0.25" />
					<circle cx="32" cy="44" r="9" fill="#4a7a5c" opacity="0.35" />
					<line
						x1="32"
						y1="24"
						x2="32"
						y2="16"
						stroke="#b8892e"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="24"
						y2="18"
						stroke="#b8892e"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="40"
						y2="18"
						stroke="#b8892e"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="26"
						y2="28"
						stroke="#b8892e"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<line
						x1="32"
						y1="24"
						x2="38"
						y2="28"
						stroke="#b8892e"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		</div>
		<div class="wordmark">
			<svg viewBox="0 0 220 40" fill="#e0e0e0" height="28"
				><text
					x="0"
					y="30"
					font-family="system-ui"
					font-size="28"
					font-weight="700"
					letter-spacing="-0.5">bounty<tspan fill="#6B9E7E">.ninja</tspan></text
				></svg
			>
		</div>
		<div class="desc">
			Manga-style poof cloud with gold impact lines. Comic book energy. Fun and distinctive.
		</div>
	</button>
</div>

<p style="text-align:center; margin-top:2rem; color:#666; font-size:0.8rem;">
	All candidates use the brand palette: Green <span style="color:#6B9E7E">#6B9E7E</span> + Gold
	<span style="color:#C49A3C">#C49A3C</span>. Shown on dark &amp; light backgrounds.
</p>

<style>
	:global(body) {
		background: #0e1215 !important;
		color: #e0e0e0;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		padding: 2rem 1rem;
	}
	h1 {
		text-align: center;
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
	}
	p {
		text-align: center;
		color: #888;
		margin-bottom: 2rem;
		font-size: 0.9rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
	}
	.card {
		appearance: none;
		font: inherit;
		color: inherit;
		width: 100%;
		background: #1a1f24;
		border: 2px solid #2a2f34;
		border-radius: 12px;
		padding: 1.5rem;
		text-align: center;
		transition:
			border-color 0.2s,
			transform 0.2s;
		cursor: pointer;
	}
	.card:hover {
		border-color: #6b9e7e;
		transform: translateY(-2px);
	}
	:global(.card.selected) {
		border-color: #c49a3c !important;
		box-shadow: 0 0 20px rgba(196, 154, 60, 0.3);
	}
	.wordmark {
		margin-bottom: 0.75rem;
	}
	.label {
		font-size: 0.8rem;
		color: #6b9e7e;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}
	.desc {
		font-size: 0.75rem;
		color: #888;
	}
	.both-row {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}
	.both-row > :global(div) {
		flex: 1;
		padding: 1rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
