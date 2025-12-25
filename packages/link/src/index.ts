import { DB } from './db';
import { WebSocketClient } from './services/websocket';

async function main() {
	console.log('Starting Yumi Link...');

	const db = new DB();
	const deviceResult = db.getOrCreateDevice();

	if (deviceResult.isErr()) {
		console.error('Failed to get device:', deviceResult.unwrapErr()!.message);
		process.exit(1);
	}

	const device = deviceResult.unwrap()!;
	console.log('Device:', device);

	const wsClient = WebSocketClient.getInstance();
	wsClient.connect(device);

	console.log('Yumi Link started successfully');
}

main().catch(console.error);
