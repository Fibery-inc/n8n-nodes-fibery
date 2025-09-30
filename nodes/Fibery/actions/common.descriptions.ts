import { INodeProperties } from 'n8n-workflow';

export const databaseRLC: INodeProperties = {
	displayName: 'Database',
	name: 'database',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a database...',
			typeOptions: {
				searchListMethod: 'getDatabases',
				searchable: true,
			},
		},
		//  TODO: URL, id ?
	],
};

export const entityRLC = {
	displayName: 'Entity',
	name: 'entity',
	type: 'resourceLocator',
	default: { mode: 'uuid', value: '' },
	required: true,
	displayOptions: {
		show: {
			resource: ['entity'],
		},
	},
	modes: [
		{
			displayName: 'UUID',
			name: 'uuid',
			type: 'string',
			placeholder: 'e5d190c0-fd6a-11ec-85d2-a1a856b07821',
		},
		{
			displayName: 'Public ID',
			name: 'publicId',
			type: 'string',
			placeholder: '42',
		},
	],
} as const satisfies INodeProperties;
