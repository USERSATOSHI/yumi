// Stats types matching the backend response
export interface CommandStats {
	totalToday: number;
	successCount: number;
	failCount: number;
	mostUsed: { name: string; count: number } | null;
	lastExecuted: {
		name: string;
		deviceHash: string;
		success: boolean;
		at: number;
	} | null;
}

export interface DeviceStats {
	total: number;
	online: number;
	offline: number;
	byType: Record<string, number>;
	devices: {
		hash: string;
		name: string;
		type: string;
		online: boolean;
		lastSeen: number;
	}[];
	lastActivity: {
		deviceHash: string;
		deviceName: string;
		at: number;
	} | null;
}

export interface SystemStats {
	uptimeSeconds: number;
	memoryUsedMb: number;
	memoryTotalMb: number;
	activeConnections: number;
}

export interface StatsResponse {
	commands: CommandStats;
	devices: DeviceStats;
	core: SystemStats;
}
