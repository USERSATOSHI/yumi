import type { DeviceModel } from './model';
import { devicePool } from '../../pool/devices/index.js';

export abstract class DeviceService {
	static list(): DeviceModel.Response {
		const devices = devicePool.list();
		return {
			devices,
			count: devices.length,
		};
	}
}
