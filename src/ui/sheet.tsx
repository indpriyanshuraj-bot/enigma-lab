import { useEffect, useRef } from 'preact/hooks';

export interface SheetProps {
	readonly open: boolean;
	readonly title: string;
	readonly onClose: () => void;
	readonly children: preact.ComponentChildren;
}

/**
 * A bottom sheet on phones, a centred panel on a desktop.
 *
 * Native `<dialog>`, so focus trapping, Escape and the inert background come
 * from the platform rather than from us. The body scrolls; the page behind does
 * not, which is the whole point of putting the settings in here.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			class="sheet"
			ref={ref}
			aria-labelledby="sheet-title"
			onClose={onClose}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
		>
			<div class="sheet__inner">
				<header class="sheet__head">
					<span class="sheet__grab" aria-hidden="true" />
					<h2 id="sheet-title">{title}</h2>
					<button type="button" class="icon-button" onClick={onClose} aria-label={`Close ${title}`}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</header>
				<div class="sheet__body">{children}</div>
			</div>
		</dialog>
	);
}
