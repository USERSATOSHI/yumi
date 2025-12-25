export type Text = {
	en: string;
	jp: string;
}

export type Role = 'user' | 'assistant' | 'system';

export type Message = {
	content: string;
	role: Role;
}

export type Response = {
	text: string;
}

export type ToolFunctionParameter = {
	type: 'object';
	properties: {
		[key: string]: {
			type: string;
			description?: string;
		};
	};
	required?: string[];
};

export type ToolDefinition = {
	type: 'function';
	function: {
		name: string;
		description?: string;
		parameters: ToolFunctionParameter;
	};
};

export type ToolCall = {
	function: {
		name: string;
		arguments: Record<string, unknown>; // or more strictly typed if known
	};
};

export type ChatCompletionResponse = {
	model: string;
	created_at: string;
	message: {
		role: 'assistant';
		content: string;
		tool_calls?: ToolCall[];
	};
	done_reason: 'stop' | 'length' | string;
	done: boolean;
	total_duration: number;
	load_duration: number;
	prompt_eval_count: number;
	prompt_eval_duration: number;
	eval_count: number;
	eval_duration: number;
};

export type ToolResponse = {
	message: ChatCompletionResponse['message'];
	output: boolean;
	executionResults?: Array<{
		tool: string;
		args: Record<string, unknown>;
		result?: unknown;
		error?: string;
	}>;
};