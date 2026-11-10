/**
 * Preferences: the things a visitor chooses once and expects to keep.
 *
 * Separate from {@link LabState}, which is the machine. A preference is not part
 * of the simulation and must never end up in a shared link.
 */
export type ThemeId = 'dark' | 'light' | 'sepia' | 'contrast';
export type Mode = 'form' | '3d';
export type RendererPreference = 'auto' | 'webgpu' | 'webgl' | 'svg';
export type Density = 'comfortable' | 'compact';

export interface Prefs {
	readonly theme: ThemeId;
	readonly mode: Mode;
	readonly renderer: RendererPreference;
	/** `false` disables easing and any non-essential animation. */
	readonly motion: boolean;
	/** How much air the controls get. */
	readonly density: Density;
	/** Keeps a console log for phones that have none. */
	readonly logs: boolean;
}

const KEY = 'enigma-lab:prefs';

export const THEMES: readonly { id: ThemeId; name: string; hint: string }[] = [
	{ id: 'dark', name: 'Dark', hint: 'The default: a machine on a bench at night.' },
	{ id: 'light', name: 'Light', hint: 'Daylight, paper, ink.' },
	{ id: 'sepia', name: 'Archive', hint: 'Signal paper and Bakelite.' },
	{ id: 'contrast', name: 'High contrast', hint: 'Maximum separation, no decoration.' },
];

export function defaultPrefs(): Prefs {
	const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: light)').matches === false;
	const calm = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
	return {
		theme: prefersDark ? 'dark' : 'light',
		mode: 'form',
		renderer: 'auto',
		motion: !calm,
		density: 'comfortable',
		logs: false,
	};
}

export function loadPrefs(): Prefs {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return defaultPrefs();
		const parsed = JSON.parse(raw) as Partial<Prefs>;
		const base = defaultPrefs();
		return {
			theme: THEMES.some((theme) => theme.id === parsed.theme) ? (parsed.theme as ThemeId) : base.theme,
			mode: parsed.mode === '3d' ? '3d' : 'form',
			renderer:
				parsed.renderer === 'webgpu' || parsed.renderer === 'webgl' || parsed.renderer === 'svg' ? parsed.renderer : 'auto',
			motion: typeof parsed.motion === 'boolean' ? parsed.motion : base.motion,
			density: parsed.density === 'compact' ? 'compact' : 'comfortable',
			logs: typeof parsed.logs === 'boolean' ? parsed.logs : base.logs,
		};
	} catch {
		return defaultPrefs();
	}
}

export function savePrefs(prefs: Prefs): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(prefs));
	} catch {
		// Private mode: preferences simply do not persist.
	}
}

/** Applies a theme to the document, so CSS does the rest. */
export function applyTheme(theme: ThemeId): void {
	document.documentElement.dataset.theme = theme;
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute('content', theme === 'light' || theme === 'sepia' ? '#f4f1ea' : theme === 'contrast' ? '#000000' : '#0b0f14');
}
