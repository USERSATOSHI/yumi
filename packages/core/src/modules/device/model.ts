import { t } from 'elysia';
import { DeviceType } from '../../pool/devices/index.js';

export namespace DeviceModel {
	export const device = t.Object({
		hash: t.String(),
		name: t.String(),
		type: t.Enum(DeviceType),
		identifier: t.String(),
		status: t.Optional(t.Union([t.Literal('online'), t.Literal('offline')])),
	});

	export const response = t.Object({
		devices: t.Array(device),
		count: t.Number(),
	});

	export type Response = typeof response.static;
}
