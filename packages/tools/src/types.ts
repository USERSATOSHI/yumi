export type ToolSchema = {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: {
			type: 'object';
			properties: Record<string, { type: string; description?: string }>;
			required: string[];
		};
		example: string;
	};
};
