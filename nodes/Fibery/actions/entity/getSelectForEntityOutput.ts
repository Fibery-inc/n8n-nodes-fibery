import { IExecuteFunctions } from 'n8n-workflow';
import { fiberyUrlName, getSupportedFieldObjects } from '../helpers/schema';
import { FieldObject, Schema, TypeObject } from '../helpers/schema-factory';
import { getFieldsSelect } from './getFieldsSelect';

// fields that exist on every DB
const getSimplifiedFields = (typeObject: TypeObject) => {
	return [
		typeObject.getFieldObjectByName(typeObject.titleField),
		typeObject.getFieldObjectByName(typeObject.idField),
		typeObject.getFieldObjectByName(typeObject.publicIdField),
		typeObject.getFieldObjectByName('fibery/created-by'),
		typeObject.getFieldObjectByName('fibery/creation-date'),
		typeObject.getFieldObjectByName('fibery/modification-date'),
	];
};

export function getSelectForEntityOutput(
	this: IExecuteFunctions,
	inputIdx: number,
	typeObject: TypeObject,
	schema: Schema,
) {
	const output = this.getNodeParameter('output', inputIdx) as
		| 'simplified'
		| 'raw'
		| 'selectedFields';

	let fieldsToSelect: Set<FieldObject> = new Set();

	switch (output) {
		case 'raw': {
			fieldsToSelect = new Set(getSupportedFieldObjects(typeObject));
			break;
		}
		case 'selectedFields': {
			const selectedFields = this.getNodeParameter('fieldsToSelect', inputIdx) as string[];

			const fieldObjects = selectedFields.flatMap((f) => {
				return f === fiberyUrlName
					? [
							typeObject.getFieldObjectByName(typeObject.publicIdField),
							typeObject.getFieldObjectByName(typeObject.titleField),
						] // are required to build url
					: typeObject.getFieldObjectByName(f);
			});

			fieldsToSelect = new Set(fieldObjects);

			break;
		}
		default:
		case 'simplified': {
			fieldsToSelect = new Set(getSimplifiedFields(typeObject));
			break;
		}
	}

	return getFieldsSelect(fieldsToSelect, schema);
}
