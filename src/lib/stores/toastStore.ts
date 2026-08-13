import { writable } from 'svelte/store';

export interface ToastMessage {
	id: string;
	message: string;
	actionLabel?: string;
	onAction?: () => void;
	duration?: number;
}

const { subscribe, set } = writable<ToastMessage | null>(null);

let activeTimeout: ReturnType<typeof setTimeout> | null = null;

export const toastStore = {
	subscribe,
	show: (toast: Omit<ToastMessage, 'id'>) => {
		if (activeTimeout) clearTimeout(activeTimeout);
		const id = Math.random().toString(36).substring(2);
		const fullToast: ToastMessage = {
			...toast,
			id,
			duration: toast.duration ?? 3500
		};

		set(fullToast);

		activeTimeout = setTimeout(() => {
			set(null);
		}, fullToast.duration);
	},
	dismiss: () => {
		if (activeTimeout) clearTimeout(activeTimeout);
		set(null);
	}
};
