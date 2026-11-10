/** Inline icons, so there is no icon font and no extra request. */
const base = {
	width: 20,
	height: 20,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	'stroke-width': 1.7,
	'stroke-linecap': 'round' as const,
	'stroke-linejoin': 'round' as const,
};

export function IconGears() {
	return (
		<svg {...base} aria-hidden="true">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
		</svg>
	);
}

export function IconWheels() {
	return (
		<svg {...base} aria-hidden="true">
			<circle cx="7" cy="12" r="3.2" />
			<circle cx="15.5" cy="12" r="3.2" />
			<path d="M2.5 12h1.3M10.2 12h2.1M18.7 12h2.8" />
		</svg>
	);
}

export function IconChart() {
	return (
		<svg {...base} aria-hidden="true">
			<path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />
		</svg>
	);
}

export function IconSignal() {
	return (
		<svg {...base} aria-hidden="true">
			<path d="M3 11a9 9 0 0 1 9-9M3 17a15 15 0 0 1 15-15" />
			<circle cx="5" cy="19" r="2" />
		</svg>
	);
}

export function IconKeyboard() {
	return (
		<svg {...base} aria-hidden="true">
			<rect x="2.5" y="6" width="19" height="12" rx="2.5" />
			<path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
		</svg>
	);
}

export function IconCopy() {
	return (
		<svg {...base} aria-hidden="true">
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a2.5 2.5 0 0 0-2.5 2.5V13" />
		</svg>
	);
}

export function IconClear() {
	return (
		<svg {...base} aria-hidden="true">
			<path d="M4 12h16" />
			<path d="M9 6.5 4.5 12l4.5 5.5" />
			<path d="M15 8.5 20.5 15" />
		</svg>
	);
}
