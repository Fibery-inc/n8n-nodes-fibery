import moment from 'moment-timezone';
import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import {
	fiberyFieldToN8nControlType,
	fiberyUrlName,
	getSupportedFieldObjects,
	isSearchableField,
	isWritableField,
} from '../helpers/schema';
import { FieldObject, Schema } from '../helpers/schema-factory';
import { executeSingleCommand, getSchema } from '../transport';
import { getDatabaseParam } from './getDatabaseParam';

export async function loadFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const database = getDatabaseParam.call(this);

	const schema = await getSchema.call(this);

	const typeObject = schema.getTypeObjectByName(database);

	return getSupportedFieldObjects(typeObject)
		.map((fieldObject) => ({
			name: fieldObject.name,
			value: fieldObject.name,
		}))
		.concat([
			{
				name: fiberyUrlName,
				value: fiberyUrlName,
			},
		]);
}

const fieldObjectToOption = (fieldObject: FieldObject, schema: Schema) => ({
	name: fieldObject.title,
	value: JSON.stringify({
		name: fieldObject.name,
		type: fiberyFieldToN8nControlType(fieldObject, schema),
	}),
});

const sortFieldObjects = (a: FieldObject, b: FieldObject) => {
	const aOrder = a.isTitle ? -1 : a.objectEditorOrder;
	const bOrder = b.isTitle ? -1 : b.objectEditorOrder;

	return aOrder - bOrder;
};

export async function getWritableFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const database = getDatabaseParam.call(this);

	const schema = await getSchema.call(this);

	const typeObject = schema.getTypeObjectByName(database);

	const fieldObjects = typeObject.fieldObjects
		.filter((fieldObject) => isWritableField(fieldObject, schema))
		.sort(sortFieldObjects);

	return fieldObjects.map((fieldObject) => fieldObjectToOption(fieldObject, schema));
}

export async function getSelectOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const database = getDatabaseParam.call(this);

	const fieldKey = this.getCurrentNodeParameter('&key', { extractValue: true }) as string;

	const field = JSON.parse(fieldKey).name;

	const schema = await getSchema.call(this);

	const typeObject = schema.getTypeObjectByName(database);

	const fieldObject = typeObject.getFieldObjectByName(field);

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

	const responseData = await executeSingleCommand.call(this, command);

	return responseData;
}

export async function getTimezones(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const returnData: INodePropertyOptions[] = [];
	for (const timezone of moment.tz.names()) {
		const timezoneName = timezone;
		const timezoneId = timezone;
		returnData.push({
			name: timezoneName,
			value: timezoneId,
		});
	}
	returnData.unshift({
		name: 'Default',
		value: 'default',
		description: 'Timezone set in n8n',
	});
	return returnData;
}

export async function getSearchableFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const database = getDatabaseParam.call(this);

	const schema = await getSchema.call(this);

	const typeObject = schema.getTypeObjectByName(database);

	const fieldObjects = typeObject.fieldObjects
		.filter((fieldObject) => isSearchableField(fieldObject, schema))
		.sort(sortFieldObjects);

	return fieldObjects.map((fieldObject) => fieldObjectToOption(fieldObject, schema));
}
