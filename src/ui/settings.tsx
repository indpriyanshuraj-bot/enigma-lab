import { useEffect, useRef } from 'preact/hooks';
import { THEMES, type Mode, type Prefs } from '../state/prefs.js';

export interface SettingsProps {
	readonly prefs: Prefs;
	readonly onChange: (next: Prefs) => void;
	readonly open: boolean;
	readonly onClose: () => void;
	readonly onShowLog: () => void;
}

/**
 * Preferences in a native `<dialog>`.
 *
 * A modal dialog is the one place the platform already gets focus trapping,
 * Escape handling and `inert` background behaviour right, so it is used rather
 * than re-implemented.
 */
export function Settings({ prefs, onChange, open, onClose, onShowLog }: SettingsProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			class="settings"
			ref={ref}
			aria-labelledby="settings-title"
			onClose={onClose}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
		>
			<form method="dialog" class="settings__body">
				<header class="settings__head">
					<h2 id="settings-title">Settings</h2>
					<button type="button" class="button button--ghost" onClick={onClose} aria-label="Close settings">
						Close
					</button>
				</header>

				<fieldset class="settings__group">
					<legend>Theme</legend>
					<div class="swatches">
						{THEMES.map((theme) => (
							<label key={theme.id} class="swatch" data-theme-preview={theme.id}>
								<input
									type="radio"
									name="theme"
									value={theme.id}
									checked={prefs.theme === theme.id}
									onChange={() => onChange({ ...prefs, theme: theme.id })}
								/>
								<span class="swatch__chip" aria-hidden="true" />
								<span class="swatch__name">{theme.name}</span>
								<small>{theme.hint}</small>
							</label>
						))}
					</div>
				</fieldset>

				<fieldset class="settings__group">
					<legend>Interface</legend>
					<label class="field field--row">
						<span>Start in</span>
						<select value={prefs.mode} onChange={(event) => onChange({ ...prefs, mode: (event.target as HTMLSelectElement).value as Mode })}>
							<option value="form">Form — settings and text</option>
							<option value="3d">3D — the physical machine</option>
						</select>
					</label>
					<label class="field field--row">
						<span>Machine renderer</span>
						<select
							value={prefs.renderer}
							onChange={(event) => onChange({ ...prefs, renderer: (event.target as HTMLSelectElement).value as Prefs['renderer'] })}
						>
							<option value="auto">Automatic — WebGPU, WebGL2, WebGL1, SVG</option>
							<option value="webgpu">WebGPU only</option>
							<option value="webgl">WebGL only (2, then 1)</option>
							<option value="svg">SVG only</option>
						</select>
					</label>
					<label class="field field--row">
						<span>Control size</span>
						<select value={prefs.density} onChange={(event) => onChange({ ...prefs, density: (event.target as HTMLSelectElement).value as Prefs['density'] })}>
							<option value="comfortable">Comfortable</option>
							<option value="compact">Compact — more keys, less air</option>
						</select>
					</label>
					<label class="field field--row">
						<span>Motion</span>
						<input type="checkbox" checked={prefs.motion} onChange={(event) => onChange({ ...prefs, motion: (event.target as HTMLInputElement).checked })} />
						<small>Easing and transitions. Turn off for a still interface.</small>
					</label>
				</fieldset>

				<fieldset class="settings__group">
					<legend>Developer</legend>
					<label class="field field--row">
						<span>Console log</span>
						<input type="checkbox" checked={prefs.logs} onChange={(event) => onChange({ ...prefs, logs: (event.target as HTMLInputElement).checked })} />
						<small>Keeps the last 200 console lines, for phones with no console.</small>
					</label>
					<button type="button" class="button button--ghost" onClick={onShowLog}>
						View log
					</button>
				</fieldset>

				<p class="settings__note">
					Preferences stay on this device. The machine settings live in the URL, so a shared link always opens the same
					machine in whatever theme the reader prefers.
				</p>
			</form>
		</dialog>
	);
}
