export interface KeyboardProps {
	readonly onKey: (letter: string) => void;
	readonly onBackspace: () => void;
	readonly lit: string | null;
}

const ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'];

/**
 * Lampboard and keys in one, because on a real machine they were one panel: the
 * letter you press and the letter that lights up share a key.
 */
export function Keyboard({ onKey, onBackspace, lit }: KeyboardProps) {
	return (
		<section class="keyboard" aria-label="Machine keyboard">
			{ROWS.map((row, rowIndex) => (
				<div class="keyboard__row" key={row}>
					{rowIndex === 2 ? (
						<button type="button" class="key key--wide" onClick={onBackspace} aria-label="Delete last letter">
							⌫
						</button>
					) : null}
					{[...row].map((letter) => (
						<button
							type="button"
							key={letter}
							class={lit === letter ? 'key key--lit' : 'key'}
							onClick={() => onKey(letter)}
							aria-label={`Press ${letter}`}
						>
							{letter}
						</button>
					))}
				</div>
			))}
			<p class="keyboard__hint">Type on your keyboard, or tap. <kbd>Backspace</kbd> deletes, <kbd>Esc</kbd> clears.</p>
		</section>
	);
}
