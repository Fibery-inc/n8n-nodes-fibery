import { TypeObject } from '@fibery/schema';
import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { addEntityLink, fiberyUrlName } from '../helpers/schema';

export function formatEntityToOutput(
	this: IExecuteFunctions,
	inputIdx: number,
	entity: IDataObject,
	typeObject: TypeObject,
	baseUrl: string,
) {
	const output = this.getNodeParameter('output', inputIdx) as
		| 'simplified'
		| 'raw'
		| 'selectedFields';

	switch (output) {
		case 'selectedFields': {
			const selectedFields = this.getNodeParameter('fieldsToSelect', inputIdx) as string[];

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
