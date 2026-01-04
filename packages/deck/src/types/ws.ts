// WebSocket message types matching the backend
export enum WSType {
	Device = 'device',
	Music = 'music',
	Control = 'control',
	Ack = 'ack',
	Heartbeat = 'heartbeat',
	DeviceState = 'deviceState',
}

export enum DeviceType {
	Link = 'link',
	Deck = 'deck',
	Server = 'server',
}

export interface DeviceWSData {
	type: WSType.Device;
	data: {
		hash: string;
		type: DeviceType;
		name: string;
		identifier: string;
	};
}

export interface MusicWSData {
	type: WSType.Music;
	data: {
		title?: string;
		artist?: string;
		duration?: number;
		position?: number;
		durationFormatted?: string;
		positionFormatted?: string;
		status?: 'playing' | 'paused' | 'stopped';
		artwork?: string | null; // undefined = keep existing, null = clear, string = new artwork
		hash: string;
	};
}

export interface DeviceStateWSData {
	type: WSType.DeviceState;
	data: {
		volume: number;
		brightness: number;
		hash: string;
	};
}

export interface ControlWSData {
	type: WSType.Control;
	data: {
		fn: string;
		args?: Record<string, unknown>;
		hash: string;
	};
}

export interface AckWSData {
	type: WSType.Ack;
}

export interface HeartbeatWSData {
	type: WSType.Heartbeat;
	data: {
		hash: string;
	};
}

export type WSData = DeviceWSData | MusicWSData | ControlWSData | AckWSData | HeartbeatWSData | DeviceStateWSData;
