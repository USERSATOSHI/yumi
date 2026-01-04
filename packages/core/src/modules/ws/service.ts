import { safe, type ErrorBase, type Result } from "@yumi/results";
import type { ElysiaWS } from "elysia/ws";
import { logger, wslog } from "../../integrations/logger/index.js";
import { WSType, type AckWSData, type ControlWSData, type DeviceWSData, type DeviceStateWSData, type HeartbeatWSData, type MusicWSData, type WSData } from "./type.js";
import { devicePool, DeviceType } from "../../pool/devices/index.js";
import { statDB } from "../../db/index.js";
import { executeCommand, relayCommand } from "../../command/handler.js";
import { artworkCache } from "./artwork.js";

export abstract class Websocket {
	static async handle(ws: ElysiaWS, message: string): Promise<void> {
		const parse = JSON.parse.bind(JSON);
		const dataResult = safe(parse, message) as Result<WSData, ErrorBase>;
		if (dataResult.isErr()) {
			wslog.error(`Failed to parse websocket message: ${dataResult.unwrapErr()!.message}`);
			return;
		}

		const data = dataResult.unwrap()!;
		wslog.info(`Received websocket message: ${message}`);

		try {
			await this.#process(ws, data);
		} catch (err) {
			const error = err as Error;
			wslog.error(`Error processing websocket message: ${error.message}`);
		}
	}

	static async #process(ws: ElysiaWS, data: WSData): Promise<void> {
		switch (data.type) {
			case WSType.Device:
				return this.#handleDevice(ws, data);
			case WSType.Music:
				return this.#handleMusic(ws, data);
			case WSType.Control:
				return this.#handleControl(ws, data);
			case WSType.Heartbeat:
				return this.#handleHeartbeat(ws, data);
			case WSType.DeviceState:
				return this.#handleDeviceState(ws, data);
			default:
				wslog.warn(`Unknown websocket message type: ${(data as any).type}`);
		}
	}

	static async #handleDevice(ws: ElysiaWS, data: DeviceWSData): Promise<void> {
		const end = wslog.time();

		if (devicePool.has(ws.id)) {
			wslog.withMetrics({ duration: end() }).info(`Device exists in pool: ${ws.id}`);
			ws.close(1000, 'Device already connected');
			return;
		}

		devicePool.add(ws.id, data.data);
		ws.subscribe(data.data.hash);
		ws.subscribe(data.data.type);
		wslog.withMetrics({ duration: end() }).info(`Device added to pool: ${data.data.hash}`);
	}

	static async #handleMusic(ws: ElysiaWS, data: MusicWSData): Promise<void> {
		const end = wslog.time();
		
		const deviceResult = devicePool.get(ws.id);
		if (deviceResult.isErr()) {
			wslog.withMetrics({ duration: end() }).warn(`Device not found in pool for music update: ${ws.id}`);
			ws.close(1000, 'Device not registered');
			return;
		}

		// Handle artwork caching - convert base64 to URL
		const artworkUrl = artworkCache.set(
			data.data.hash,
			data.data.artwork,
			data.data.title,
			data.data.artist
		);
		
		// Build the forwarded message
		const forwardData: MusicWSData = {
			type: WSType.Music,
			data: {
				...data.data,
			}
		};
		
		// Only include artwork field if we have a URL or need to clear
		if (artworkUrl !== undefined) {
			forwardData.data.artwork = artworkUrl;
		} else {
			// Don't include artwork field - deck will keep existing
			delete forwardData.data.artwork;
		}

		// forward the music update to decks
		wslog.withMetrics({ duration: end() }).info(`Music update received for device ${data.data.hash}: ${data.data.title} by ${data.data.artist}`);
		ws.publish('deck', JSON.stringify(forwardData));
	}

	static async #handleDeviceState(ws: ElysiaWS, data: DeviceStateWSData): Promise<void> {
		const end = wslog.time();
		
		const deviceResult = devicePool.get(ws.id);
		if (deviceResult.isErr()) {
			wslog.withMetrics({ duration: end() }).warn(`Device not found in pool for device state: ${ws.id}`);
			ws.close(1000, 'Device not registered');
			return;
		}

		// forward the device state to decks
		wslog.withMetrics({ duration: end() }).info(`Device state received for ${data.data.hash}: vol=${data.data.volume}% brightness=${data.data.brightness}%`);
		ws.publish('deck', JSON.stringify(data));
	}

	static async #handleControl(ws: ElysiaWS, data: ControlWSData): Promise<void> {
		const end = wslog.time();

		const deviceResult = devicePool.get(ws.id);
		if (deviceResult.isErr()) {
			wslog.withMetrics({ duration: end() }).warn(`Device not found in pool for control command: ${ws.id}`);
			ws.close(1000, 'Device not registered');
			return;
		}

		const device = deviceResult.unwrap()!;
		if (device.type === DeviceType.Deck) {
			// forward control commands to the link 
			if (data.data.hash === DeviceType.Link) {
				// broadcast to all links
				relayCommand(data.data.fn, device.hash, DeviceType.Link);
				ws.publish(device.hash, JSON.stringify(data));
				wslog.withMetrics({ duration: end() }).info(`Control command broadcasted to links from deck ${device.hash}: ${data.data.fn}`);
			} else {
				relayCommand(data.data.fn, device.hash, data.data.hash);
				ws.publish(data.data.hash, JSON.stringify(data));
				wslog.withMetrics({ duration: end() }).info(`Control command sent to device ${data.data.hash} from deck ${device.hash}: ${data.data.fn}`);
			}
		} else if (device.type === DeviceType.Link) {
			await executeCommand(data.data.fn, data.data.args || {}, device.hash, ws);
			wslog.withMetrics({ duration: end() }).info(`Control command sent to server from link ${device.hash}: ${data.data.fn}`);
		}
	}

	static async #handleHeartbeat(ws: ElysiaWS, data: HeartbeatWSData): Promise<void> {
		const end = wslog.time();

		const deviceResult = devicePool.get(ws.id);
		if (deviceResult.isErr()) {
			wslog.withMetrics({ duration: end() }).warn(`Device not found in pool for heartbeat message: ${ws.id}`);
			ws.close(1000, 'Device not registered');
			return;
		}

		const device = deviceResult.unwrap()!;
		statDB.deviceHeartbeat(device.hash);
		wslog.withMetrics({ duration: end() }).info(`Ack message received from device ${device.hash}`);
		ws.publish(data.data.hash, JSON.stringify({ type: WSType.Ack } as AckWSData));
	}
}