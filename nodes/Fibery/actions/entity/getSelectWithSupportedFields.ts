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
				select[fieldObject.name] = [fieldObject.name, 'Collaboration~Documents/secret'];
				return select;
			}

			if (isSingleReferenceField(fieldObject)) {
				select[fieldObject.name] = {
					id: [fieldObject.name, fieldObject.typeObject.idField],
					name: [fieldObject.name, fieldObject.typeObject.titleField],
				};
				return select;
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
				return select;
			}

			select[fieldObject.name] = fieldObject.name;
			return select;
		},
		{} as Record<string, unknown>,
	);
};
