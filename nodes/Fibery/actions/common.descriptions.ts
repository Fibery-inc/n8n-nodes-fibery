import { INodeProperties } from 'n8n-workflow';
import { ControlTypes } from './constants';

export const databaseRLC: INodeProperties = {
	displayName: 'Database',
	name: 'database',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	displayOptions: {
		show: {
			resource: ['entity'],
		},
	},
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
		{
			displayName: 'Name',
			name: 'name',
			type: 'string',
			hint: 'e.g. Kanban/Story, fibery/user',
			placeholder: 'Space Name/Database Name',
		},
	],
};

export const entityRLC = {
	displayName: 'Entity',
	name: 'entity',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	displayOptions: {
		show: {
			resource: ['entity'],
		},
	},
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select an entity...',
			typeOptions: {
				searchListMethod: 'getEntities',
				searchable: true,
			},
		},
		{
			displayName: 'UUID',
			name: 'uuid',
			type: 'string',
			placeholder: 'e5d190c0-fd6a-11ec-85d2-a1a856b07821',
		},
	],
} as const satisfies INodeProperties;

export const entityOutput: INodeProperties[] = [
	{
		displayName: 'Output',
		displayOptions: {
			show: {
				resource: ['entity'],
			},
		},
		type: 'options',
		name: 'output',
		default: 'simplified',
		options: [
			{
				name: 'Simplified',
				value: 'simplified',
			},
			{
				name: 'Raw',
				value: 'raw',
			},
			{
				name: 'Selected Fields',
				value: 'selectedFields',
			},
		],
	},
	{
		displayName: 'Fields To Select',
		name: 'fieldsToSelect',
		type: 'multiOptions',
		noDataExpression: true,
		default: ['fibery/id'],
		displayOptions: {
			show: {
				output: ['selectedFields'],
			},
		},
		description:
			'Comma-separated list of fields to include in the response (optional). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		typeOptions: {
			loadOptionsDependsOn: ['database'],
			loadOptionsMethod: 'loadFields',
		},
	},
];

const fieldUIControls: INodeProperties[] = [
	{
		displayName: 'Field Value',
		name: 'value',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				type: [ControlTypes.text],
			},
		},
	},

	{
		displayName: 'Checked',
		name: 'checked',
		type: 'boolean',
		displayOptions: {
			show: {
				type: [ControlTypes.boolean],
			},
		},
		default: false,
	},
	{
		displayName: 'Relation Name or ID',
		name: 'value',
		type: 'options',
		default: '',
		hint: 'Note: only 200 entities are loaded into list',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		typeOptions: {
			loadOptionsMethod: 'getSelectOptions',
			loadOptionsDependsOn: ['&key'],
		},
		displayOptions: {
			show: {
				type: [ControlTypes.select],
			},
		},
	},
	{
		displayName: 'Relation Names or IDs',
		name: 'value',
		type: 'multiOptions',
		description:
			'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		hint: 'Note: only 200 entities are loaded into list',
		typeOptions: {
			loadOptionsMethod: 'getSelectOptions',
			loadOptionsDependsOn: ['&key'],
		},
		displayOptions: {
			show: {
				type: [ControlTypes.multiSelect],
			},
		},
		default: [],
	},

	{
		displayName: 'Timezone Name or ID',
		name: 'timezone',
		type: 'options',
		displayOptions: {
			show: {
				type: [ControlTypes.date, ControlTypes.dateRange],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getTimezones',
		},
		options: [
			{
				name: 'Default',
				value: 'default',
				description: 'Timezone set in n8n',
			},
		],
		default: 'default',
		description:
			'Time zone to use. By default n8n timezone is used. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Date',
		name: 'value',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				type: [ControlTypes.date],
			},
		},
	},

	{
		displayName: 'Date Start',
		name: 'valueStart',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				type: [ControlTypes.dateRange],
			},
		},
	},
	{
		displayName: 'Date End',
		name: 'valueEnd',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				type: [ControlTypes.dateRange],
			},
		},
	},
	{
		displayName: 'Field Value (Markdown)',
		name: 'value',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		displayOptions: {
			show: {
				type: [ControlTypes.textArea],
			},
		},
	},
	{
		displayName: 'Field Value',
		name: 'value',
		type: 'json',
		default: '',
		displayOptions: {
			show: {
				type: [ControlTypes.json],
			},
		},
	},
];

export const entityInput: INodeProperties[] = [
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Field',
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				name: 'field',
				displayName: 'Field',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'key',
						type: 'options',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
						typeOptions: {
							loadOptionsMethod: 'getWritableFields',
							loadOptionsDependsOn: ['database'],
						},
						default: '',
					},
					{
						displayName: 'Field Type',
						name: 'type',
						type: 'hidden',
						default: '={{JSON.parse($parameter["&key"]).type}}',
					},

					...fieldUIControls,
				],
			},
		],
	},
];
