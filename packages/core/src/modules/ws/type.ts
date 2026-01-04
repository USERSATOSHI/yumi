import type { DeviceType } from "../../pool/devices/index.js";

export enum WSType {
	Device = "device",
	Music = "music",
	Control = "control",
	Ack = "ack",
	Heartbeat = "heartbeat",
	DeviceState = "deviceState",
	Speak = "speak",
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
		durationFormatted?: string;
		positionFormatted?: string;
		status?: 'playing' | 'paused' | 'stopped';
		artwork?: string | null; // undefined = omit, null = clear, string = URL or base64
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

export type SpeakWSData = {
	type: WSType.Speak;
	data: {
		en: string;      // English transcript
		jp: string;      // Japanese text (for TTS)
		audio: string;   // Audio URL
		reason?: string; // Optional reason (e.g., "reminder")
	}
}

export type WSData = DeviceWSData | MusicWSData | ControlWSData | AckWSData | HeartbeatWSData | DeviceStateWSData | SpeakWSData;