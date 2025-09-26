import { FieldObject, TypeObject } from '@fibery/schema';
import {
	isCollabDoc,
	isCollectionReferenceField,
	isSupportedField,
	isSingleReferenceField,
} from '../helpers/schema';

const sortFieldObjects = (a: FieldObject, b: FieldObject) => {
	const aOrder = a.isTitle ? -1 : a.objectEditorOrder;
	const bOrder = b.isTitle ? -1 : b.objectEditorOrder;

	return aOrder - bOrder;
};

export const getSelectWithSupportedFields = (typeObject: TypeObject) => {
	return typeObject.fieldObjects.sort(sortFieldObjects).reduce(
		(select, fieldObject) => {
			if (!isSupportedField(fieldObject)) {
				return select;
			}

			if (isCollabDoc(fieldObject)) {
				select[fieldObject.title] = [fieldObject.name, 'Collaboration~Documents/secret'];
				return select;
			}

			if (isSingleReferenceField(fieldObject)) {
				select[fieldObject.title] = {
					id: [fieldObject.name, fieldObject.typeObject.idField],
					name: [fieldObject.name, fieldObject.typeObject.titleField],
				};
				return select;
			}

			if (isCollectionReferenceField(fieldObject)) {
				select[fieldObject.title] = {
					'q/from': fieldObject.name,
					'q/limit': 200,
					'q/select': {
						id: fieldObject.typeObject.idField,
						name: fieldObject.typeObject.titleField,
					},
				};
				return select;
			}

			select[fieldObject.title] = fieldObject.name;
			return select;
		},
		{} as Record<string, unknown>,
	);
};
