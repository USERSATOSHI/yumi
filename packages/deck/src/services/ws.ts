import { WSType, DeviceType, type WSData } from '../types/ws';

type MessageHandler = (data: WSData) => void;
type ConnectionHandler = () => void;

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://yumi.home.usersatoshi.in/api/ws';
const DEVICE_IDENTIFIER = "67ccdf6888bd2d7c8bed7d7219ca42529ef4f37007e510f84b5dfbec773e6f151daa1e4a013a0e622a735dcdb67eeb47b697391946349f035c97cc843902d448"
const DEVICE_NAME = import.meta.env.VITE_YUMI_DECK_NAME || 'Yumi Deck';
const STORAGE_KEY = 'yumi_deck_hash';

class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private messageHandlers: Set<MessageHandler> = new Set();
	private connectionHandlers: Set<ConnectionHandler> = new Set();
	private disconnectionHandlers: Set<ConnectionHandler> = new Set();
	private _isConnected = false;
	private _deviceHash: string;

	constructor() {
		// Get or generate a persistent hash for this deck instance
		this._deviceHash = this.getOrCreateHash();
	}

	private getOrCreateHash(): string {
		let hash = localStorage.getItem(STORAGE_KEY);
		if (!hash) {
			// Generate hash from identifier + random suffix (only once)
			hash = `deck-${DEVICE_IDENTIFIER.slice(0, 16)}-${Date.now().toString(36)}`;
			localStorage.setItem(STORAGE_KEY, hash);
		}
		return hash;
	}

	get isConnected(): boolean {
		return this._isConnected;
	}

	get deviceHash(): string {
		return this._deviceHash;
	}

	connect(): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			console.log('WebSocket already connected');
			return;
		}

		try {
			this.ws = new WebSocket(WS_URL);

			this.ws.onopen = () => {
				console.log('WebSocket connected');
				this._isConnected = true;
				this.register();
				this.startHeartbeat();
				this.connectionHandlers.forEach((handler) => handler());
			};

			this.ws.onclose = () => {
				console.log('WebSocket disconnected');
				this._isConnected = false;
				this.stopHeartbeat();
				this.disconnectionHandlers.forEach((handler) => handler());
				this.scheduleReconnect();
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as WSData;
					this.messageHandlers.forEach((handler) => handler(data));
				} catch (error) {
					console.error('Failed to parse WebSocket message:', error);
				}
			};
		} catch (error) {
			console.error('Failed to connect WebSocket:', error);
			this.scheduleReconnect();
		}
	}

	disconnect(): void {
		this.stopHeartbeat();
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this._isConnected = false;
	}

	private register(): void {
		this.send({
			type: WSType.Device,
			data: {
				hash: this._deviceHash,
				type: DeviceType.Deck,
				name: DEVICE_NAME,
				identifier: DEVICE_IDENTIFIER,
			},
		});
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatInterval = setInterval(() => {
			this.send({
				type: WSType.Heartbeat,
				data: {
					hash: this._deviceHash,
				},
			});
		}, 30000); // Every 30 seconds
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimeout) return;
		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null;
			console.log('Attempting to reconnect...');
			this.connect();
		}, 3000);
	}

	send(data: WSData): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		} else {
			console.warn('WebSocket not connected, cannot send message');
		}
	}

	// Send a control command to a specific device or broadcast to device type
	sendControl(fn: string, targetHash: string, args?: Record<string, unknown>): void {
		this.send({
			type: WSType.Control,
			data: {
				fn,
				args,
				hash: targetHash,
			},
		});
	}

	// Send control to all links
	sendToLinks(fn: string, args?: Record<string, unknown>): void {
		this.sendControl(fn, DeviceType.Link, args);
	}

	// Subscribe to messages
	onMessage(handler: MessageHandler): () => void {
		this.messageHandlers.add(handler);
		return () => this.messageHandlers.delete(handler);
	}

	// Subscribe to connection events
	onConnect(handler: ConnectionHandler): () => void {
		this.connectionHandlers.add(handler);
		return () => this.connectionHandlers.delete(handler);
	}

	// Subscribe to disconnection events
	onDisconnect(handler: ConnectionHandler): () => void {
		this.disconnectionHandlers.add(handler);
		return () => this.disconnectionHandlers.delete(handler);
	}
}

// Singleton instance
export const wsService = new WebSocketService();

// Auto-connect on import
wsService.connect();

// Clean up on page unload/refresh
window.addEventListener('beforeunload', () => {
	wsService.disconnect();
});

// Also handle visibility change (for mobile browsers)
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden') {
		wsService.disconnect();
	} else if (document.visibilityState === 'visible') {
		wsService.connect();
	}
});
