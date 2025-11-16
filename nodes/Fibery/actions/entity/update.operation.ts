import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { entityOutput, entityRLC } from '../common.descriptions';
import { isCollabDoc, isCollectionReferenceField } from '../helpers/schema';
import { prepareFiberyError } from '../helpers/utils';
import {
	executeSingleCommand,
	getSchema,
	mergeCollectionItems,
	updateCollaborationDocuments,
	updateEntity,
} from '../transport';
import { buildEntityUpdate } from './buildEntityUpdate';
import { formatEntitiesOutput } from './formatEntityToOutput';
import { getFieldsSelect } from './getFieldsSelect';
import { getSelectForEntityOutput } from './getSelectForEntityOutput';

const displayOptions = {
	show: {
		resource: ['entity'],
		operation: ['update'],
	},
};

const properties: INodeProperties[] = [
	entityRLC,
	...entityOutput,
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'resourceMapper',
		noDataExpression: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['database.value'],
			resourceMapper: {
				resourceMapperMethod: 'getFields',
				mode: 'add',
				fieldWords: {
					singular: 'field',
					plural: 'fields',
				},
				addAllFields: true,
				multiKeyMatch: false,
			},
		},
	},
];

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

	const dataMode = this.getNodeParameter('fields.mappingMode', 0) as string;

	for (let i = 0; i < items.length; i++) {
		try {
			let fieldValues: IDataObject;
			let entityId: string;

			if (dataMode === 'autoMapInputData') {
				// Use the input item's JSON data directly
				fieldValues = items[i].json;
				// Extract entity ID from the data
				entityId = fieldValues[typeObject.idField] as string;
				if (!entityId) {
					throw new Error(`Entity ID field '${typeObject.idField}' not found in input data`);
				}
				// Remove entity ID from fields to avoid trying to update it
				const { [typeObject.idField]: _, ...fieldsToUpdate } = fieldValues;
				fieldValues = fieldsToUpdate;
			} else {
				// Get entity ID from the entity selector
				const entityRLCValue = this.getNodeParameter('entity', i) as { value: string };
				entityId = entityRLCValue.value;

				// Get the mapped fields from the resourceMapper (doesn't include entity ID)
				fieldValues = this.getNodeParameter('fields.value', i, {}) as IDataObject;
			}

			// Build entity update from fields (includes all field types)
			const { entity, collections, collabDocs } = await buildEntityUpdate(
				this,
				fieldValues,
				typeObject,
				schema,
				timezone,
			);

			const docSecretsAndCollectionsSelect = getFieldsSelect(
				typeObject.fieldObjects.filter(
					(f) => f.isId || isCollabDoc(f) || isCollectionReferenceField(f, schema),
				),
				schema,
			);

			const responseData = await updateEntity.call(
				this,
				database,
				entityId,
				entity,
				docSecretsAndCollectionsSelect,
			);

			await Promise.all([
				mergeCollectionItems.call(this, collections, responseData, typeObject),
				updateCollaborationDocuments.call(this, collabDocs, responseData),
			]);

			const select = getSelectForEntityOutput.call(this, i, typeObject, schema);
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

			const updatedEntities = await executeSingleCommand.call(this, queryCmd);

			const data = await formatEntitiesOutput.call(this, i, updatedEntities, typeObject);

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
