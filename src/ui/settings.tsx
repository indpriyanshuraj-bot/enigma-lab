import { useEffect, useRef } from 'preact/hooks';
import { THEMES, type Mode, type Prefs } from '../state/prefs.js';

export interface SettingsProps {
	readonly prefs: Prefs;
	readonly onChange: (next: Prefs) => void;
	readonly open: boolean;
	readonly onClose: () => void;
}

/**
 * Preferences in a native `<dialog>`.
 *
 * A modal dialog is the one place the platform already gets focus trapping,
 * Escape handling and `inert` background behaviour right, so it is used rather
 * than re-implemented.
 */
export function Settings({ prefs, onChange, open, onClose }: SettingsProps) {
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
							<option value="auto">Automatic — WebGPU when available</option>
							<option value="webgpu">WebGPU only</option>
							<option value="svg">SVG only</option>
						</select>
					</label>
					<label class="field field--row">
						<span>Motion</span>
						<input type="checkbox" checked={prefs.motion} onChange={(event) => onChange({ ...prefs, motion: (event.target as HTMLInputElement).checked })} />
						<small>Easing and transitions. Turn off for a still interface.</small>
					</label>
				</fieldset>

				<p class="settings__note">
					Preferences stay on this device. The machine settings live in the URL, so a shared link always opens the same
					machine in whatever theme the reader prefers.
				</p>
			</form>
		</dialog>
	);
}
