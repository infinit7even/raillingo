import { writable } from "svelte/store";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastMessage {
	id: string;
	message: string;
	type?: ToastType;
	icon?: string;
	actionLabel?: string;
	onAction?: () => void;
	duration?: number;
}

const { subscribe, set } = writable<ToastMessage | null>(null);

let activeTimeout: ReturnType<typeof setTimeout> | null = null;

export const toastStore = {
	subscribe,
	show: (toast: Omit<ToastMessage, "id"> | { message: string; type?: ToastType; [key: string]: any }) => {
		if (activeTimeout) clearTimeout(activeTimeout);
		const id = Math.random().toString(36).substring(2);
		const fullToast: ToastMessage = {
			...toast,
			id,
			type: (toast as any).type ?? "info",
			duration: (toast as any).duration ?? 2200
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
