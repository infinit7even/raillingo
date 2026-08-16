import { writable } from 'svelte/store';

export interface ConfirmModalOptions {
	title?: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	confirmVariant?: 'danger' | 'primary' | 'warning';
	icon?: string;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void;
}

export interface ConfirmModalState extends ConfirmModalOptions {
	isOpen: boolean;
}

const initialState: ConfirmModalState = {
	isOpen: false,
	message: '',
	title: 'Conferma Operazione',
	confirmText: 'Elimina',
	cancelText: 'Annulla',
	confirmVariant: 'danger',
	icon: '🗑️',
	onConfirm: () => {}
};

function createConfirmModalStore() {
	const { subscribe, set } = writable<ConfirmModalState>(initialState);

	return {
		subscribe,
		open: (options: ConfirmModalOptions) => {
			set({
				isOpen: true,
				title: options.title || 'Conferma Operazione',
				message: options.message,
				confirmText: options.confirmText || 'Elimina',
				cancelText: options.cancelText || 'Annulla',
				confirmVariant: options.confirmVariant || 'danger',
				icon: options.icon || '🗑️',
				onConfirm: options.onConfirm,
				onCancel: options.onCancel
			});
		},
		close: () => {
			set(initialState);
		}
	};
}

export const confirmModalStore = createConfirmModalStore();
