import { useEffect, useState } from 'preact/hooks';

interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED = 'enigma-lab:install-dismissed';

/**
 * The install banner.
 *
 * Appears on its own once the browser says the app is installable — a few
 * seconds in, or on the first interaction, whichever comes first — and never
 * again once dismissed. Where the platform has no prompt (Safari on iOS), it
 * explains the two taps instead of pretending.
 */
export function InstallBanner() {
	const [visible, setVisible] = useState(false);
	const [mode, setMode] = useState<'prompt' | 'ios'>('prompt');
	const [event, setEvent] = useState<InstallPromptEvent | null>(null);

	useEffect(() => {
		if (localStorage.getItem(DISMISSED)) return;
		if (globalThis.matchMedia?.('(display-mode: standalone)').matches) return;

		let timer: ReturnType<typeof setTimeout> | null = null;
		const reveal = () => setVisible(true);

		const onPrompt = (raw: Event) => {
			raw.preventDefault();
			setEvent(raw as InstallPromptEvent);
			setMode('prompt');
			timer = setTimeout(reveal, 4000);
		};
		globalThis.addEventListener('beforeinstallprompt', onPrompt);

		// Safari never fires the event, so say the useful thing instead.
		const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
		const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		if (isIos && isSafari) {
			setMode('ios');
			timer = setTimeout(reveal, 6000);
		}

		// Reveal after a gesture has *finished*, and only after a few of them: the
		// banner takes its space in the layout, and growing the page mid-tap would
		// move the key out from under the finger.
		let interactions = 0;
		const onInteraction = () => {
			interactions += 1;
			if (interactions >= 3) reveal();
		};
		globalThis.addEventListener('click', onInteraction);

		return () => {
			if (timer) clearTimeout(timer);
			globalThis.removeEventListener('beforeinstallprompt', onPrompt);
			globalThis.removeEventListener('click', onInteraction);
		};
	}, []);

	if (!visible) return null;

	const dismiss = () => {
		setVisible(false);
		try {
			localStorage.setItem(DISMISSED, '1');
		} catch {
			// Private mode: it will simply ask again next time.
		}
	};

	const install = async () => {
		if (!event) return;
		await event.prompt();
		const choice = await event.userChoice;
		if (choice.outcome === 'accepted') setVisible(false);
		else dismiss();
	};

	return (
		<aside class="install" role="region" aria-label="Install this app">
			<span class="install__icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
					<path d="M12 3v11m0 0 4-4m-4 4-4-4" />
					<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
				</svg>
			</span>
			<p>
				<strong>Install Enigma Lab</strong>
				<span>
					{mode === 'prompt'
						? 'Works offline, opens like an app, no store involved.'
						: 'Tap Share, then “Add to Home Screen”. Works offline once added.'}
				</span>
			</p>
			{mode === 'prompt' ? (
				<button type="button" class="button" onClick={() => void install()}>
					Install
				</button>
			) : null}
			<button type="button" class="button button--ghost" onClick={dismiss} aria-label="Dismiss install banner">
				Not now
			</button>
		</aside>
	);
}
