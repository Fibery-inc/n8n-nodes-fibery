import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { addEntityLink, fiberyUrlName } from '../helpers/schema';
import { entitiesWithCollabDos } from './withCollabDocs';
import { TypeObject } from '../helpers/schema-factory';

function transformFileFieldsToUrls(
	entity: IDataObject,
	typeObject: TypeObject,
	baseUrl: string,
): IDataObject {
	const fileFields = typeObject.fieldObjects.filter((f) => f.type === 'fibery/file');
	fileFields.forEach((field) => {
		if (entity[field.name]) {
			entity[field.name] = (entity[field.name] as { name: string; secret: string }[]).map(
				({ name, secret }) => ({ name, url: encodeURI(`${baseUrl}/api/files/${secret}`) }),
			);
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
