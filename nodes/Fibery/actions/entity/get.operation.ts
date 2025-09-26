import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityRLC } from '../common.descriptions';
import { prepareFiberyError } from '../helpers/utils';
import { executeSingleCommand, getSchema } from '../transport';
import { getSelectWithSupportedFields } from './getSelectWithSupportedFields';

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['get'],
	},
};

const properties: INodeProperties[] = [
	entityRLC,
	// {
	// 	displayName: 'Fields To Select',
	// 	name: 'fields',
	// 	type: 'multiOptions',
	// 	noDataExpression: true,
	// 	default: ['fibery/id'],
	// 	description:
	// 		'Comma-separated list of fields to include in the response (optional). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	// 	typeOptions: {
	// 		loadOptionsDependsOn: ['database'],
	// 		loadOptionsMethod: 'loadFields',
	// 	},
	// },
];

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	database: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	const schema = await getSchema.call(this);

	for (let i = 0; i < items.length; i++) {
		try {
			const { mode, value: entityId } = this.getNodeParameter(
				'entity',
				i,
			) as INodeParameterResourceLocator;

			const whereField = mode === 'uuid' ? 'fibery/id' : 'fibery/public-id';

			const typeObject = schema.typeObjectsByName[database];

			const select = getSelectWithSupportedFields(typeObject);

			const command = {
				command: 'fibery.entity/query',
				args: {
					query: {
						'q/from': database,
						'q/select': select,
						'q/limit': 1,
						'q/offset': 0,
						'q/where': ['=', [whereField], '$entityId'],
					},
					params: {
						$entityId: entityId,
					},
				},
			};
			const responseData = await executeSingleCommand.call(this, command);

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
