/**
 * External Dependencies
 */
import { env } from 'bun';

/**
 * Yumi Internal Packages
 */
import { Singleton } from '@yumi/patterns';

/**
 * Local Module Imports
 */
import { CommandService, type TrackInfo } from './command';
import type { DeviceData } from '../db/type';

// WS Message Types (matching core package)
enum WSType {
	Device = 'device',
	Music = 'music',
	Control = 'control',
	Ack = 'ack',
	Heartbeat = 'heartbeat',
}

type DeviceWSData = {
	type: WSType.Device;
	data: {
		hash: string;
		type: string;
		name: string;
		identifier: string;
	};
};

type MusicWSData = {
	type: WSType.Music;
	data: {
		title?: string;
		artist?: string;
		duration?: number;
		position?: number;
		status?: 'playing' | 'paused' | 'stopped';
		hash: string;
	};
};

type ControlWSData = {
	type: WSType.Control;
	data: {
		fn: string;
		args?: Record<string, unknown>;
		hash: string;
	};
};

type HeartbeatWSData = {
	type: WSType.Heartbeat;
	data: {
		hash: string;
	};
};

type AckWSData = {
	type: WSType.Ack;
};

type WSData = DeviceWSData | MusicWSData | ControlWSData | AckWSData | HeartbeatWSData;

export class WebSocketClient extends Singleton {
	private ws: WebSocket | null = null;
	private device: DeviceData | null = null;
	private commandService: CommandService;
	private reconnectTimer: Timer | null = null;
	private heartbeatInterval: Timer | null = null;
	private musicUpdateInterval: Timer | null = null;
	private serverUrl: string;
	private isConnected = false;

	protected constructor() {
		super();
		this.commandService = CommandService.getInstance();
		this.serverUrl = env.YUMI_SERVER_URL || 'ws://localhost:11000/api/ws';
	}

	/**
	 * Initialize and connect to the WebSocket server
	 * @param device - Device information
	 */
	public connect(device: DeviceData): void {
		this.device = device;
		this.#connect();
	}

	/**
	 * Disconnect from the WebSocket server
	 */
	public disconnect(): void {
		this.#cleanup();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	// ─── Private Methods ─────────────────────────────────────────────────────

	#connect(): void {
		if (this.ws && this.isConnected) {
			console.log('Already connected');
			return;
		}

		try {
			this.ws = new WebSocket(this.serverUrl);

			this.ws.onopen = () => {
				console.log('WebSocket connected');
				this.isConnected = true;
				this.#registerDevice();
				this.#startHeartbeat();
				this.#startMusicUpdates();
			};

			this.ws.onmessage = (event) => {
				this.#handleMessage(event.data);
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
			};

			this.ws.onclose = () => {
				console.log('WebSocket disconnected');
				this.isConnected = false;
				this.#cleanup();
				this.#scheduleReconnect();
			};
		} catch (error) {
			console.error('Failed to connect to WebSocket:', error);
			this.#scheduleReconnect();
		}
	}

	#registerDevice(): void {
		if (!this.device) return;

		const message: DeviceWSData = {
			type: WSType.Device,
			data: {
				hash: this.device.hash,
				type: this.device.type,
				name: this.device.name,
				identifier: this.device.hash, // Using hash as identifier
			},
		};

		this.#send(message);
		console.log('Device registered');
	}

	#startHeartbeat(): void {
		// Send heartbeat every 30 seconds
		this.heartbeatInterval = setInterval(() => {
			if (!this.device || !this.isConnected) return;

			const message: HeartbeatWSData = {
				type: WSType.Heartbeat,
				data: {
					hash: this.device.hash,
				},
			};

			this.#send(message);
		}, 30000);
	}

	#startMusicUpdates(): void {
		// Send music updates every 5 seconds
		this.musicUpdateInterval = setInterval(async () => {
			if (!this.device || !this.isConnected) return;

			const trackResult = this.commandService.getCurrentTrack();
			if (trackResult.isErr()) return;

			const track = trackResult.unwrap()!;

			const message: MusicWSData = {
				type: WSType.Music,
				data: {
					title: track.title,
					artist: track.artist,
					duration: track.duration,
					position: track.position,
					status: track.playback_status,
					hash: this.device.hash,
				},
			};

			this.#send(message);
		}, 1000);
	}

	async #handleMessage(data: string | Buffer): Promise<void> {
		try {
			const message: WSData = JSON.parse(data.toString());

			if (message.type === WSType.Control) {
				await this.#handleControlCommand(message);
			} else if (message.type === WSType.Ack) {
				console.log('Received acknowledgment from server');
			}
		} catch (error) {
			console.error('Failed to parse WebSocket message:', error);
		}
	}

	async #handleControlCommand(message: ControlWSData): Promise<void> {
		const { fn, args } = message.data;

		console.log(`Executing command: ${fn}`, args);

		const result = await this.commandService.execute(fn, args);

		if (result.isErr()) {
			console.error(`Command execution failed: ${result.unwrapErr()!.message}`);
		} else {
			console.log(`Command executed successfully: ${fn}`);
		}
	}

	#send(message: WSData): void {
		if (!this.ws || !this.isConnected) {
			console.warn('WebSocket not connected, cannot send message');
			return;
		}

		try {
			this.ws.send(JSON.stringify(message));
		} catch (error) {
			console.error('Failed to send WebSocket message:', error);
		}
	}

	#cleanup(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}

		if (this.musicUpdateInterval) {
			clearInterval(this.musicUpdateInterval);
			this.musicUpdateInterval = null;
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	#scheduleReconnect(): void {
		if (this.reconnectTimer) return;

		console.log('Reconnecting in 5 seconds...');
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.#connect();
		}, 5000);
	}
}
