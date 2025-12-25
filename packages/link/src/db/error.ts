import { ErrorBase } from "@yumi/results";

type Kinds = 'MissingNameOrType' | 'InsertionFailed';
export class DBError extends ErrorBase<Kinds> {
	static readonly MissingNameOrType = new DBError('Name and type are required to create a device', 'MissingNameOrType');
	static readonly InsertionFailed = new DBError('Failed to create device', 'InsertionFailed');
}