import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityOutput, entityRLC } from '../common.descriptions';
import { prepareFiberyError } from '../helpers/utils';
import { executeSingleCommand, getBaseUrl, getSchema } from '../transport';
import { formatEntityToOutput } from './formatEntityToOutput';
import { getFieldsSelect } from './getFieldsSelect';

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['get'],
	},
};

const properties: INodeProperties[] = [entityRLC, ...entityOutput];

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

			const select = getFieldsSelect.call(this, i, typeObject);

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
