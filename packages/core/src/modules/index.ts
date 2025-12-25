import { Elysia } from "elysia";
import device from "./device/index.js";
import speak from "./speak/index.js";
import stats from "./stats/index.js";
import { ws } from "./ws/index.js";

const router = new Elysia({
	prefix: '/api'
})
	.use(device)
	.use(speak)
	.use(stats)
	.use(ws);

export default router;