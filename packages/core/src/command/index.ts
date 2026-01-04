import { WSType } from "../modules/ws/type.js";
import { type ControlCommandFnMap, type MediaCommandFnMap, type ControlCommand, type MediaCommand, CommandType } from "./type";

export function createControlCommand<K extends keyof ControlCommandFnMap>(
    fn: K,
    args: ControlCommandFnMap[K],
    hash: string
): ControlCommand<K> {
    return {
        type: CommandType.Control,
        data: { fn, args, hash }
    };
}

export function createMediaCommand<K extends keyof MediaCommandFnMap>(
	fn: K,
	args: MediaCommandFnMap[K],
	hash: string
): MediaCommand<K> {
	return {
		type: WSType.Control,
		data: { fn, args, hash }
	};
}