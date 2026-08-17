import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, account, notes } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { isAuthorizedAdmin, DEFAULT_ADMIN_ID, getAdminIds } from '$lib/server/auth';
import { logAdminAction } from '$lib/server/adminLogger';

export const GET: RequestHandler = async ({ locals }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: Permessi amministratore richiesti.' }, { status: 403 });
	}

	try {
		const usersList = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				role: user.role,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				stats: user.stats
			})
			.from(user)
			.orderBy(desc(user.createdAt));

		// Otteniamo per ciascun utente l'account Discord e il conteggio delle note
		const accountsList = await db
			.select({
				userId: account.userId,
				providerId: account.providerId,
				accountId: account.accountId
			})
			.from(account);

		const notesCountList = await db
			.select({
				userId: notes.userId,
				count: sql<number>`count(*)::int`
			})
			.from(notes)
			.groupBy(notes.userId);

		const adminIds = getAdminIds();

		const formattedUsers = usersList.map((u) => {
			const discordAccount = accountsList.find(
				(a) => a.userId === u.id && a.providerId === 'discord'
			);
			const userNotesCount = notesCountList.find((n) => n.userId === u.id)?.count || 0;
			const isHardcodedAdmin =
				discordAccount?.accountId && adminIds.includes(discordAccount.accountId.trim());

			const effectiveRole = isHardcodedAdmin ? 'admin' : u.role || 'user';

			return {
				id: u.id,
				name: u.name,
				email: u.email,
				image: u.image,
				role: effectiveRole,
				isHardcodedAdmin: Boolean(isHardcodedAdmin),
				discordId: discordAccount?.accountId || null,
				notesCount: userNotesCount,
				stats: u.stats || {},
				createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
				updatedAt: u.updatedAt ? u.updatedAt.toISOString() : new Date().toISOString()
			};
		});

		return json(formattedUsers, {
			headers: { 'Cache-Control': 'no-cache' }
		});
	} catch (err) {
		console.error('Errore recupero lista utenti:', err);
		return json({ error: 'Errore interno nel recupero degli utenti' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: Permessi amministratore richiesti.' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { userId, role } = body;

		if (!userId || !role || !['admin', 'user'].includes(role)) {
			return json({ error: 'Dati non validi: userId e role (admin|user) sono obbligatori' }, { status: 400 });
		}

		// Verifica utente target
		const targetUsers = await db.select().from(user).where(eq(user.id, userId));
		if (targetUsers.length === 0) {
			return json({ error: 'Utente non trovato' }, { status: 404 });
		}
		const targetUser = targetUsers[0];

		// Se l'utente target è l'admin principale hardcoded, non permettiamo di degradarlo
		if (role === 'user') {
			const accounts = await db
				.select()
				.from(account)
				.where(eq(account.userId, userId));
			const isSuperAdmin = accounts.some(
				(a) => a.providerId === 'discord' && a.accountId.trim() === DEFAULT_ADMIN_ID
			);
			if (isSuperAdmin) {
				return json(
					{ error: "Impossibile rimuovere il ruolo all'amministratore principale predefinito." },
					{ status: 400 }
				);
			}
		}

		// Aggiorniamo il ruolo nel DB
		const previousRole = targetUser.role;
		await db
			.update(user)
			.set({
				role,
				updatedAt: new Date()
			})
			.where(eq(user.id, userId));

		// Registriamo l'azione nel log
		await logAdminAction({
			userId: locals.user?.id || 'admin',
			userName: locals.user?.name || locals.user?.username || 'Admin',
			userAvatar: locals.user?.image || null,
			action: role === 'admin' ? 'set_role_admin' : 'remove_role_admin',
			targetType: 'user',
			targetId: targetUser.id,
			targetTitle: targetUser.name,
			details: {
				targetEmail: targetUser.email,
				previousRole,
				newRole: role
			}
		});

		return json({
			success: true,
			message: `Ruolo aggiornato a "${role}" per ${targetUser.name}`,
			user: {
				...targetUser,
				role
			}
		});
	} catch (err: any) {
		console.error('Errore aggiornamento ruolo utente:', err);
		return json({ error: err.message || 'Errore durante l\'aggiornamento del ruolo' }, { status: 500 });
	}
};
