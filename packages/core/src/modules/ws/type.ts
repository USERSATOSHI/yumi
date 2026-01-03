import type { DeviceType } from "../../pool/devices/index.js";

export enum WSType {
	Device = "device",
	Music = "music",
	Control = "control",
	Ack = "ack",
	Heartbeat = "heartbeat",
	DeviceState = "deviceState",
}

export type DeviceWSData = {
	type: WSType.Device;
	data: {
		hash: string;
		type: DeviceType;
		name: string;
		identifier: string;
	}
}

export type MusicWSData = {
	type: WSType.Music;
	data: {
		title?: string;
		artist?: string;
		duration?: number;
		position?: number;
		status?: 'playing' | 'paused' | 'stopped';
		artwork?: string;
		hash: string;
	}
}

export type DeviceStateWSData = {
	type: WSType.DeviceState;
	data: {
		volume: number;
		brightness: number;
		hash: string;
	}
}

export type ControlWSData = {
	type: WSType.Control;
	data: {
		fn: string;
		args?: Record<string, unknown>;
		hash: string;
	}
}

export type AckWSData = {
	type: WSType.Ack;
}

export type HeartbeatWSData = {
	type: WSType.Heartbeat;
	data: {
		hash: string;
	}
}

export type WSData = DeviceWSData | MusicWSData | ControlWSData | AckWSData | HeartbeatWSData | DeviceStateWSData;