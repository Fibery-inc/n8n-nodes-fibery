import { TypeObject } from '@fibery/schema';
import { capitalCase } from 'change-case';
import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityOutput } from '../common.descriptions';
import { ControlType, ControlTypes } from '../constants';
import { Operator, operators, operatorsPerControl, operatorToCommand } from '../helpers/search';
import { prepareFiberyError } from '../helpers/utils';
import { executeSingleCommand, getBaseUrl, getSchema } from '../transport';
import { formatEntityToOutput } from './formatEntityToOutput';
import { getFieldsSelect } from './getFieldsSelect';

const getFilterOperators = () => {
	const elements: INodeProperties[] = [];

	for (const [controlType, operators] of Object.entries(operatorsPerControl)) {
		const options = operators.map((entry: string) => ({
			name: capitalCase(entry),
			value: entry,
		}));

		elements.push({
			displayName: 'Operator',
			name: 'operator',
			type: 'options',
			default: '',
			displayOptions: {
				show: {
					type: [controlType],
				},
			},
			options,
		});
	}

	return elements;
};

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
			hide: {
				operator: [operators.is_empty, operators.is_not_empty],
			},
		},
	},
	{
		displayName: 'Checked',
		name: 'value',
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
			hide: {
				operator: [operators.is_empty, operators.is_not_empty],
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
			hide: {
				operator: [operators.is_empty, operators.is_not_empty],
			},
		},
		default: [],
	},
	{
		displayName: 'Date Part',
		name: 'datePart',
		type: 'options',
		default: 'q/start',
		displayOptions: {
			show: {
				type: [ControlTypes.dateRange],
			},
		},
		options: [
			{
				name: 'Start',
				value: 'q/start',
			},
			{
				name: 'End',
				value: 'q/end',
			},
		],
	},
	{
		displayName: 'Date',
		name: 'value',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				type: [ControlTypes.date, ControlTypes.dateRange],
			},
			hide: {
				operator: [
					operators.is_empty,
					operators.is_not_empty,
					operators.yesterday,
					operators.tomorrow,
					operators.today,
					operators.last_week,
					operators.last_month,
					operators.this_week,
					operators.this_month,
				],
			},
		},
	},
];

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['getMany'],
	},
};

const properties: INodeProperties[] = [
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	...entityOutput,
	{
		displayName: 'Filter',
		name: 'filterType',
		type: 'options',
		options: [
			{
				name: 'None',
				value: 'none',
			},
			{
				name: 'Build Manually',
				value: 'manual',
			},
		],
		default: 'none',
	},
	{
		displayName: 'Must Match',
		name: 'matchType',
		type: 'options',
		options: [
			{
				name: 'All Filters',
				value: 'q/and',
			},
			{
				name: 'Any Filter',
				value: 'q/or',
			},
		],
		displayOptions: {
			show: {
				filterType: ['manual'],
			},
		},
		default: 'q/and',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				filterType: ['manual'],
			},
		},
		default: {},
		placeholder: 'Add Condition',
		options: [
			{
				displayName: 'Conditions',
				name: 'conditions',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'key',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getSearchableFields',
							loadOptionsDependsOn: ['database'],
						},
						default: '',
						description:
							'The name of the field to filter by. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'hidden',
						default: '={{JSON.parse($parameter["&key"]).type}}',
					},
					...getFilterOperators(),
					...fieldUIControls,
				],
			},
		],
	},
];

const getWhere = (
	conditions: IDataObject[],
	matchType: 'q/and' | 'q/or',
	typeObject: TypeObject,
	timezone: string,
) => {
	const where: Array<unknown> = [];
	const params: Record<string, unknown> = {};

	for (let i = 0; i < conditions.length; i++) {
		const condition = conditions[i];
		const { key, operator, value, datePart, type } = condition;

		if (typeof key === 'string' && key.length > 0) {
			const { name } = JSON.parse(key);

			const paramName = '$where' + i;

			const opToCmd = operatorToCommand[type as ControlType]?.[operator as Operator] || (() => []);

			const [condition, param] = opToCmd(name, paramName, {
				timezone,
				datePart: type === ControlTypes.dateRange ? (datePart as 'q/start' | 'q/end') : undefined,
				value,
			});

			const actualParam = typeof param === 'undefined' ? value : param;

			if (condition) {
				where.push(condition);
				params[paramName] = actualParam;
			}
		}
	}

	return { where: where.length === 1 ? where[0] : [matchType, ...where], params };
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	database: string,
): Promise<INodeExecutionData[]> {
	const timezone = this.getTimezone();

	const returnData: INodeExecutionData[] = [];

	const schema = await getSchema.call(this);

	for (let i = 0; i < items.length; i++) {
		try {
			const limit = this.getNodeParameter('limit', i, { extractValue: true }) as number;
			const filterType = this.getNodeParameter('filterType', i) as string;
			const conditions = this.getNodeParameter('filters.conditions', i, []) as IDataObject[];
			const matchType = this.getNodeParameter('matchType', i) as 'q/and' | 'q/or';

			const typeObject = schema.typeObjectsByName[database];

			const select = getFieldsSelect.call(this, i, typeObject);
			const { where, params } =
				filterType === 'manual'
					? getWhere(conditions, matchType, typeObject, timezone)
					: { where: undefined, params: {} };

			const command = {
				command: 'fibery.entity/query',
				args: {
					query: {
						'q/from': database,
						'q/select': select,
						'q/limit': limit,
						'q/offset': 0,
						'q/where': where,
					},
					params: {
						...params,
					},
				},
			};
			const [responseData, baseUrl] = await Promise.all([
				executeSingleCommand.call(this, command),
				getBaseUrl.call(this),
			]);

			const data = responseData.map((entity: IDataObject) =>
				formatEntityToOutput.call(this, i, entity, typeObject, baseUrl),
			);

			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray(data),
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
