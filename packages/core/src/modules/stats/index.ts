import { Elysia } from 'elysia';

import { StatsService } from './service';
import { StatsModel } from './model';

const stats = new Elysia({ prefix: '/stats' }).get(
	'/',
	() => {
		return StatsService.get();
	},
	{
		response: {
			200: StatsModel.response,
		},
	},
);

export default stats;
