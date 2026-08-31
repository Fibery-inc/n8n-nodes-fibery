import type {
	FieldType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ControlTypes } from '../constants';
import {
	fiberyFieldToN8nControlType,
	isWritableField,
	isCollectionReferenceField,
	isSingleReferenceField,
} from '../helpers/schema';
import { FieldObject, Schema } from '../helpers/schema-factory';
import { executeSingleCommand, getSchema } from '../transport';
import { getDatabaseParam } from './getDatabaseParam';

type ControlType = (typeof ControlTypes)[keyof typeof ControlTypes];

/**
 * Map Fibery control types to n8n resource mapper field types
 */
function mapControlTypeToFieldType(controlType: ControlType | null): FieldType {
	switch (controlType) {
		case ControlTypes.text:
			return 'string';
		case ControlTypes.textArea:
			return 'string';
		case ControlTypes.number:
			return 'number';
		case ControlTypes.boolean:
			return 'boolean';
		case ControlTypes.date:
			return 'dateTime';
		case ControlTypes.dateRange:
			return 'object';
		case ControlTypes.select:
			// Use 'string' instead of 'options' to show text input for name-to-ID resolution
			return 'string';
		case ControlTypes.multiSelect:
			return 'array';
		case ControlTypes.json:
			return 'object';
		case ControlTypes.file:
			return 'string';
		case ControlTypes.hidden:
			return 'string';
		default:
			return 'string';
	}
}

/**
 * Get options for select/multiselect fields
 */
async function getFieldOptions(
	context: ILoadOptionsFunctions,
	fieldObject: FieldObject,
	schema: Schema,
): Promise<INodePropertyOptions[] | undefined> {
	if (!isSingleReferenceField(fieldObject, schema) && !isCollectionReferenceField(fieldObject, schema)) {
		return undefined;
	}

	// Load options for reference fields (limit to 200 entities)
	try {
		const fieldTypeObject = schema.getTypeObjectByName(fieldObject.type);

		const command = {
			command: 'fibery.entity/query',
			args: {
				query: {
					'q/from': fieldTypeObject.name,
					'q/limit': 200,
					'q/select': {
						name: fieldTypeObject.titleField,
						value: fieldTypeObject.idField,
					},
					'q/order-by': [[[fieldTypeObject.rankField || fieldTypeObject.titleField], 'q/asc']],
				},
			},
		};

		const responseData = await executeSingleCommand.call(context, command);
		return responseData as INodePropertyOptions[];
	} catch (error) {
		// If we can't load options, return undefined and let user use expressions
		return undefined;
	}
}

/**
 * Get a friendly display label for field type
 */
function getFieldTypeLabel(
	controlType: ControlType | null,
	fieldType: FieldType,
	fieldObject: FieldObject,
	schema: Schema,
): string {
	switch (controlType) {
		case ControlTypes.text:
			return 'Text';
		case ControlTypes.textArea:
			return 'Markdown';
		case ControlTypes.number:
			return 'Number';
		case ControlTypes.boolean:
			return 'Boolean';
		case ControlTypes.date:
			return 'Date';
		case ControlTypes.dateRange:
			return 'Date range';
		case ControlTypes.select: {
			// Check if the field type is an enum (workflow/single-select)
			const fieldTypeObject = schema.getTypeObjectByName(fieldObject.type);
			const isEnum = fieldTypeObject.rawMeta['fibery/enum?'] || false;
			return isEnum ? 'Single-Select' : 'Single-Relation';
		}
		case ControlTypes.multiSelect: {
			// Check if it's an enum multi-select or a multi-relation
			const fieldTypeObject = schema.getTypeObjectByName(fieldObject.type);
			const isEnum = fieldTypeObject.rawMeta['fibery/enum?'] || false;
			return isEnum ? 'Multi-Select' : 'Multi-Relation';
		}
		case ControlTypes.json:
			return 'JSON';
		default:
			return fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
	}
}

/**
 * Convert a Fibery FieldObject to a ResourceMapperField
 */
async function fieldObjectToResourceMapperField(
	context: ILoadOptionsFunctions,
	fieldObject: FieldObject,
	schema: Schema,
): Promise<ResourceMapperField> {
	const controlType = fiberyFieldToN8nControlType(fieldObject, schema);
	const fieldType = mapControlTypeToFieldType(controlType);
	const isReadOnly = fieldObject.isReadOnly;

	// Generate display name with type info for non-obvious field types
	const typeLabel = getFieldTypeLabel(controlType, fieldType, fieldObject, schema);
	const shouldShowType =
		typeLabel === 'Markdown' ||
		typeLabel === 'Multi-Relation' ||
		typeLabel === 'Multi-Select' ||
		typeLabel === 'Single-Select' ||
		typeLabel === 'Single-Relation';
	const displayName = shouldShowType ? `${fieldObject.title} (${typeLabel})` : fieldObject.title;

	// Don't provide options for reference fields to allow name-to-ID resolution
	// Users can enter entity names or UUIDs, which get resolved in buildEntityUpdate
	const field: ResourceMapperField = {
		id: fieldObject.name,
		displayName,
		required: false,
		defaultMatch: false,
		canBeUsedToMatch: false,
		display: true,
		type: fieldType,
		readOnly: isReadOnly,
		removed: isReadOnly, // Read-only fields are shown but marked for removal
	};

	return field;
}

/**
 * Sort field objects by their display order
 */
function sortFieldObjects(a: FieldObject, b: FieldObject): number {
	const aOrder = a.isTitle ? -1 : a.objectEditorOrder;
	const bOrder = b.isTitle ? -1 : b.objectEditorOrder;
	return aOrder - bOrder;
}

/**
 * Get all fields for the resource mapper (for create operation)
 */
export async function getFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
	const database = getDatabaseParam.call(this);
	const schema = await getSchema.call(this);
	const typeObject = schema.getTypeObjectByName(database);

	if (!typeObject) {
		throw new NodeOperationError(this.getNode(), 'Database information could not be found!', {
			level: 'warning',
		});
	}

	const writableFields = typeObject.fieldObjects
		.filter((fieldObject) => isWritableField(fieldObject, schema))
		.sort(sortFieldObjects);

	const fields: ResourceMapperField[] = [];

	for (const fieldObject of writableFields) {
		const field = await fieldObjectToResourceMapperField(this, fieldObject, schema);
		fields.push(field);
	}

	return { fields };
}

/**
 * Get fields excluding collection/multi-select fields (for create operation)
 * Collection fields are handled separately via fixedCollection UI
 */
export async function getFieldsWithoutCollections(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const database = getDatabaseParam.call(this);
	const schema = await getSchema.call(this);
	const typeObject = schema.getTypeObjectByName(database);

	if (!typeObject) {
		throw new NodeOperationError(this.getNode(), 'Database information could not be found!', {
			level: 'warning',
		});
	}

	const writableFields = typeObject.fieldObjects
		.filter((fieldObject) =>
			isWritableField(fieldObject, schema) &&
			!isCollectionReferenceField(fieldObject, schema) // Exclude collection fields
		)
		.sort(sortFieldObjects);

	const fields: ResourceMapperField[] = [];

	for (const fieldObject of writableFields) {
		const field = await fieldObjectToResourceMapperField(this, fieldObject, schema);
		fields.push(field);
	}

	return { fields };
}

/**
 * Get all fields including entity ID (for update operation)
 */
export async function getFieldsWithEntityId(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const returnData = await getFields.call(this);
	const database = getDatabaseParam.call(this);
	const schema = await getSchema.call(this);
	const typeObject = schema.getTypeObjectByName(database);

	return {
		fields: [
			{
				id: typeObject.idField,
				displayName: 'Entity ID',
				required: false,
				defaultMatch: true,
				display: true,
				type: 'string',
				readOnly: true,
				canBeUsedToMatch: true,
			},
			...returnData.fields,
		],
	};
}

/**
 * Get fields including entity ID, excluding collection fields (for update operation)
 */
export async function getFieldsWithEntityIdWithoutCollections(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const returnData = await getFieldsWithoutCollections.call(this);
	const database = getDatabaseParam.call(this);
	const schema = await getSchema.call(this);
	const typeObject = schema.getTypeObjectByName(database);

	return {
		fields: [
			{
				id: typeObject.idField,
				displayName: 'Entity ID',
				required: false,
				defaultMatch: true,
				display: true,
				type: 'string',
				readOnly: true,
				canBeUsedToMatch: true,
			},
			...returnData.fields,
		],
	};
}
