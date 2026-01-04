import type { Server } from 'bun';

/**
 * Server reference holder to avoid circular imports.
 * The main app sets this after starting the server.
 */
class ServerHolder {
	#server: Server<any> | null = null;

	set(server: Server<any> | null) {
		this.#server = server;
	}

	get(): Server<any> | null {
		return this.#server;
	}
}

export const serverHolder = new ServerHolder();
