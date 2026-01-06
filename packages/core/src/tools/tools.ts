/**
 * Local Module Imports
 */
import type Elysia from 'elysia';
import { createControlCommand, createMediaCommand } from '../command/index.js';
import ledfx, { LedFxScene, type LedFx } from '../integrations/ledfx';
import { devicePool } from '../pool/devices/index.js';
import { reminderPool } from '../pool/reminders/index.js';
import { todoPool } from '../pool/todos/index.js';
import { type ElysiaWS } from 'elysia/ws';
import { mediaStatePool } from '../pool/media/index.js';

/**
 * Change the scene of a WLED light using LEDfx.
 *
 * This function changes the scene of a WLED light identified by its hash this allows for changing the visuals of room lighting.
 *
 * @param params.deviceHash - unique identifier of the device that is running the LEDfx instance
 * @param params.sceneName - name of the scene to change to
 * @returns Result<void, Error> - Result object indicating success or failure
 *
 * @example
 * ```ts
 * // Make the room a bit cozy
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'cozy' });
 *
 * // Set a party mood
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'party' });
 *
 * // time for work
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'work' });
 *
 * // turn off the lights
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'sleep' });
 * ```
 */
export async function changeLedFxScene({
	deviceHash,
	sceneName,
}: {
	deviceHash: string;
	sceneName: Parameters<LedFx['switch']>[1];
}): Promise<string> {
	const result = await ledfx.switch(deviceHash, sceneName);
	return result.unwrap() || '';
}

/**
 * Get current time in local format.
 *
 * @intent TIME_GET
 * @returns string - Current time in local format
 *
 * @example
 * ```ts
 * getCurrentTime();
 * ```
 */
export function getCurrentTime(): string {
	return new Date().toLocaleString();
}

/**
 * create a reminder message
 *
 * @intent REMINDER_ADD
 * @param params.message - the reminder message
 * @param params.remindAt - time to remind in hh:mm format
 * @param params.repeat - optional repeat interval ('daily', 'weekly', 'monthly', 'yearly')
 * @returns string - formatted reminder message
 *
 * @example
 * ```ts
 * addReminder({ message: "Meeting with team", remindAt: "15:00" });
 * ```
 */
export function addReminder({
	message,
	remindAt,
	repeat,
}: {
	message: string;
	remindAt: string;
	repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}) {
	const [hours, minutes] = remindAt.split(':').map(Number) as [number, number];
	const now = new Date();
	// check if time has already passed today
	if (hours < now.getHours() || (hours === now.getHours() && minutes <= now.getMinutes())) {
		// set for tomorrow
		now.setDate(now.getDate() + 1);
	}
	const remindAtDate = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		hours,
		minutes,
		0,
		0,
	);
	reminderPool.add(message, remindAtDate.getTime(), { repeat });
	return `Reminder set for ${remindAtDate.toLocaleString()}${repeat ? `, repeating ${repeat}` : ''}: "${message}"`;
}

/**
 * get upcoming reminders
 *
 * @intent REMINDER_LIST
 * @param params.limit - number of upcoming reminders to retrieve
 * @returns string - formatted list of upcoming reminders
 *
 * @example
 * ```ts
 * const reminders = getUpcomingReminders({ limit: 5 });
 * console.log(reminders);
 * ```
 */
export function getUpcomingReminders({ limit = 5 }: { limit?: number } = {}): string {
	const reminders = reminderPool
		.list()
		.filter((r) => !r.completed)
		.sort((a, b) => a.remindAt - b.remindAt)
		.slice(0, limit);

	if (reminders.length === 0) {
		return 'No upcoming reminders.';
	}

	let result = 'Upcoming Reminders:\n';
	for (const r of reminders) {
		const remindDate = new Date(r.remindAt);
		result += `- [${r.id}] "${r.title}" at ${remindDate.toLocaleString()}${r.repeat ? ` (repeats ${r.repeat})` : ''}\n`;
	}
	return result.trim();
}

/**
 * Delete a reminder
 *
 * @intent REMINDER_DELETE
 * @param params.title - title of the reminder to delete
 * @returns string - result message
 *
 * @example
 * ```ts
 * deleteReminder({ title: "Meeting with team" });
 * ```
 */
export function deleteReminder({ title }: { title: string }): string {
	const result = reminderPool.delete(title);
	if (result.isErr()) {
		return `Error deleting reminder: ${result.unwrapErr()!.message}`;
	}
	return `Reminder "${title}" deleted successfully.`;
}

/**
 *
 */

/**
 * Create to-do list item
 *
 * @intent TODO_ADD
 * @param params.task - the task description
 * @param params.priority - 'low' | 'medium' | 'high'
 *
 * @return string - formatted to-do list item
 *
 * @example
 * ```ts
 * createTodoItem({ task: "Finish the report" });
 * ```
 */
export function createTodoItem({
	task,
	priority = 'medium',
}: {
	task: string;
	priority?: 'low' | 'medium' | 'high';
}): string {
	const result = todoPool.add(task, { priority });

	if (result.isErr()) {
		return `Error creating to-do item: ${result.unwrapErr()!.message}`;
	}

	const todo = result.unwrap()!;
	return `Created to-do item: "${todo.title}" with priority "${todo.priority}".`;
}

/**
 * Edit a to-do list item
 *
 * @param params.item - the original to-do list item
 * @param params.newTask - the new task description
 * @returns string - formatted updated to-do list item
 *
 * @example
 * ```ts
 * editTodoItem({ item: "Finish the report", newTask: "Finish the annual report" });
 * ```
 */
export function editTodoItem({ item, newTask }: { item: string; newTask: string }): string {
	const getResult = todoPool.get(item);
	if (getResult.isErr()) {
		return `Error finding to-do item: ${getResult.unwrapErr()!.message}`;
	}

	const todo = getResult.unwrap()!;
	const updateResult = todoPool.update(todo.title, { title: newTask });

	if (updateResult.isErr()) {
		return `Error updating to-do item: ${updateResult.unwrapErr()!.message}`;
	}

	return `Updated to-do item: "${item}" to "${newTask}".`;
}

/**
 * List all to-do items
 *
 * @intent TODO_LIST
 * @returns string - formatted list of to-do items
 *
 * @example
 * ```ts
 * const todoList = listTodoItems();
 * console.log(todoList);
 * ```
 */
export function listTodoItems(): string {
	const todos = todoPool.list();
	if (todos.length === 0) {
		return 'No to-do items found.';
	}

	let result = 'To-Do List:\n';
	for (const todo of todos) {
		result += `- [${todo.completed ? 'x' : ' '}] "${todo.title}" (Priority: ${todo.priority})\n`;
	}
	return result.trim();
}

/**
 * Delete a to-do list item
 *
 * @intent TODO_DELETE
 * @param params.item - the to-do list item to delete
 * @returns string - result message
 *
 * @example
 * ```ts
 * deleteTodoItem({ item: "Finish the report" });
 * ```
 */
export function deleteTodoItem({ item }: { item: string }): string {
	const result = todoPool.delete(item);
	if (result.isErr()) {
		return `Error deleting to-do item: ${result.unwrapErr()!.message}`;
	}
	return `To-do item "${item}" deleted successfully.`;
}

/**
 * Complete a to-do list item
 *
 * @intent TODO_COMPLETE
 * @param params.item - the to-do list item to complete
 * @returns string - result message
 */
export function completeTodoItem({ item }: { item: string }): string {
	const result = todoPool.complete(item);
	if (result.isErr()) {
		return `Error completing to-do item: ${result.unwrapErr()!.message}`;
	}
	return `To-do item "${item}" marked as completed.`;
}

/**
 * Clear all completed to-do items
 *
 * @returns string - result message
 */
export function clearCompletedTodoItems(): string {
	const count = todoPool.clearCompleted();
	return `Cleared ${count} completed to-do item(s).`;
}

/**
 * Clear all to-do items
 *
 * @returns string - result message
 */
export function clearAllTodoItems(): string {
	const todos = todoPool.list(true);
	let count = 0;
	for (const todo of todos) {
		todoPool.delete(todo.title);
		count++;
	}
	return `Cleared all ${count} to-do item(s).`;
}

// media controls

/**
 * Play media
 *
 * @intent MEDIA_PLAY
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function playMedia(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('playMedia', {}, hash)));
	return true;
}

/**
 * Pause media
 *
 * @intent MEDIA_PAUSE
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function pauseMedia(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}
	
	this.publish(hash, JSON.stringify(createMediaCommand('pauseMedia', {}, hash)));
	return true;
}

/**
 * Stop media
 *
 * @intent MEDIA_STOP
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function stopMedia(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('stop', {}, hash)));
	return true;
}

/**
 * Skip to next media track
 *
 * @intent MEDIA_NEXT
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function nextMediaTrack(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('nextTrack', {}, hash)));
	return true;
}

/**
 * Skip to previous media track
 *
 * @intent MEDIA_PREVIOUS
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function previousMediaTrack(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('previousTrack', {}, hash)));
	return true;
}

/**
 * Set media volume
 *
 * @intent MEDIA_VOLUME
 * @param params.hash - device Hash
 * @param params.volume - volume level (0-100)
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function setMediaVolume(
	this: Elysia['server'],
	{ hash, volume }: { hash: string; volume: number },
): boolean {
	if (!hash) {
		return false;
	}

	console.log(this, this.publish)
	this.publish(hash, JSON.stringify(createControlCommand('volume', { level: volume / 100 }, hash)));
	return true;
}


// device controls

/**
 * Shutdown device
 * 
 * @intent DEVICE_SHUTDOWN
 * @param params.hash - device Hash
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function shutdownDevice(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('shutdown', {}, hash)));
	return true;
}

/**
 * Mute device
 * 
 * @intent DEVICE_MUTE
 * @param params.hash - device Hash
 * @param params.muted - mute state
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function muteDevice(
	this: ElysiaWS,
	{ hash, muted }: { hash: string; muted: boolean },
): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('mute', { muted }, hash)));
	return true;
}

/**
 * Sleep device
 * 
 * @intent DEVICE_SLEEP
 * @param params.hash - device Hash
 * @param params.duration - sleep duration in minutes
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function sleepDevice(
	this: ElysiaWS,
	{ hash, duration }: { hash: string; duration: number },
): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('sleep', { duration }, hash)));
	return true;
}

/**
 * Lock device
 * 
 * @intent DEVICE_LOCK
 * @param params.hash - device Hash
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function lockDevice(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('lock', {}, hash)));
	return true;
}

// routines

/**
 * Good Night routine
 * 
 * @intent ROUTINE_GOOD_NIGHT
 * @this {ElysiaWS}
 * @returns string - result message
 */
export function goodNightRoutine(this: ElysiaWS): string {

	// change LEDfx scene to sleep
	const playingDevices = mediaStatePool.getPlayingDevices();
	for (const device of playingDevices) {
		changeLedFxScene({ deviceHash: device.hash, sceneName: LedFxScene.Sleep });
	}
	// shutdown all links
	// shutdownDevice.call(this, { hash: 'link' });
	console.log('calling shutdownDevice for all links');
	return 'Good Night routine executed: LEDfx set to sleep scene, all links shutting down.';
}