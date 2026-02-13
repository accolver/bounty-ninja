export interface TaxonomyEntry {
	/** Canonical tag name (lowercase, what gets stored in the ['t', '...'] tag) */
	tag: string;
	/** Human-readable label for display in the suggestion UI */
	label: string;
	/** Keyword patterns to match against title + description */
	patterns: RegExp[];
}

export const TAXONOMY: TaxonomyEntry[] = [
	// ── Software & Engineering ──────────────────────────────────────────
	{
		tag: 'bitcoin',
		label: 'Bitcoin',
		patterns: [/\b(bitcoin|btc|lightning|ln|lnurl|bolt11|onchain|utxo|mempool)\b/i]
	},
	{
		tag: 'nostr',
		label: 'Nostr',
		patterns: [/\b(nostr|nip-?\d+|relay|nsec|npub|naddr|nevent|nprofile|zap)\b/i]
	},
	{
		tag: 'cashu',
		label: 'Cashu',
		patterns: [/\b(cashu|ecash|e-?cash|nut-?\d+|mint\s+url|cashu\s*token)\b/i]
	},
	{
		tag: 'frontend',
		label: 'Frontend',
		patterns: [
			/\b(frontend|front-end|react|svelte|vue|angular|next\.?js|nuxt|css|html|tailwind|ui\s+component|responsive|dom)\b/i
		]
	},
	{
		tag: 'backend',
		label: 'Backend',
		patterns: [
			/\b(backend|back-end|server|api|rest\s*api|graphql|grpc|microservice|endpoint|webhook|middleware)\b/i
		]
	},
	{
		tag: 'mobile',
		label: 'Mobile',
		patterns: [
			/\b(mobile|ios|android|react\s*native|flutter|swift|kotlin|app\s+store|play\s+store)\b/i
		]
	},
	{
		tag: 'rust',
		label: 'Rust',
		patterns: [/\b(rust|cargo|crate|rustc|tokio|wasm-?\s*pack)\b/i]
	},
	{
		tag: 'python',
		label: 'Python',
		patterns: [/\b(python|pip|django|flask|fastapi|pytorch|pandas|numpy|jupyter)\b/i]
	},
	{
		tag: 'javascript',
		label: 'JavaScript',
		patterns: [/\b(javascript|typescript|node\.?js|deno|bun|npm|yarn|pnpm|express|vite|webpack)\b/i]
	},
	{
		tag: 'golang',
		label: 'Go',
		patterns: [/\b(golang|go\s+module|goroutine|gin\s+framework)\b/i]
	},
	{
		tag: 'devops',
		label: 'DevOps',
		patterns: [
			/\b(devops|ci\/?cd|docker|kubernetes|k8s|terraform|ansible|jenkins|github\s+actions|deploy|pipeline|infrastructure)\b/i
		]
	},
	{
		tag: 'security',
		label: 'Security',
		patterns: [
			/\b(security|vulnerability|pentest|pen-?test|audit|cve|exploit|encryption|authentication|authorization|oauth|jwt|firewall|hardening)\b/i
		]
	},
	{
		tag: 'database',
		label: 'Database',
		patterns: [
			/\b(database|sql|postgres|mysql|sqlite|mongodb|redis|cassandra|schema|migration|query\s+optimization)\b/i
		]
	},
	{
		tag: 'ai',
		label: 'AI / ML',
		patterns: [
			/\b(ai|artificial\s+intelligence|machine\s+learning|deep\s+learning|llm|gpt|neural\s+net|model\s+training|fine-?\s*tun|prompt\s+engineer|nlp|computer\s+vision)\b/i
		]
	},
	{
		tag: 'data',
		label: 'Data',
		patterns: [
			/\b(data\s+(?:analysis|science|engineer|pipeline|warehouse|lake|visualization)|etl|analytics|scraping|web\s+scraper|dataset)\b/i
		]
	},
	{
		tag: 'blockchain',
		label: 'Blockchain',
		patterns: [/\b(blockchain|smart\s+contract|solidity|ethereum|defi|dao|nft|token|web3|dapp)\b/i]
	},
	{
		tag: 'networking',
		label: 'Networking',
		patterns: [
			/\b(networking|tcp|udp|dns|http|websocket|vpn|tor|p2p|peer-to-peer|protocol|mesh\s+network)\b/i
		]
	},
	{
		tag: 'embedded',
		label: 'Embedded',
		patterns: [
			/\b(embedded|firmware|microcontroller|arduino|raspberry\s+pi|esp32|iot|rtos|fpga|pcb)\b/i
		]
	},
	{
		tag: 'open-source',
		label: 'Open Source',
		patterns: [
			/\b(open[\s-]?source|foss|libre|gpl|mit\s+license|apache\s+license|contribute|contributor|maintainer)\b/i
		]
	},
	{
		tag: 'testing',
		label: 'Testing',
		patterns: [
			/\b(testing|unit\s+test|integration\s+test|e2e|end-to-end|qa|quality\s+assurance|test\s+suite|coverage|regression)\b/i
		]
	},
	{
		tag: 'bug',
		label: 'Bug Fix',
		patterns: [/\b(bug|fix|patch|issue|broken|crash|regression|debug|troubleshoot)\b/i]
	},

	// ── Design & Creative ──────────────────────────────────────────────
	{
		tag: 'design',
		label: 'Design',
		patterns: [
			/\b(design|ui\/?ux|user\s+interface|user\s+experience|wireframe|mockup|prototype|figma|sketch|adobe\s+xd|interaction\s+design)\b/i
		]
	},
	{
		tag: 'branding',
		label: 'Branding',
		patterns: [
			/\b(brand|logo|visual\s+identity|style\s+guide|brand\s+kit|rebrand|color\s+palette|typography)\b/i
		]
	},
	{
		tag: 'illustration',
		label: 'Illustration',
		patterns: [
			/\b(illustrat|drawing|artwork|sketch|comic|character\s+design|icon\s+set|infographic|vector\s+art)\b/i
		]
	},
	{
		tag: 'video',
		label: 'Video',
		patterns: [
			/\b(video|film|animation|motion\s+graphics|editing|vfx|youtube|documentary|cinematic|footage|timelapse)\b/i
		]
	},
	{
		tag: 'audio',
		label: 'Audio',
		patterns: [
			/\b(audio|music|sound|podcast|recording|mixing|mastering|jingle|soundtrack|voiceover|narration)\b/i
		]
	},
	{
		tag: 'photography',
		label: 'Photography',
		patterns: [
			/\b(photo|photograph|portrait|headshot|product\s+photo|aerial\s+photo|drone\s+photo|lightroom)\b/i
		]
	},
	{
		tag: '3d',
		label: '3D',
		patterns: [/\b(3d|blender|unity|unreal|cad|rendering|3d\s+model|3d\s+print)\b/i]
	},
	{
		tag: 'game',
		label: 'Game Dev',
		patterns: [
			/\b(game|gamedev|game\s+design|game\s+engine|unity|unreal|godot|pixel\s+art|level\s+design)\b/i
		]
	},

	// ── Content & Writing ──────────────────────────────────────────────
	{
		tag: 'writing',
		label: 'Writing',
		patterns: [
			/\b(writing|write|article|blog\s+post|copywriting|content\s+creation|ghostwrit|editorial|essay|ebook)\b/i
		]
	},
	{
		tag: 'documentation',
		label: 'Documentation',
		patterns: [
			/\b(documentation|docs|readme|wiki|technical\s+writ|api\s+doc|user\s+guide|tutorial|how-?\s*to)\b/i
		]
	},
	{
		tag: 'translation',
		label: 'Translation',
		patterns: [
			/\b(translat|locali[sz]|i18n|l10n|multilingual|interpret|spanish|french|german|chinese|japanese|portuguese|arabic|hindi|korean)\b/i
		]
	},
	{
		tag: 'education',
		label: 'Education',
		patterns: [
			/\b(education|teach|course|curriculum|lesson|workshop|training|tutor|mentor|bootcamp|lecture|webinar)\b/i
		]
	},

	// ── Marketing & Growth ─────────────────────────────────────────────
	{
		tag: 'marketing',
		label: 'Marketing',
		patterns: [
			/\b(marketing|promotion|campaign|advertising|ad\s+campaign|growth|outreach|awareness|impressions|engagement)\b/i
		]
	},
	{
		tag: 'social-media',
		label: 'Social Media',
		patterns: [
			/\b(social\s+media|twitter|x\.com|instagram|tiktok|youtube|facebook|reddit|discord|telegram|community\s+manag|influencer)\b/i
		]
	},
	{
		tag: 'seo',
		label: 'SEO',
		patterns: [
			/\b(seo|search\s+engine|keyword|backlink|organic\s+traffic|serp|meta\s+tag|sitemap)\b/i
		]
	},

	// ── Research & Analysis ────────────────────────────────────────────
	{
		tag: 'research',
		label: 'Research',
		patterns: [
			/\b(research|study|investigation|analysis|report|whitepaper|white\s+paper|literature\s+review|findings|methodology|peer\s+review)\b/i
		]
	},
	{
		tag: 'survey',
		label: 'Survey',
		patterns: [
			/\b(survey|questionnaire|poll|census|feedback\s+collection|user\s+research|interview|focus\s+group)\b/i
		]
	},

	// ── Civic & Community ──────────────────────────────────────────────
	{
		tag: 'civic',
		label: 'Civic',
		patterns: [
			/\b(civic|city|municipal|public\s+space|urban|town\s+hall|government|zoning|permit|ordinance|public\s+hearing|council|mayor)\b/i
		]
	},
	{
		tag: 'environment',
		label: 'Environment',
		patterns: [
			/\b(environment|climate|sustain|renewable|solar|wind\s+power|recycling|conservation|wildlife|pollution|clean\s+energy|carbon|reforestation|tree\s+plant)\b/i
		]
	},
	{
		tag: 'activism',
		label: 'Activism',
		patterns: [
			/\b(activism|petition|signature|protest|rally|advocacy|campaign|mobiliz|grassroots|civil\s+rights|human\s+rights|justice|reform|movement)\b/i
		]
	},
	{
		tag: 'nonprofit',
		label: 'Nonprofit',
		patterns: [
			/\b(nonprofit|non-?\s*profit|charity|donation|fundrais|volunteer|ngo|501c|humanitarian|relief\s+effort|philanthrop)\b/i
		]
	},
	{
		tag: 'governance',
		label: 'Governance',
		patterns: [
			/\b(governance|policy|regulation|legislation|ballot|election|vote|referendum|democratic|constitution|bylaw)\b/i
		]
	},

	// ── Physical & Construction ────────────────────────────────────────
	{
		tag: 'construction',
		label: 'Construction',
		patterns: [
			/\b(construct|build|building|renovation|remodel|contractor|architect|blueprint|foundation|framing|roofing|plumbing|electrical|hvac)\b/i
		]
	},
	{
		tag: 'repair',
		label: 'Repair',
		patterns: [
			/\b(repair|fix|maintenance|restore|refurbish|replace|broken|damaged|patch|overhaul)\b/i
		]
	},
	{
		tag: 'landscaping',
		label: 'Landscaping',
		patterns: [
			/\b(landscap|garden|lawn|park|playground|trail|path|outdoor\s+space|green\s+space|irrigation|mowing|plant)\b/i
		]
	},
	{
		tag: 'cleaning',
		label: 'Cleaning',
		patterns: [
			/\b(clean|cleanup|clean-?\s*up|trash|litter|debris|sanitation|janitorial|power\s+wash|graffiti\s+removal)\b/i
		]
	},
	{
		tag: 'delivery',
		label: 'Delivery / Logistics',
		patterns: [
			/\b(deliver|courier|shipping|logistics|transport|freight|pickup|drop-?\s*off|moving|hauling)\b/i
		]
	},

	// ── Legal & Compliance ─────────────────────────────────────────────
	{
		tag: 'legal',
		label: 'Legal',
		patterns: [
			/\b(legal|law|attorney|lawyer|contract|compliance|regulation|litigation|intellectual\s+property|trademark|patent|copyright|terms\s+of\s+service|privacy\s+policy)\b/i
		]
	},

	// ── Finance & Business ─────────────────────────────────────────────
	{
		tag: 'finance',
		label: 'Finance',
		patterns: [
			/\b(finance|accounting|bookkeeping|tax|invoice|payroll|budget|financial\s+plan|audit|revenue|profit|loss)\b/i
		]
	},
	{
		tag: 'business',
		label: 'Business',
		patterns: [
			/\b(business\s+plan|startup|entrepreneur|pitch\s+deck|market\s+research|competitive\s+analysis|business\s+model|go-to-market|mvp\s+strategy)\b/i
		]
	},

	// ── Events & Organizing ────────────────────────────────────────────
	{
		tag: 'event',
		label: 'Event',
		patterns: [
			/\b(event|conference|meetup|hackathon|summit|gathering|ceremony|festival|concert|party|show|exhibition|trade\s+show)\b/i
		]
	},
	{
		tag: 'organizing',
		label: 'Organizing',
		patterns: [
			/\b(organiz|coordinat|planning|logistics|scheduling|project\s+manag|task\s+manag|volunteer\s+coordinat)\b/i
		]
	},

	// ── Miscellaneous ──────────────────────────────────────────────────
	{
		tag: 'bounty',
		label: 'Bounty',
		patterns: [/\b(bounty|reward|prize|competition|contest|challenge|hackathon)\b/i]
	},
	{
		tag: 'privacy',
		label: 'Privacy',
		patterns: [
			/\b(privacy|anonymous|pseudonymous|tor|vpn|encryption|zero[\s-]?knowledge|zk-?\s*proof|sovereign|self[\s-]?custod|censorship[\s-]?resist)\b/i
		]
	}
];
