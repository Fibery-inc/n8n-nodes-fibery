import { IDataObject } from 'n8n-workflow';
import { ControlTypes } from '../constants';
import { FieldObject, Schema, TypeObject } from './schema-factory';

const getRelatedFieldObject = (fieldObject: FieldObject, schema: Schema) => {
	if (!fieldObject.relation && !fieldObject.multiRelation) {
		return null;
	}

	const typeObject = schema.typeObjectsByName[fieldObject.type];

	if (!fieldObject.relation && fieldObject.multiRelation && typeObject.isEntityRef) {
		return null;
	}

	let relationKey: 'relation' | 'multiRelation';
	let relationId: string | null;
	if (fieldObject.relation) {
		relationKey = 'relation';
		relationId = fieldObject.relation;
	} else {
		relationId = fieldObject.multiRelation;
		relationKey = 'multiRelation';
	}

	const selector =
		fieldObject.type !== fieldObject.holderType
			? (f: FieldObject) => f[relationKey] === relationId
			: (f: FieldObject) => f[relationKey] === relationId && f.name !== fieldObject.name;
	const relatedFieldObject = typeObject.fieldObjects.find(selector);
	if (!relatedFieldObject) {
		throw new Error(`there no other end for ${relationKey} ${relationId}`);
	}
	return relatedFieldObject;
};

const getCardinality = (fieldObject: FieldObject, schema: Schema) => {
	const fieldTypeObject = schema.typeObjectsByName[fieldObject.type];
	const relatedFieldObject = getRelatedFieldObject(fieldObject, schema);
	const isCollection = fieldObject.isCollection;

	if (fieldTypeObject.isPrimitive) {
		throw new Error('Only non-basic fields have cardinality');
	}
	if (isCollection && fieldObject.rawMeta['fibery/field-reversed-collection?']) {
		return ':cardinality/many-to-many';
	}
	if (!relatedFieldObject) {
		return isCollection ? ':cardinality/one-to-many' : ':cardinality/many-to-one';
	}
	const isRelationCollection = relatedFieldObject.isCollection;
	if (!isCollection && !isRelationCollection) {
		return ':cardinality/one-to-one';
	}
	if (isCollection && !isRelationCollection) {
		return ':cardinality/one-to-many';
	}
	if (!isCollection && isRelationCollection) {
		return ':cardinality/many-to-one';
	}
	if (isCollection && isRelationCollection) {
		return ':cardinality/many-to-many';
	}
	throw new Error('get cardinality invariant');
};

export const isSingleReferenceField = (fieldObject: FieldObject, schema: Schema) => {
	const fieldTypeObject = schema.typeObjectsByName[fieldObject.type];

	if (fieldTypeObject.isPrimitive) {
		return false;
	}

	const cardinality = getCardinality(fieldObject, schema);
	return (
		(cardinality === `:cardinality/many-to-one` || cardinality === `:cardinality/one-to-one`) &&
		fieldTypeObject.titleField
	);
};

export const isCollectionReferenceField = (fieldObject: FieldObject, schema: Schema) => {
	const fieldTypeObject = schema.typeObjectsByName[fieldObject.type];

	if (fieldTypeObject.isPrimitive) {
		return false;
	}

	const cardinality = getCardinality(fieldObject, schema);

	return (
		(cardinality === `:cardinality/one-to-many` || cardinality === `:cardinality/many-to-many`) &&
		fieldTypeObject.titleField
	);
};

export const fiberyFieldToN8nControlType = (fieldObject: FieldObject, schema: Schema) => {
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
			if (isSingleReferenceField(fieldObject, schema)) {
				return ControlTypes.select;
			}
			if (isCollectionReferenceField(fieldObject, schema)) {
				return ControlTypes.multiSelect;
			}
			if (isCollabDoc(fieldObject)) {
				return ControlTypes.textArea;
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
		fieldObject.type !== `comments/comment`
	);
};

export const isWritableField = (fieldObject: FieldObject, schema: Schema) =>
	!fieldObject.isReadOnly &&
	isSupportedField(fieldObject) &&
	fieldObject.type !== `fibery/file` &&
	fiberyFieldToN8nControlType(fieldObject, schema);

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
export const isSearchableField = (fieldObject: FieldObject, schema: Schema) => {
	return (
		(SEARCHABLE_TYPES.has(fieldObject.type) ||
			isSingleReferenceField(fieldObject, schema) ||
			isCollectionReferenceField(fieldObject, schema)) &&
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
		entity[typeObject.publicIdField] as string,
		entity[typeObject.titleField] as string,
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
