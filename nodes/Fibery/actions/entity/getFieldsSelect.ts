import {
	fiberyUrlName,
	getSupportedFieldObjects,
	isCollabDoc,
	isCollectionReferenceField,
	isSingleReferenceField,
	isSupportedField,
} from '../helpers/schema';
import { IExecuteFunctions } from 'n8n-workflow';
import { FieldObject, Schema, TypeObject } from '../helpers/schema-factory';

// fields that exist on every DB
const getSimplifiedFields = (typeObject: TypeObject) => {
	return [
		typeObject.fieldObjectsByName[typeObject.titleField],
		typeObject.fieldObjectsByName[typeObject.idField],
		typeObject.fieldObjectsByName[typeObject.publicIdField],
		typeObject.fieldObjectsByName['fibery/created-by'],
		typeObject.fieldObjectsByName['fibery/creation-date'],
		typeObject.fieldObjectsByName['fibery/modification-date'],
	];
};

export function getFieldsSelect(
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
							typeObject.fieldObjectsByName[typeObject.publicIdField],
							typeObject.fieldObjectsByName[typeObject.titleField],
						] // are required to build url
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

		if (fieldObject.type === 'fibery/file') {
			select[fieldObject.name] = isSingleReferenceField(fieldObject, schema)
				? {
						name: [fieldObject.name, 'fibery/name'],
						secret: [fieldObject.name, 'fibery/secret'],
					}
				: {
						'q/from': [fieldObject.name],
						'q/limit': 'q/no-limit',
						'q/select': {
							name: ['fibery/name'],
							secret: ['fibery/secret'],
						},
					};
			return;
		}

		if (isSingleReferenceField(fieldObject, schema)) {
			select[fieldObject.name] = {
				id: [fieldObject.name, schema.typeObjectsByName[fieldObject.type].idField],
				name: [fieldObject.name, schema.typeObjectsByName[fieldObject.type].titleField],
			};
			return;
		}

		if (isCollectionReferenceField(fieldObject, schema)) {
			select[fieldObject.name] = {
				'q/from': fieldObject.name,
				'q/limit': 200,
				'q/select': {
					id: schema.typeObjectsByName[fieldObject.type].idField,
					name: schema.typeObjectsByName[fieldObject.type].titleField,
				},
			};
			return;
		}

		select[fieldObject.name] = fieldObject.name;
	});

	return select;
}
