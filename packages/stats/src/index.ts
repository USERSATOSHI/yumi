import { StatsDB } from './db';
import { Singleton } from '@yumi/patterns';

import type { CommandStats, DashboardStats, DeviceStats, SystemStats } from './types';

export type { CommandStats, DeviceStats, DashboardStats, SystemStats } from './types';
export { StatsDB } from './db';

export class Stats extends Singleton {
	private db: StatsDB;
	activeConnections: number = 0;

	constructor(dbPath?: string) {
		super();
		this.db = new StatsDB(dbPath);
	}

	// ─── Record Events ───────────────────────────────────────────────────────

	recordCommand(name: string, deviceHash: string, success: boolean, executionMs: number) {
		this.db.recordCommand(name, deviceHash, success, executionMs);
	}

	registerDevice(hash: string, name: string, type: string) {
		this.db.upsertDevice(hash, name, type);
	}

	deviceHeartbeat(hash: string) {
		this.db.updateDeviceLastSeen(hash);
	}

	// ─── Connection Tracking ─────────────────────────────────────────────────

	connectionOpened() {
		this.activeConnections++;
	}

	connectionClosed() {
		this.activeConnections = Math.max(0, this.activeConnections - 1);
	}

	// ─── Dashboard Queries ───────────────────────────────────────────────────

	getCommandStats(): CommandStats {
		const today = this.db.getCommandsToday();
		const mostUsed = this.db.getMostUsedCommandToday();
		const last = this.db.getLastCommand();

		return {
			totalToday: today.total,
			successCount: today.success_count,
			failCount: today.fail_count,
			mostUsed: mostUsed ? { name: mostUsed.name, count: mostUsed.count } : null,
			lastExecuted: last
				? { name: last.name, deviceHash: last.device_hash, success: last.success === 1, at: last.created_at }
				: null,
		};
	}

	getDeviceStats(onlineThresholdMs?: number): DeviceStats {
		return this.db.getDeviceStats(onlineThresholdMs);
	}

	getSystemStats(): SystemStats {
		const mem = process.memoryUsage();

		return {
			uptimeSeconds: Math.floor(process.uptime()),
			memoryUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
			memoryTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
			activeConnections: this.activeConnections,
		};
	}

	getDashboardStats(): DashboardStats {
		return {
			commands: this.getCommandStats(),
			devices: this.getDeviceStats(),
			core: this.getSystemStats(),
		};
	}

	// ─── Maintenance ─────────────────────────────────────────────────────────

	purgeOldData(daysToKeep: number = 7) {
		return this.db.purgeOldCommands(daysToKeep);
	}

	close() {
		this.db.close();
	}
}

export function createStats(dbPath?: string): Stats {
	return Stats.getInstance(dbPath);
}
