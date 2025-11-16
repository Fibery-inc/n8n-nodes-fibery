import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { isCollabDoc, isCollectionReferenceField, isSingleReferenceField } from '../helpers/schema';
import { Schema, TypeObject, FieldObject } from '../helpers/schema-factory';
import { convertTimeZone } from '../helpers/timezones';
import { CollectionItem, executeSingleCommand } from '../transport';

// UUID regex pattern to check if a value is an ID
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a value looks like a Fibery entity ID (UUID)
 */
function isEntityId(value: string): boolean {
	return UUID_PATTERN.test(value);
}

/**
 * Resolve entity name to ID by querying Fibery
 */
async function resolveEntityNameToId(
	context: IExecuteFunctions,
	entityName: string,
	fieldTypeName: string,
	schema: Schema,
): Promise<string | null> {
	try {
		const fieldTypeObject = schema.getTypeObjectByName(fieldTypeName);
		const command = {
			command: 'fibery.entity/query',
			args: {
				query: {
					'q/from': fieldTypeObject.name,
					'q/limit': 1,
					'q/select': {
						id: fieldTypeObject.idField,
					},
					'q/where': ['=', [fieldTypeObject.titleField], '$name'],
				},
				params: {
					$name: entityName,
				},
			},
		};

		const results = await executeSingleCommand.call(context, command);
		if (Array.isArray(results) && results.length > 0 && results[0].id) {
			return results[0].id as string;
		}
		return null;
	} catch (error) {
		// If lookup fails, return null (invalid name)
		return null;
	}
}

/**
 * Build entity update from field values (flat object format)
 * Used when fields.mappingMode is 'defineBelow' or 'autoMapInputData'
 */
export const buildEntityUpdate = async (
	context: IExecuteFunctions,
	fieldValues: IDataObject,
	typeObject: TypeObject,
	schema: Schema,
	nodeTimezone: string,
) => {
	const entity: Record<string, unknown> = {};
	const collections: CollectionItem[] = [];
	const collabDocs: { field: string; content: string }[] = [];

	for (const [fieldName, fieldValue] of Object.entries(fieldValues)) {
		// Skip only if value is undefined (not provided)
		// Allow null to explicitly clear fields
		if (!fieldName || fieldValue === undefined) {
			continue;
		}

		// Try to get the field object
		let fieldObject: FieldObject;
		try {
			fieldObject = typeObject.getFieldObjectByName(fieldName);
		} catch (error) {
			// Field not found in schema, skip it
			continue;
		}

		// Handle different field types
		switch (fieldObject.type) {
			case 'fibery/bool': {
				entity[fieldName] = Boolean(fieldValue);
				break;
			}
			case 'fibery/date-time-range':
			case 'fibery/date-range': {
				// For date ranges, expect an object with start and end properties
				if (typeof fieldValue === 'object' && fieldValue !== null) {
					const rangeValue = fieldValue as IDataObject;
					const timezone = (rangeValue.timezone as string) || nodeTimezone;
					const timezoneValue = timezone === 'default' ? nodeTimezone : timezone;

					entity[fieldName] = {
						start: convertTimeZone(new Date(rangeValue.start as string), timezoneValue).toISOString(),
						end: convertTimeZone(new Date(rangeValue.end as string), timezoneValue).toISOString(),
					};
				}
				break;
			}
			case 'fibery/date-time':
			case 'fibery/date': {
				// ResourceMapper sends dates as ISO strings
				if (fieldValue === null) {
					entity[fieldName] = null;
				} else {
					const dateValue = fieldValue as string;
					entity[fieldName] = convertTimeZone(new Date(dateValue), nodeTimezone).toISOString();
				}
				break;
			}
			default: {
				// Handle reference fields
				if (isSingleReferenceField(fieldObject, schema)) {
					if (fieldValue) {
						const stringValue = String(fieldValue);
						let entityId: string;

						// If it's already an ID (UUID), use it as-is
						if (isEntityId(stringValue)) {
							entityId = stringValue;
						} else {
							// Try to resolve name to ID
							const id = await resolveEntityNameToId(
								context,
								stringValue,
								fieldObject.type,
								schema,
							);
							if (id) {
								entityId = id;
							} else {
								// If name couldn't be resolved, throw error
								const fieldTypeObject = schema.getTypeObjectByName(fieldObject.type);
								throw new Error(
									`Could not find "${stringValue}" in ${fieldTypeObject.name} for field "${fieldName}". Please check the spelling or use the entity ID instead.`,
								);
							}
						}

						entity[fieldName] = {
							[schema.getTypeObjectByName(fieldObject.type).idField]: entityId,
						};
					} else {
						entity[fieldName] = null;
					}
				} else if (isCollectionReferenceField(fieldObject, schema)) {
					// Collection reference fields - support both IDs and names
					const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
					// Only add if there are values to set
					if (values.length > 0 && values[0] !== null && values[0] !== '') {
						// Resolve entity names to IDs if needed
						const resolvedValues: string[] = [];
						for (const value of values) {
							const stringValue = String(value);
							// If it's already an ID (UUID), use it as-is
							if (isEntityId(stringValue)) {
								resolvedValues.push(stringValue);
							} else {
								// Try to resolve name to ID
								const id = await resolveEntityNameToId(
									context,
									stringValue,
									fieldObject.type,
									schema,
								);
								if (id) {
									resolvedValues.push(id);
								} else {
									// If name couldn't be resolved, throw error
									const fieldTypeObject = schema.getTypeObjectByName(fieldObject.type);
									throw new Error(
										`Could not find "${stringValue}" in ${fieldTypeObject.name} for field "${fieldName}". Please check the spelling or use the entity ID instead.`,
									);
								}
							}
						}

						if (resolvedValues.length > 0) {
							collections.push({
								field: fieldName,
								values: resolvedValues,
								type: fieldObject.holderType,
							});
						}
					}
				} else if (isCollabDoc(fieldObject)) {
					// Collaboration document fields
					collabDocs.push({
						field: fieldName,
						content: fieldValue as string,
					});
				} else {
					// Default: just assign the value
					entity[fieldName] = fieldValue;
				}
			}
		}
	}

	return { entity, collections, collabDocs };
};
