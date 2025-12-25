import Elysia from 'elysia';
import { logger, wslog } from '../../integrations/logger/index.js';
import { devicePool } from '../../pool/devices/index.js';
import { statDB } from '../../db/index.js';
import { Websocket } from './service.js';

export const ws = new Elysia({
	prefix: '/ws',
}).ws('/', {
	open(ws) {
		try {
			statDB.connectionOpened();
			wslog.info(`WebSocket connection opened: ${ws.id}`);
		} catch (err) {
			wslog.error(`Error in WebSocket open handler: ${(err as Error).message}`);
		}
	},

	close(ws) {
		try {
			statDB.connectionClosed();
			devicePool.remove(ws.id);
			wslog.info(`WebSocket connection closed: ${ws.id}`);
		} catch (err) {
			wslog.error(`Error in WebSocket close handler: ${(err as Error).message}`);
		}
	},
	async message(ws, message) {
		try {
			const msg = typeof message === 'string' ? message : JSON.stringify(message);
			await Websocket.handle(ws, msg);
		} catch (err) {
			wslog.error(`Error in WebSocket message handler: ${(err as Error).message}`);
		}
	},
});
