import { ErrorBase } from '@yumi/results';

type Kinds = 'DeviceExists' | 'DeviceNotFound';

export class PoolError extends ErrorBase<Kinds> {
	static readonly DeviceExists = new PoolError('Device already exists', 'DeviceExists');
	static readonly DeviceNotFound = new PoolError('Device not found', 'DeviceNotFound');
}