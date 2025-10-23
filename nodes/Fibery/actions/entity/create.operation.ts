import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityInput, entityOutput } from '../common.descriptions';
import { prepareFiberyError } from '../helpers/utils';
import {
	addCollectionItems,
	createEntity,
	executeSingleCommand,
	getBaseUrl,
	getSchema,
	updateCollaborationDocuments,
} from '../transport';
import { buildEntityUpdate } from './buildEntityUpdate';
import { formatEntitiesOutput } from './formatEntityToOutput';
import { getFieldsSelect } from './getFieldsSelect';
import { isCollabDoc } from '../helpers/schema';

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

	const typeObject = schema.getTypeObjectByName(database);

	for (let i = 0; i < items.length; i++) {
		try {
			const fieldValues = this.getNodeParameter('fields.field', i, []) as IDataObject[];

			const { entity, collections, collabDocs } = buildEntityUpdate(
				fieldValues,
				typeObject,
				schema,
				timezone,
			);

			const docSecretsSelect = typeObject.fieldObjects.reduce(
				(acc, fieldObject) => {
					if (isCollabDoc(fieldObject)) {
						acc[fieldObject.name] = [fieldObject.name, 'Collaboration~Documents/secret'];
					}
					return acc;
				},
				{} as Record<string, unknown>,
			);

			const [responseData, baseUrl] = await Promise.all([
				createEntity.call(this, database, entity, {
					[typeObject.idField]: typeObject.idField,
					...docSecretsSelect,
				}),
				getBaseUrl.call(this),
			]);

			const entityId = responseData[typeObject.idField] as string;

			await Promise.all([
				addCollectionItems.call(this, entityId, collections),
				updateCollaborationDocuments.call(this, collabDocs, responseData),
			]);

			const select = getFieldsSelect.call(this, i, typeObject, schema);
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

			const createdEntities = await executeSingleCommand.call(this, queryCmd);

			const data = await formatEntitiesOutput.call(this, i, createdEntities, typeObject, baseUrl);

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
