// core entry
import {Elysia} from "elysia";
import { cors } from '@elysiajs/cors';
import { env } from "bun";
import {swagger } from '@elysiajs/swagger';
import router from "./modules/index.js";
import { serverHolder } from "./server.js";
import { reminderPool } from "./pool/reminders/index.js";
import { Speak } from "./modules/speak/service.js";
import { setTaskStorage } from "@yumi/tasks";
import { coreTaskStorage } from "./tools/task-storage-adapter.js";

// Initialize @yumi/tasks with core's storage adapter
setTaskStorage(coreTaskStorage);

const app = new Elysia()
	.use(
		cors()
	).use(router);

// Only start the server when this is the main entry point
if (import.meta.main) {
	app.listen(env.PORT ? Number(env.PORT) : 11000);
	serverHolder.set(app.server);
	
	// Set up reminder callback to speak when reminders are due
	reminderPool.setOnReminder(async (reminder) => {
		console.log(`Reminder due: ${reminder.title}`);
		await Speak.speakReminder(reminder);
	});
	
	console.log(`Core module running at http://localhost:${app.server?.port}`);
}