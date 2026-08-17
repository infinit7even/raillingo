import { db } from '$lib/server/db';
import { adminLogs } from '$lib/server/db/schema';

export interface LogAdminActionParams {
	userId: string;
	userName: string;
	userAvatar?: string | null;
	action: string;
	targetType?: string;
	targetId?: string | null;
	targetTitle?: string | null;
	details?: Record<string, any>;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
	try {
		const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
		await db.insert(adminLogs).values({
			id,
			userId: params.userId,
			userName: params.userName || 'Admin',
			userAvatar: params.userAvatar || null,
			action: params.action,
			targetType: params.targetType || 'card',
			targetId: params.targetId || null,
			targetTitle: params.targetTitle || null,
			details: params.details || {},
			createdAt: new Date()
		});
	} catch (err) {
		console.error('Errore durante la registrazione del log admin:', err);
	}
}
