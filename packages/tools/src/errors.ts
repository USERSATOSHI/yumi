/**
 * Yumi Internal Packages
 */
import { ErrorBase } from '@yumi/results';
type Kinds = 'ParseFailed' | 'MissingTsConfig' | 'Unknown';
export class YumiToolsError extends ErrorBase<Kinds> {
	static readonly ParseFailed = new YumiToolsError(
		'Failed to parse the TypeScript file',
		'ParseFailed',
	);
	static readonly MissingTsConfig = new YumiToolsError(
		'tsconfig.json not found or invalid',
		'MissingTsConfig',
	);
	static Unknown(message: string) {
		return new YumiToolsError(message, 'Unknown');
	}
}
