import { useEffect, useRef, useState } from 'preact/hooks';

interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_AT = 'enigma-lab:install-dismissed-at';
/** How long "Not now" lasts before the offer comes back. */
const QUIET_PERIOD = 3 * 24 * 60 * 60 * 1000;

/**
 * The install banner, at the top of the screen.
 *
 * It appears on its own once the browser says the app is installable — a few
 * seconds in, or after a few interactions — and it comes back after a while if it
 * was dismissed, without needing a refresh: the browser's prompt event is kept in
 * a ref, and a visibility change re-checks it. "Not now" really does dismiss it,
 * for three days.
 */
export function InstallBanner() {
	const [visible, setVisible] = useState(false);
	const [mode, setMode] = useState<'prompt' | 'ios'>('prompt');
	const prompt = useRef<InstallPromptEvent | null>(null);
	const dismissed = useRef(false);

	useEffect(() => {
		try {
			const at = Number(localStorage.getItem(DISMISSED_AT) ?? 0);
			if (at && Date.now() - at < QUIET_PERIOD) return;
		} catch {
			// Private mode: no memory, so it may ask again next time.
		}
		if (globalThis.matchMedia?.('(display-mode: standalone)').matches) return;

		let timer: ReturnType<typeof setTimeout> | null = null;
		const reveal = () => {
			if (!dismissed.current) setVisible(true);
		};
		const arm = (delay: number) => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(reveal, delay);
		};

		const onPrompt = (event: Event) => {
			event.preventDefault();
			prompt.current = event as InstallPromptEvent;
			setMode('prompt');
			arm(3500);
		};
		globalThis.addEventListener('beforeinstallprompt', onPrompt);

		// Safari never fires the prompt, so say the useful thing instead.
		const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
		const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		if (isIos && isSafari) {
			setMode('ios');
			arm(5000);
		}

		let interactions = 0;
		const onInteraction = () => {
			interactions += 1;
			if (interactions >= 4) reveal();
		};
		globalThis.addEventListener('click', onInteraction);

		// Coming back to the tab is a good moment to offer it again — no refresh.
		const onVisible = () => {
			if (document.visibilityState === 'visible' && prompt.current) reveal();
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			if (timer) clearTimeout(timer);
			globalThis.removeEventListener('beforeinstallprompt', onPrompt);
			globalThis.removeEventListener('click', onInteraction);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, []);

	if (!visible) return null;

	const dismiss = () => {
		dismissed.current = true;
		setVisible(false);
		try {
			localStorage.setItem(DISMISSED_AT, String(Date.now()));
		} catch {
			// Private mode: it will ask again next session.
		}
	};

	const install = async () => {
		const event = prompt.current;
		if (!event) return;
		try {
			await event.prompt();
			const choice = await event.userChoice;
			if (choice.outcome === 'accepted') setVisible(false);
			else dismiss();
		} catch {
			dismiss();
		}
	};

	return (
		<aside class="install" role="region" aria-label="Install this app">
			<span class="install__icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
					<path d="M12 3v11m0 0 4-4m-4 4-4-4" />
					<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
				</svg>
			</span>
			<p>
				<strong>Install Enigma Lab</strong>
				<span>{mode === 'prompt' ? 'Offline, full screen, no store.' : 'Share → “Add to Home Screen”.'}</span>
			</p>
			{mode === 'prompt' ? (
				<button type="button" class="button" onClick={() => void install()}>
					Install
				</button>
			) : null}
			<button type="button" class="button button--ghost" onClick={dismiss}>
				Not now
			</button>
		</aside>
	);
}
