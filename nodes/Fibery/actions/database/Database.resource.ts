import type { INodeProperties } from 'n8n-workflow';

import * as getAll from './getAll.operation';

export { getAll };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many databases from the workspace',
				action: 'Get many databases',
			},
		],
		default: 'getAll',
		displayOptions: {
			show: {
				resource: ['database'],
			},
		},
	},
	...getAll.description,
];
