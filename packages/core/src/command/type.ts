export interface BaseCommand {
	type: string;
	data: BaseCommandData;
}

export type BaseCommandData = {
	fn: string;
	args: Record<string, unknown>;
	hash?: string;
};

export interface ControlCommandFnMap {
	lock: {};
	shutdown: {};
	sleep: { };
	restart: {};
	mute: { muted: boolean };
	volume: { level: number };
	brightness: { level: number };
	goodnight: {};
}

export type ControlCommandData<K extends keyof ControlCommandFnMap = keyof ControlCommandFnMap> = {
	[P in K]: {
		fn: P;
		args: ControlCommandFnMap[P];
		hash: string;
	}
}[K];

export interface ControlCommand<K extends keyof ControlCommandFnMap> extends BaseCommand {
	type: 'control';
	data: ControlCommandData<K>;
}

export interface MediaCommandFnMap {
	play: {};
	pause: {};
	stop: {};
	next: {};
	previous: {};
	seek: { position: number };
	search: { platform: 'youtube' | 'spotify' | 'netflix' | 'jellyfin'; query: string };
}

export type MediaCommandData<K extends keyof MediaCommandFnMap = keyof MediaCommandFnMap> = {
	[P in K]: {
		fn: P;
		args: MediaCommandFnMap[P];
		hash: string;
	}
}[K];

export interface MediaCommand<K extends keyof MediaCommandFnMap> extends BaseCommand {
	type: 'media';
	data: MediaCommandData<K>;
}

export enum CommandType {
	Control = 'control',
	Media = 'media'
}