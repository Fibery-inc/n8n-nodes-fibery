import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import * as database from './actions/database/Database.resource';
import * as entity from './actions/entity/Entity.resource';
import * as listSearch from './actions/methods/listSearch';
import * as loadOptions from './actions/methods/loadOptions';

export class Fibery implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Fibery',
		name: 'fibery',
		icon: 'file:fibery.svg',
		group: ['input'],
		version: 1,
		description: 'Read, update, write and delete data from Fibery',
		defaults: {
			name: 'Fibery',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'fiberyTokenApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['fiberyTokenApi'],
					},
				},
			},
			// {
			// 	name: 'fiberyOAuth2Api',
			// 	required: true,
			// 	displayOptions: {
			// 		show: {
			// 			authentication: ['fiberyOAuth2Api'],
			// 		},
			// 	},
			// },
		],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Access Token',
						value: 'fiberyTokenApi',
					},
					// {
					// 	name: 'OAuth2',
					// 	value: 'fiberyOAuth2Api',
					// },
				],
				default: 'fiberyTokenApi',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Database',
						value: 'database',
					},
					{
						name: 'Entity',
						value: 'entity',
					},
				],
				default: 'entity',
			},
			...database.description,
			...entity.description,
		],
	};

	methods = {
		listSearch,
		loadOptions,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		if (resource === 'database') {
			if (operation === 'getAll') {
				const returnData = await database[operation].execute.call(this);

				return [returnData];
			}
		}

		if (resource === 'entity') {
			const database = this.getNodeParameter('database', 0, undefined, {
				extractValue: true,
			}) as string;

			if (!database) {
				throw new NodeOperationError(this.getNode(), new Error('Database is required'), {
					description: 'Please select a Database first',
				});
			}

			const op = operation === 'delete' ? 'deleteOperation' : operation;

			switch (op) {
				case 'deleteOperation':
				case 'create':
				case 'update':
				case 'get':
				case 'getMany': {
					const returnData = await entity[op].execute.call(this, items, database);

					return [returnData];
				}
			}
		}

		return [];
	}
}
