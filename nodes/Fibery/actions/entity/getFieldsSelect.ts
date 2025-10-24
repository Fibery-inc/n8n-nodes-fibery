import {
	isCollabDoc,
	isCollectionReferenceField,
	isSingleReferenceField,
	isSupportedField,
} from '../helpers/schema';
import { FieldObject, Schema } from '../helpers/schema-factory';

export function getFieldsSelect(fieldsToSelect: FieldObject[] | Set<FieldObject>, schema: Schema) {
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
				id: [fieldObject.name, schema.getTypeObjectByName(fieldObject.type).idField],
				name: [fieldObject.name, schema.getTypeObjectByName(fieldObject.type).titleField],
			};
			return;
		}

		if (isCollectionReferenceField(fieldObject, schema)) {
			select[fieldObject.name] = {
				'q/from': fieldObject.name,
				'q/limit': 200,
				'q/select': {
					id: schema.getTypeObjectByName(fieldObject.type).idField,
					name: schema.getTypeObjectByName(fieldObject.type).titleField,
				},
			};
			return;
		}

		select[fieldObject.name] = fieldObject.name;
	});

	return select;
}
