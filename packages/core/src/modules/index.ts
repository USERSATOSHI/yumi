import { Elysia } from "elysia";
import device from "./device/index.js";
import speak from "./speak/index.js";
import stats from "./stats/index.js";
import { ws } from "./ws/index.js";
import { artwork } from "./artwork/index.js";
import reminders from "./reminders/index.js";
import todos from "./todos/index.js";

const router = new Elysia({
	prefix: '/api'
})
	.use(device)
	.use(speak)
	.use(stats)
	.use(ws)
	.use(artwork)
	.use(reminders)
	.use(todos);

export default router;