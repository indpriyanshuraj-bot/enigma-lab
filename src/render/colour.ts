/** Colour helpers shared by every backend. */

/** Parses `#rgb`, `#rrggbb` or `rgb(r, g, b)` into 0..1 components. */
export function parseColour(value: string): [number, number, number] | null {
	const text = value.trim();
	const hex = text.startsWith('#') ? text.slice(1) : null;
	if (hex) {
		if (hex.length === 3) {
			const [r, g, b] = [...hex].map((char) => Number.parseInt(char + char, 16) / 255);
			return r !== undefined && g !== undefined && b !== undefined ? [r, g, b] : null;
		}
		if (hex.length === 6) {
			const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
			const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
			const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
			return [r, g, b].every(Number.isFinite) ? [r, g, b] : null;
		}
		return null;
	}
	const match = text.match(/^rgba?\(([^)]+)\)$/i);
	if (!match?.[1]) return null;
	const parts = match[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
	if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
	return parts.map((part) => part / 255) as [number, number, number];
}

/** Reads a CSS custom property, falling back when it is missing or unparseable. */
export function cssColour(name: string, fallback: string, root: HTMLElement = document.documentElement): string {
	const value = getComputedStyle(root).getPropertyValue(name).trim();
	return parseColour(value) ? value : fallback;
}
