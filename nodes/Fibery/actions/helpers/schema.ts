import { FieldObject, TypeObject } from '@fibery/schema';
import { ControlTypes } from '../constants';
import { IDataObject } from 'n8n-workflow';
//
export const isSingleReferenceField = (fieldObject: FieldObject) => {
	const fieldTypeObject = fieldObject.typeObject;
	return (
		fieldTypeObject &&
		!fieldTypeObject.isPrimitive &&
		(fieldObject.cardinality === `:cardinality/many-to-one` ||
			fieldObject.cardinality === `:cardinality/one-to-one`) &&
		fieldTypeObject.titleField
	);
};

export const isCollectionReferenceField = (fieldObject: FieldObject) => {
	const fieldTypeObject = fieldObject.typeObject;
	return (
		fieldTypeObject &&
		!fieldTypeObject.isPrimitive &&
		(fieldObject.cardinality === `:cardinality/one-to-many` ||
			fieldObject.cardinality === `:cardinality/many-to-many`) &&
		fieldTypeObject.titleField
	);
};

export const fiberyFieldToN8nControlType = (fieldObject: FieldObject) => {
	switch (fieldObject.type) {
		case 'fibery/text':
		case 'fibery/email':
		case 'fibery/emoji':
		case 'fibery/uuid':
		case 'fibery/url':
			return ControlTypes.text;
		case 'fibery/decimal':
		case 'fibery/number':
		case 'fibery/int':
			return ControlTypes.number;
		case 'fibery/bool':
			return ControlTypes.boolean;
		case 'fibery/date':
		case 'fibery/date-time':
			return ControlTypes.date;
		case 'fibery/date-range':
		case 'fibery/date-time-range':
			return ControlTypes.dateRange;

		default: {
			if (isSingleReferenceField(fieldObject)) {
				return ControlTypes.select;
			}
			if (isCollectionReferenceField(fieldObject)) {
				return ControlTypes.multiSelect;
			}
			return null;
		}
	}
};

export const isSupportedField = (fieldObject: FieldObject) => {
	return (
		fieldObject.type !== `fibery/Button` &&
		fieldObject.name !== `Collaboration~Documents/References` &&
		fieldObject.type !== `fibery/view` &&
		fieldObject.type !== `comments/comment` &&
		fieldObject.type !== `fibery/file`
	);
};

export const isWritableField = (fieldObject: FieldObject) =>
	!fieldObject.isReadOnly &&
	isSupportedField(fieldObject) &&
	fiberyFieldToN8nControlType(fieldObject);

const SEARCHABLE_TYPES = new Set([
	'fibery/uuid',
	'fibery/decimal',
	'fibery/int',
	'fibery/bool',
	'fibery/date',
	'fibery/date-time',
	'fibery/email',
	'fibery/text',
	'fibery/url',
]);
export const isSearchableField = (fieldObject: FieldObject) => {
	return (
		(SEARCHABLE_TYPES.has(fieldObject.type) ||
			isSingleReferenceField(fieldObject) ||
			isCollectionReferenceField(fieldObject)) &&
		isSupportedField(fieldObject)
	);
};

export const isCollabDoc = (fieldObject: FieldObject) => {
	return fieldObject.type === `Collaboration~Documents/Document`;
};

const urlAllowedChars = [`$`, `-`, `_`, `.`, `+`, `!`, `*`, `'`, `(`, `)`, `,`];

const escapeRegExpChar = (x: string) => `\\${x}`;
const urlAllowedCharsPatternGroup = `a-zA-Z0-9${urlAllowedChars.map(escapeRegExpChar).join('')}`;
const nonUrlChars = new RegExp(`[^${urlAllowedCharsPatternGroup}]+`, 'g');

const makeLocator = (publicId: string, title?: string) => {
	if (!publicId) {
		throw new Error('publicId is required');
	}
	const limit = 100;
	return [
		title && title.replace(nonUrlChars, ' ').trim().replace(/ /g, '_').substring(0, limit),
		publicId,
	]
		.filter(Boolean)
		.join('-');
};

export const fiberyUrlName = 'Fibery Url';

export const addEntityLink = (entity: IDataObject, typeObject: TypeObject, baseUrl: string) => {
	const path = `/${typeObject.name.replace(/ /g, '_')}/${makeLocator(
		entity[typeObject.publicIdFieldObject.name] as string,
		entity[typeObject.titleFieldObject.name] as string,
	)}`;
	entity[fiberyUrlName] = encodeURI(`${baseUrl}${path}`);
	return entity;
};

const sortFieldObjects = (a: FieldObject, b: FieldObject) => {
	const aOrder = a.isTitle ? -1 : a.objectEditorOrder;
	const bOrder = b.isTitle ? -1 : b.objectEditorOrder;

	return aOrder - bOrder;
};

export const getSupportedFieldObjects = (typeObject: TypeObject) => {
	return typeObject.fieldObjects.filter(isSupportedField).sort(sortFieldObjects);
};
