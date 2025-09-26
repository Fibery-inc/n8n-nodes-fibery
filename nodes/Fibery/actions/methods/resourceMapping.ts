import { ILoadOptionsFunctions, ResourceMapperField, ResourceMapperFields } from 'n8n-workflow';
import { getSchema } from '../transport';

export async function getWritableFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const database = this.getCurrentNodeParameter('database', { extractValue: true }) as string;

	const schema = await getSchema.call(this);

	const typeObject = schema.typeObjectsByName[database];

	const fields: ResourceMapperField[] = [];

	for (const fieldObject of typeObject.fieldObjects) {
		fields.push({
			id: fieldObject.name,
			displayName: fieldObject.title,
			required: fieldObject.isRequired,
			readOnly: fieldObject.isReadOnly,
			defaultMatch: false,
			display: true,
			canBeUsedToMatch: true,
		});
	}

	return { fields };
}
