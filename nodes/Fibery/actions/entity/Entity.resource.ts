import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as get from './get.operation';
import * as getMany from './getMany.operation';
import * as deleteOperation from './delete.operation';
import { databaseRLC } from '../common.descriptions';

export { create, get, getMany, deleteOperation };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new entity',
				action: 'Create an entity',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get an entity',
				action: 'Get an entity',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an entity',
				action: 'Delete an entity',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Get many entities from a database',
				action: 'Get many entities',
			},
		],
		default: 'create',
		displayOptions: {
			show: {
				resource: ['entity'],
			},
		},
	},
	databaseRLC,
	...create.description,
	...get.description,
	...deleteOperation.description,
	...getMany.description,
];
