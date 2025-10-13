import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { addEntityLink, fiberyUrlName } from '../helpers/schema';
import { entitiesWithCollabDos } from './withCollabDocs';
import { TypeObject } from '../helpers/schema-factory';

type FileValue = { name: string; secret: string };

function formatFileValue({ name, secret }: FileValue, baseUrl: string) {
	return { name, url: encodeURI(`${baseUrl}/api/files/${secret}`) };
}

export type FormattedFileValue = { name: string; url: string };

function transformFileFieldsToUrls(
	entity: IDataObject,
	typeObject: TypeObject,
	baseUrl: string,
): IDataObject {
	const fileFields = typeObject.fieldObjects.filter((f) => f.type === 'fibery/file');
	fileFields.forEach((field) => {
		const value = entity[field.name] as FileValue | FileValue[];

		if (value) {
			entity[field.name] = Array.isArray(value)
				? value.map((value) => formatFileValue(value, baseUrl))
				: formatFileValue(value, baseUrl);
		}
	});

	return entity;
}

function formatEntity(
	entity: IDataObject,
	typeObject: TypeObject,
	baseUrl: string,
	output: 'simplified' | 'raw' | 'selectedFields',
	selectedFields: string[],
) {
	const entityWithFileUrls = transformFileFieldsToUrls(entity, typeObject, baseUrl);

	switch (output) {
		case 'selectedFields': {
			return selectedFields.includes(fiberyUrlName)
				? addEntityLink(entityWithFileUrls, typeObject, baseUrl)
				: entityWithFileUrls;
		}
		case 'simplified':
		case 'raw':
		default:
			return addEntityLink(entityWithFileUrls, typeObject, baseUrl);
	}
}

export function formatEntitiesOutput(
	this: IExecuteFunctions,
	inputIdx: number,
	entities: IDataObject[],
	typeObject: TypeObject,
	baseUrl: string,
) {
	const output = this.getNodeParameter('output', inputIdx) as
		| 'simplified'
		| 'raw'
		| 'selectedFields';

	const selectedFields =
		output === 'selectedFields'
			? (this.getNodeParameter('fieldsToSelect', inputIdx) as string[])
			: [];

	const formatted = entities.map((entity) =>
		formatEntity(entity, typeObject, baseUrl, output, selectedFields),
	);

	return entitiesWithCollabDos.call(this, formatted, typeObject);
}
