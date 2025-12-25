/**
 * @fileoverview ESLint rule to insert group comments above import groups
 */
'use strict';

const rules = {
	'insert-import-comments': {
		meta: {
			type: 'layout',
			fixable: 'whitespace',
			docs: {
				description:
					'Insert comments above import groups like External, Internal, and Local',
				category: 'Stylistic Issues',
			},
			schema: [],
		},

		create(context) {
			const sourceCode = context.getSourceCode();

			// Classify import source string into group names
			const getGroupName = (importPath) => {
				if (
					/^node:/.test(importPath) ||
					(!importPath.startsWith('.') && !importPath.startsWith('@'))
				) {
					return 'External Dependencies';
				}
				if (importPath.startsWith('@yumi/')) {
					return 'Yumi Internal Packages';
				}
				if (importPath.startsWith('.')) {
					return 'Local Module Imports';
				}
				return 'Other Imports';
			};

			return {
				Program() {
					const importNodes = sourceCode.ast.body.filter(
						(n) => n.type === 'ImportDeclaration',
					);
					if (importNodes.length === 0) return;

					const groupMap = new Map();

					for (const node of importNodes) {
						const importPath = node.source.value;
						if (typeof importPath !== 'string') continue;

						const group = getGroupName(importPath);
						if (!groupMap.has(group)) {
							groupMap.set(group, node);
						}
					}

					for (const [group, node] of groupMap.entries()) {
						const leadingComments = sourceCode.getCommentsBefore(node);

						const alreadyHasComment = leadingComments.some(
							(comment) => comment.type === 'Block' && comment.value.includes(group),
						);

						if (!alreadyHasComment) {
							context.report({
								node,
								message: `Missing comment for "${group}" import group`,
								fix(fixer) {
									const commentText = `/**\n * ${group}\n */\n`;
									return fixer.insertTextBefore(node, commentText);
								},
							});
						}
					}
				},
			};
		},
	},
};

export default { rules };
