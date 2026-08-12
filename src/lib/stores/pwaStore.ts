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

			window.addEventListener('beforeinstallprompt', (e: Event) => {
				e.preventDefault();
				this.deferredPrompt = e as BeforeInstallPromptEvent;
				this.notify();
			});

			window.addEventListener('appinstalled', () => {
				this.installed = true;
				this.deferredPrompt = null;
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
		return !this.standalone && !this.installed && this.deferredPrompt !== null;
	}

	public get hasDeferredPrompt(): boolean {
		return this.deferredPrompt !== null;
	}

	public subscribe(run: () => void): () => void {
		this.listeners.add(run);
		run();
		return () => {
			this.listeners.delete(run);
		};
	}

	public async promptInstall(): Promise<boolean> {
		if (!this.deferredPrompt) return false;
		try {
			await this.deferredPrompt.prompt();
			const choice = await this.deferredPrompt.userChoice;
			if (choice.outcome === 'accepted') {
				this.installed = true;
				this.deferredPrompt = null;
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
