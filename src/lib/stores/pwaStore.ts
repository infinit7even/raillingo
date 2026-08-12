import { browser } from '$app/environment';

export interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{
		outcome: 'accepted' | 'dismissed';
		platform: string;
	}>;
	prompt(): Promise<void>;
}

class PwaStore {
	private deferredPrompt: BeforeInstallPromptEvent | null = null;
	private installed = false;
	private standalone = false;
	private listeners = new Set<() => void>();

	constructor() {
		if (browser) {
			this.checkStandalone();

			if ((window as any).deferredPwaPrompt) {
				this.deferredPrompt = (window as any).deferredPwaPrompt;
			}

			window.addEventListener('beforeinstallprompt', (e: Event) => {
				e.preventDefault();
				(window as any).deferredPwaPrompt = e;
				this.deferredPrompt = e as BeforeInstallPromptEvent;
				this.notify();
			});

			window.addEventListener('pwa-prompt-ready', () => {
				if ((window as any).deferredPwaPrompt) {
					this.deferredPrompt = (window as any).deferredPwaPrompt;
					this.notify();
				}
			});

			window.addEventListener('appinstalled', () => {
				this.installed = true;
				this.deferredPrompt = null;
				(window as any).deferredPwaPrompt = null;
				this.notify();
			});
		}
	}

	private checkStandalone() {
		if (!browser) return;
		// Rileva se l'app è in modalità standalone (installata e aperta come app)
		const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
		const isIOSStandalone = (navigator as any).standalone === true;
		this.standalone = isStandaloneMedia || isIOSStandalone;
	}

	public get isStandalone(): boolean {
		return this.standalone;
	}

	public get canInstall(): boolean {
		return (
			!this.standalone &&
			!this.installed &&
			(this.deferredPrompt !== null || (browser && (window as any).deferredPwaPrompt !== null))
		);
	}

	public subscribe(run: () => void): () => void {
		this.listeners.add(run);
		run();
		return () => {
			this.listeners.delete(run);
		};
	}

	public async promptInstall(): Promise<boolean> {
		const prompt = this.deferredPrompt || (browser ? (window as any).deferredPwaPrompt : null);
		if (!prompt) return false;

		try {
			await prompt.prompt();
			const choice = await prompt.userChoice;
			if (choice.outcome === 'accepted') {
				this.installed = true;
				this.deferredPrompt = null;
				if (browser) (window as any).deferredPwaPrompt = null;
				this.notify();
				return true;
			}
		} catch (err) {
			console.error('Errore durante prompt installazione PWA:', err);
		}
		return false;
	}

	private notify() {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

export const pwaStore = new PwaStore();
