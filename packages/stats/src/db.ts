import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dataDir = process.env.YUMI_DATA_DIR ?? join(process.cwd(), '.yumi');
const dbPath = join(dataDir, 'stats.sqlite');

export class StatsDB {
	private db: Database;

	constructor(path: string = dbPath) {
		mkdirSync(dirname(path), { recursive: true });
		this.db = new Database(path);
		this.setupPragmas();
		this.createSchema();
	}

	private setupPragmas() {
		this.db.exec('PRAGMA journal_mode = WAL');
		this.db.exec('PRAGMA synchronous = NORMAL');
	}

	private createSchema() {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS commands (
				id INTEGER PRIMARY KEY,
				name TEXT NOT NULL,
				device_hash TEXT NOT NULL,
				success INTEGER NOT NULL,
				execution_ms INTEGER NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_commands_created_at ON commands (created_at)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_commands_name ON commands (name)
		`);

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS devices (
				hash TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				type TEXT NOT NULL,
				last_seen INTEGER NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);
	}

	// ─── Commands ────────────────────────────────────────────────────────────

	recordCommand(name: string, deviceHash: string, success: boolean, executionMs: number) {
		this.db.prepare(`
			INSERT INTO commands (name, device_hash, success, execution_ms, created_at)
			VALUES ($name, $deviceHash, $success, $executionMs, $createdAt)
		`).run({
			$name: name,
			$deviceHash: deviceHash,
			$success: success ? 1 : 0,
			$executionMs: executionMs,
			$createdAt: Date.now(),
		});
	}

	getCommandsToday() {
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);

		return this.db.prepare(`
			SELECT COUNT(*) as total,
				   SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
				   SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as fail_count
			FROM commands
			WHERE created_at >= $startOfDay
		`).get({ $startOfDay: startOfDay.getTime() }) as {
			total: number;
			success_count: number;
			fail_count: number;
		};
	}

	getMostUsedCommandToday() {
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);

		return this.db.prepare(`
			SELECT name, COUNT(*) as count
			FROM commands
			WHERE created_at >= $startOfDay
			GROUP BY name
			ORDER BY count DESC
			LIMIT 1
		`).get({ $startOfDay: startOfDay.getTime() }) as { name: string; count: number } | null;
	}

	getLastCommand() {
		return this.db.prepare(`
			SELECT name, device_hash, success, created_at
			FROM commands
			ORDER BY created_at DESC
			LIMIT 1
		`).get() as { name: string; device_hash: string; success: number; created_at: number } | null;
	}

	// ─── Devices ─────────────────────────────────────────────────────────────

	upsertDevice(hash: string, name: string, type: string) {
		const now = Date.now();

		this.db.prepare(`
			INSERT INTO devices (hash, name, type, last_seen, created_at)
			VALUES ($hash, $name, $type, $now, $now)
			ON CONFLICT(hash) DO UPDATE SET
				name = $name,
				type = $type,
				last_seen = $now
		`).run({
			$hash: hash,
			$name: name,
			$type: type,
			$now: now,
		});
	}

	updateDeviceLastSeen(hash: string) {
		this.db.prepare(`
			UPDATE devices SET last_seen = $now WHERE hash = $hash
		`).run({ $hash: hash, $now: Date.now() });
	}

	getDeviceStats(onlineThresholdMs: number = 5 * 60 * 1000) {
		const now = Date.now();
		const threshold = now - onlineThresholdMs;

		const counts = this.db.prepare(`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN last_seen >= $threshold THEN 1 ELSE 0 END) as online,
				SUM(CASE WHEN last_seen < $threshold THEN 1 ELSE 0 END) as offline
			FROM devices
		`).get({ $threshold: threshold }) as { total: number; online: number; offline: number };

		const byType = this.db.prepare(`
			SELECT type, COUNT(*) as count
			FROM devices
			GROUP BY type
		`).all() as { type: string; count: number }[];

		const devices = this.db.prepare(`
			SELECT hash, name, type, last_seen
			FROM devices
			ORDER BY last_seen DESC
		`).all() as { hash: string; name: string; type: string; last_seen: number }[];

		const lastActivity = this.db.prepare(`
			SELECT hash, name, last_seen
			FROM devices
			ORDER BY last_seen DESC
			LIMIT 1
		`).get() as { hash: string; name: string; last_seen: number } | null;

		return {
			total: counts.total,
			online: counts.online || 0,
			offline: counts.offline || 0,
			byType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
			devices: devices.map((d) => ({
				hash: d.hash,
				name: d.name,
				type: d.type,
				online: d.last_seen >= threshold,
				lastSeen: d.last_seen,
			})),
			lastActivity: lastActivity
				? { deviceHash: lastActivity.hash, deviceName: lastActivity.name, at: lastActivity.last_seen }
				: null,
		};
	}

	// ─── Cleanup ─────────────────────────────────────────────────────────────

	purgeOldCommands(daysToKeep: number = 7) {
		const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
		return this.db.prepare(`DELETE FROM commands WHERE created_at < $cutoff`).run({ $cutoff: cutoff });
	}

	close() {
		this.db.close();
	}
}
