// core entry
import {Elysia} from "elysia";
import { cors } from '@elysiajs/cors';
import { env } from "bun";
import {swagger } from '@elysiajs/swagger';
import router from "./modules/index.js";
import { serverHolder } from "./server.js";


const app = new Elysia()
	.use(
		cors()
	).use(router);

// Only start the server when this is the main entry point
if (import.meta.main) {
	app.listen(env.PORT ? Number(env.PORT) : 11000);
	serverHolder.set(app.server);
	console.log(`Core module running at http://localhost:${app.server?.port}`);
}