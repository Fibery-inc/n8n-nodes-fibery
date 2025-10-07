import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityOutput, entityRLC } from '../common.descriptions';
import { prepareFiberyError } from '../helpers/utils';
import { executeSingleCommand, getBaseUrl, getSchema } from '../transport';
import { formatEntitiesOutput } from './formatEntityToOutput';
import { getFieldsSelect } from './getFieldsSelect';
import { downloadEntityFiles } from './downloadEntityFiles';

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['get'],
	},
};

const properties: INodeProperties[] = [
	entityRLC,
	...entityOutput,
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'Download Files',
				name: 'downloadFiles',
				type: 'boolean',
				default: false,
				description: "Whether to download a file if a database's field contains it",
			},
		],
	},
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
			const { value: entityId } = this.getNodeParameter(
				'entity',
				i,
			) as INodeParameterResourceLocator;

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
						'q/where': ['=', [typeObject.idField], '$entityId'],
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

			const data = await formatEntitiesOutput.call(this, i, responseData, typeObject, baseUrl);

			const options = this.getNodeParameter('options', i);

			if (options.downloadFiles) {
				const withDownloadedFiles = await downloadEntityFiles.call(this, data, typeObject);

				returnData.push(...withDownloadedFiles);
				continue;
			}

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
