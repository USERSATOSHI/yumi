import { Elysia } from 'elysia';

import { DeviceService } from './service';
import { DeviceModel } from './model';

const device = new Elysia({ prefix: '/device' }).get(
	'/',
	() => {
		return DeviceService.list();
	},
	{
		response: {
			200: DeviceModel.response,
		},
	},
);

export default device;
