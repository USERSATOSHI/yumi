// core entry
import {Elysia} from "elysia";
import { cors } from '@elysiajs/cors';
import { env } from "bun";
import {swagger } from '@elysiajs/swagger';
import router from "./modules/index.js";


const app = new Elysia()
	.use(
		cors()
	).use(router)
	.listen(env.PORT ? Number(env.PORT) : 11000);

console.log(`Core module running at http://localhost:${app.server?.port}`);