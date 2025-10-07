import { TypeObject } from '@fibery/schema';
import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { addEntityLink, fiberyUrlName } from '../helpers/schema';
import { entitiesWithCollabDos } from './withCollabDocs';

function formatEntity(
	entity: IDataObject,
	typeObject: TypeObject,
	baseUrl: string,
	output: 'simplified' | 'raw' | 'selectedFields',
	selectedFields: string[],
) {
	switch (output) {
		case 'selectedFields': {
			return selectedFields.includes(fiberyUrlName)
				? addEntityLink(entity, typeObject, baseUrl)
				: entity;
		}
		case 'simplified':
		case 'raw':
		default:
			return addEntityLink(entity, typeObject, baseUrl);
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
