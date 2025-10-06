import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityInput, entityOutput } from '../common.descriptions';
import { prepareFiberyError } from '../helpers/utils';
import { addCollectionItems, executeSingleCommand, getBaseUrl, getSchema } from '../transport';
import { buildEntityUpdate } from './buildEntityUpdate';
import { formatEntityToOutput } from './formatEntityToOutput';
import { getFieldsSelect } from './getFieldsSelect';

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['create'],
	},
};

const properties: INodeProperties[] = [...entityOutput, ...entityInput];

export const description = updateDisplayOptions(displayOptions, properties);

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

			const [responseData, baseUrl] = await Promise.all([
				executeSingleCommand.call(this, command),
				getBaseUrl.call(this),
			]);

			const entityId = responseData[typeObject.idField] as string;

			await addCollectionItems.call(this, entityId, collections);

			const select = getFieldsSelect.call(this, i, typeObject);
			const queryCmd = {
				command: 'fibery.entity/query',
				args: {
					query: {
						'q/from': database,
						'q/select': select,
						'q/limit': 1,
						'q/offset': 0,
						'q/where': ['=', [typeObject.idField], '$entityId'],
					},
					params: {
						$entityId: entityId,
					},
				},
			};

			const [createdEntity] = await executeSingleCommand.call(this, queryCmd);

			const data = formatEntityToOutput.call(this, i, createdEntity, typeObject, baseUrl);

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
