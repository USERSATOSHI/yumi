import { t } from 'elysia';

export namespace StatsModel {
	export const commandStats = t.Object({
		totalToday: t.Number(),
		successCount: t.Number(),
		failCount: t.Number(),
		mostUsed: t.Nullable(t.Object({ name: t.String(), count: t.Number() })),
		lastExecuted: t.Nullable(t.Object({
			name: t.String(),
			deviceHash: t.String(),
			success: t.Boolean(),
			at: t.Number(),
		})),
	});

	export const deviceStats = t.Object({
		total: t.Number(),
		online: t.Number(),
		offline: t.Number(),
		byType: t.Record(t.String(), t.Number()),
		devices: t.Array(t.Object({
			hash: t.String(),
			name: t.String(),
			type: t.String(),
			online: t.Boolean(),
			lastSeen: t.Number(),
		})),
		lastActivity: t.Nullable(t.Object({
			deviceHash: t.String(),
			deviceName: t.String(),
			at: t.Number(),
		})),
	});

	export const systemStats = t.Object({
		uptimeSeconds: t.Number(),
		memoryUsedMb: t.Number(),
		memoryTotalMb: t.Number(),
		activeConnections: t.Number(),
	});

	export const response = t.Object({
		commands: commandStats,
		devices: deviceStats,
		core: systemStats,
	});

	export type Response = typeof response.static;
}
