import { browser } from '$app/environment';

class TextToSpeechService {
	private speaking = false;

	public speak(text: string) {
		if (!browser || !('speechSynthesis' in window)) {
			console.warn('Sintesi vocale non supportata da questo browser.');
			return;
		}

		// Stop any ongoing speech
		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = 'it-IT';
		utterance.rate = 0.95; // Slightly clear and natural speed
		utterance.pitch = 1.0;

		utterance.onstart = () => {
			this.speaking = true;
		};

		utterance.onend = () => {
			this.speaking = false;
		};

		utterance.onerror = (e) => {
			console.error('Errore durante la sintesi vocale:', e);
			this.speaking = false;
		};

		window.speechSynthesis.speak(utterance);
	}

	public stop() {
		if (browser && 'speechSynthesis' in window) {
			window.speechSynthesis.cancel();
			this.speaking = false;
		}
	}

	public get isSpeaking(): boolean {
		return this.speaking;
	}
}

export const tts = new TextToSpeechService();
