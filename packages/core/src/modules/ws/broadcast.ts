import { serverHolder } from '../../server.js';
import { WSType, type SpeakWSData } from './type.js';
import { wslog } from '../../integrations/logger/index.js';

/**
 * Broadcast a speak message to all connected deck clients.
 * This is used to make Yumi speak to the user (e.g., for reminders).
 */
export function broadcastSpeak(data: { en: string; jp: string; audio: string; reason?: string }): boolean {
	const server = serverHolder.get();
	if (!server) {
		wslog.error('Cannot broadcast speak: server not available');
		return false;
	}

	const message: SpeakWSData = {
		type: WSType.Speak,
		data,
	};

	try {
		// Publish to all deck clients
		server.publish('deck', JSON.stringify(message));
		wslog.info(`Broadcasted speak message to decks: ${data.en.substring(0, 50)}...`);
		return true;
	} catch (error) {
		wslog.error(`Failed to broadcast speak: ${(error as Error).message}`);
		return false;
	}
}
