import type { StatsModel } from './model';
import { statDB } from '../../db/index.js';

export abstract class StatsService {
	static get(): StatsModel.Response {
		return statDB.getDashboardStats();
	}
}
