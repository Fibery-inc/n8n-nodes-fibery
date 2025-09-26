import { TypeObject } from '@fibery/schema';
import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { isCollectionReferenceField, isSingleReferenceField } from '../helpers/schema';
import { prepareFiberyError } from '../helpers/utils';
import { executeBatchCommands, executeSingleCommand, getSchema } from '../transport';
import moment from 'moment-timezone';
import { ControlTypes } from '../constants';

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
];

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['create'],
	},
};

const properties: INodeProperties[] = [
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

export const description = updateDisplayOptions(displayOptions, properties);

type CollectionItem = {
	field: string;
	values: string[];
	type: string;
};

const buildEntityUpdate = (
	fieldValues: IDataObject[],
	typeObject: TypeObject,
	nodeTimezone: string,
) => {
	const entity: Record<string, unknown> = {};
	const collections: CollectionItem[] = [];

	for (const fieldValue of fieldValues) {
		const { key, value, valueStart, valueEnd, checked, timezone } = fieldValue;

		if (typeof key === 'string' && key.length > 0) {
			const { name } = JSON.parse(key);

			const fieldObject = typeObject.fieldObjectsByName[name];

			switch (fieldObject.type) {
				case 'fibery/bool': {
					entity[name] = checked;
					break;
				}
				case 'fibery/date-time-range':
				case 'fibery/date-range': {
					const timezoneValue = timezone === 'default' ? nodeTimezone : (timezone as string);

					entity[name] = {
						start: moment.tz(valueStart as string, timezoneValue).toISOString(),
						end: moment.tz(valueEnd as string, timezoneValue).toISOString(),
					};
					break;
				}
				case 'fibery/datetime':
				case 'fibery/date': {
					const timezoneValue = timezone === 'default' ? nodeTimezone : (timezone as string);

					entity[name] = moment.tz(value as string, timezoneValue).toISOString();
					break;
				}
				default: {
					if (isSingleReferenceField(fieldObject)) {
						entity[name] = value
							? {
									[fieldObject.typeObject.idField]: value,
								}
							: null;
					} else if (isCollectionReferenceField(fieldObject)) {
						collections.push({
							field: name,
							values: value as string[],
							type: fieldObject.holderType,
						});
					} else {
						entity[name] = value;
					}
				}
			}
		}
	}

	return { entity, collections };
};

async function addCollectionItems(
	this: IExecuteFunctions,
	entityId: string,
	collections: CollectionItem[],
) {
	const addCollectionItemsCommands = collections.map(({ field, values, type }) => ({
		command: `fibery.entity/add-collection-items`,
		args: {
			entity: { 'fibery/id': entityId },
			field: field,
			items: values.map((v) => ({ 'fibery/id': v })),
			type: type,
		},
	}));

	if (addCollectionItemsCommands.length > 0) {
		await executeBatchCommands.call(this, addCollectionItemsCommands);
	}
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	database: string,
): Promise<INodeExecutionData[]> {
	const timezone = this.getTimezone();
	const returnData: INodeExecutionData[] = [];

	const schema = await getSchema.call(this);

	const typeObject = schema.typeObjectsByName[database];

	for (let i = 0; i < items.length; i++) {
		try {
			const fieldValues = this.getNodeParameter('fields.field', i, []) as IDataObject[];

			const { entity, collections } = buildEntityUpdate(fieldValues, typeObject, timezone);

			const command = {
				command: 'fibery.entity/create',
				args: {
					type: database,
					entity,
				},
			};

			const responseData = await executeSingleCommand.call(this, command);

			const entityId = responseData[typeObject.idField];

			await addCollectionItems.call(this, entityId, collections);

			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray(responseData),
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message } });
				continue;
			} else {
				const err = prepareFiberyError(this.getNode(), error, i);

				throw err;
			}
		}
	}

	return returnData;
}
