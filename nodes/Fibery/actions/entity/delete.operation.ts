import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityRLC } from '../common.descriptions';
import { prepareFiberyError } from '../helpers/utils';
import { executeSingleCommand } from '../transport';

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['delete'],
	},
};

const properties: INodeProperties[] = [entityRLC];

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	database: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const { value: entityId } = this.getNodeParameter(
				'entity',
				i,
			) as INodeParameterResourceLocator;

			const command = {
				command: 'fibery.entity/delete',
				args: {
					type: database,
					entity: { 'fibery/id': entityId },
				},
			};

			const responseData = await executeSingleCommand.call(this, command);

			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray(responseData || { deleted: true }),
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
