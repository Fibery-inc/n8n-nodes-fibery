import { TypeObject } from '@fibery/schema';
import moment from 'moment-timezone';
import { IDataObject } from 'n8n-workflow';
import { isCollabDoc, isCollectionReferenceField, isSingleReferenceField } from '../helpers/schema';
import { CollectionItem } from '../transport';

export const buildEntityUpdate = (
	fieldValues: IDataObject[],
	typeObject: TypeObject,
	nodeTimezone: string,
) => {
	const entity: Record<string, unknown> = {};
	const collections: CollectionItem[] = [];
	const collabDocs: { field: string; content: string }[] = [];

	for (const fieldValue of fieldValues) {
		const { key, value, valueStart, valueEnd, checked, timezone } = fieldValue;

		if (typeof key === 'string' && key.length > 0) {
			const { name } = JSON.parse(key);

			const fieldObject = typeObject.fieldObjectsByName[name];

			switch (fieldObject.type) {
				case 'fibery/bool': {
					entity[name] = checked;
					break;
				}
				case 'fibery/date-time-range':
				case 'fibery/date-range': {
					const timezoneValue = timezone === 'default' ? nodeTimezone : (timezone as string);

					entity[name] = {
						start: moment.tz(valueStart as string, timezoneValue).toISOString(),
						end: moment.tz(valueEnd as string, timezoneValue).toISOString(),
					};
					break;
				}
				case 'fibery/datetime':
				case 'fibery/date': {
					const timezoneValue = timezone === 'default' ? nodeTimezone : (timezone as string);

					entity[name] = moment.tz(value as string, timezoneValue).toISOString();
					break;
				}
				default: {
					if (isSingleReferenceField(fieldObject)) {
						entity[name] = value
							? {
									[fieldObject.typeObject.idField]: value,
								}
							: null;
					} else if (isCollectionReferenceField(fieldObject)) {
						collections.push({
							field: name,
							values: value as string[],
							type: fieldObject.holderType,
						});
					} else if (isCollabDoc(fieldObject)) {
						collabDocs.push({
							field: name,
							content: value as string,
						});
					} else {
						entity[name] = value;
					}
				}
			}
		}
	}

	return { entity, collections, collabDocs };
};
