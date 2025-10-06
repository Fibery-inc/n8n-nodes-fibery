import { FieldObject, TypeObject } from '@fibery/schema';
import {
	fiberyUrlName,
	getSupportedFieldObjects,
	isCollabDoc,
	isCollectionReferenceField,
	isSingleReferenceField,
	isSupportedField,
} from '../helpers/schema';
import { IExecuteFunctions } from 'n8n-workflow';

// fields that exist on every DB
const getSimplifiedFields = (typeObject: TypeObject) => {
	return [
		typeObject.titleFieldObject,
		typeObject.idFieldObject,
		typeObject.publicIdFieldObject,
		typeObject.fieldObjectsByName['fibery/created-by'],
		typeObject.fieldObjectsByName['fibery/creation-date'],
		typeObject.fieldObjectsByName['fibery/modification-date'],
	];
};

export function getFieldsSelect(this: IExecuteFunctions, inputIdx: number, typeObject: TypeObject) {
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
					? [typeObject.publicIdFieldObject, typeObject.titleFieldObject] // are required to build url
					: typeObject.fieldObjectsByName[f];
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

	const select: Record<string, unknown> = {};

	fieldsToSelect.forEach((fieldObject) => {
		if (!isSupportedField(fieldObject)) {
			return;
		}

		if (isCollabDoc(fieldObject)) {
			select[fieldObject.name] = [fieldObject.name, 'Collaboration~Documents/secret'];
			return;
		}

		if (isSingleReferenceField(fieldObject)) {
			select[fieldObject.name] = {
				id: [fieldObject.name, fieldObject.typeObject.idField],
				name: [fieldObject.name, fieldObject.typeObject.titleField],
			};
			return;
		}

		if (isCollectionReferenceField(fieldObject)) {
			select[fieldObject.name] = {
				'q/from': fieldObject.name,
				'q/limit': 200,
				'q/select': {
					id: fieldObject.typeObject.idField,
					name: fieldObject.typeObject.titleField,
				},
			};
			return;
		}

		select[fieldObject.name] = fieldObject.name;
	});

	return select;
}
