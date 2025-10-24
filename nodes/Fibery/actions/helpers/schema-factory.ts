/**
 * mini-version of https://www.npmjs.com/package/@fibery/schema
 * latest update from 10.2.8
 */

import { keyBy } from './utils';

export type RawField = {
	'fibery/id': string;
	'fibery/name': string;
	'fibery/type': string;
	'fibery/description'?: string;
	'fibery/meta': {
		'fibery/collection?'?: boolean;
		'fibery/field-reversed-collection?'?: boolean;
		'ui/title?'?: boolean;
		'fibery/id?'?: boolean;
		'fibery/public-id?'?: boolean;
		'fibery/readonly?'?: boolean;
		'formula/formula?'?: boolean;
		'formula/disabled?'?: boolean;
		'formula/disable-reason'?: string;
		'formula/formula'?: unknown;
		'formula/lookup?'?: boolean;
		'link-rule/link-rule?'?: boolean;
		'link-rule/link-rule'?: unknown;
		'link-rule/disabled?'?: boolean;
		'link-rule/disable-reason'?: string;
		'fibery/relation'?: string;
		'fibery/default-value'?: unknown;
		'ui/object-editor-order'?: number;
		'fibery/required?'?: boolean;
		'ui/hidden?'?: boolean;
		'ui/disable-link-existing-items'?: boolean;
		'fibery/multi-relation'?: string;
		'fibery/dependency?'?: boolean;
		'fibery/dependency-start?'?: boolean;
	};
	'fibery/deleted?': boolean;
};

export type RawType = {
	'fibery/name': string;
	'fibery/id': string;
	'fibery/description'?: string | null;
	'fibery/deleted?': boolean;
	'fibery/meta': {
		'fibery/domain?'?: boolean;
		'fibery/platform?'?: boolean;
		'fibery/highlight?'?: boolean;
		'app/mixin?'?: boolean;
		'ui/mixin-icon'?: string;
		'fibery/enum?'?: boolean;
		'fibery/primitive?'?: boolean;
		'ui/writer-mode?'?: boolean;
		'ui/color'?: string;
		'ui/units'?: unknown[];
		'app/mixins'?: Record<string, boolean>;
		'sync/source'?: { appId: string; appName: string; id: string; state: string; type: string };
		'fibery/secured?'?: boolean;
	};
	'fibery/fields': Array<RawField>;
};

export type RawSchema = {
	'fibery/version': number;
	'fibery/types': Array<RawType>;
	'fibery/meta': Record<string, unknown>;
	'fibery/id': string;
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const pascalCase = (str = '') => {
	const parts = str.split('/');
	const name = parts[parts.length - 1] || '';

	return name.split('-').map(capitalize).join(' ');
};

const splitKeyword = (keyword: string) => {
	const str = keyword || '';
	const index = str.indexOf('/');
	if (index === -1) {
		return {
			namespace: '',
			name: str,
		};
	}
	const namespace = str.substring(0, index);
	const name = str.substring(index + 1);
	return {
		namespace,
		name,
	};
};

const isObsoleteTitle = (str: string) => {
	const { name } = splitKeyword(str);
	return name.toLowerCase() === name && !hasTildes(name);
};
const hasTildes = (str: string) => str.includes('~');
const replaceTildes = (str: string) => str.split('~').join(' ');

const nameOverrides: Record<string, string> = {
	'fibery/type': 'fibery/Database',
	'fibery/app': 'fibery/Space',
};

const toTypeOrFieldTitle = (name: string) => {
	return replaceTildes(capitalize(name));
};

export const toNonEnumTitle = (strName: string) => {
	const str = nameOverrides[strName] || strName;
	const { name } = splitKeyword(str);
	return isObsoleteTitle(str) ? pascalCase(name) : toTypeOrFieldTitle(name);
};

const makeFieldObject = (rawField: RawField, { holderType }: { holderType: string }) => {
	const rawMeta = rawField['fibery/meta'] || {};

	const name = rawField['fibery/name'];

	return {
		id: rawField['fibery/id'],
		name,
		title:
			name === 'fibery/role' && holderType === 'fibery/user' ? 'User Role' : toNonEnumTitle(name),
		type: rawField['fibery/type'],
		rawMeta,
		holderType,
		objectEditorOrder: rawMeta['ui/object-editor-order'] || 0,
		isCollection: rawMeta['fibery/collection?'] || false,
		relation: rawMeta['fibery/relation'] || null,
		multiRelation: rawMeta['fibery/multi-relation'] || null,
		isReadOnly: rawMeta['fibery/readonly?'] || false,
		isId: rawMeta['fibery/id?'] || false,
		isPublicId: rawMeta['fibery/public-id?'] || false,
		isTitle: rawMeta['ui/title?'] || false,
		isRequired: rawMeta['fibery/required?'] === true,
	};
};

export type FieldObject = ReturnType<typeof makeFieldObject>;

const makeTypeObject = (rawType: RawType) => {
	const rawMeta = rawType['fibery/meta'] || {};

	const fieldShortcuts = {
		idField: 'fibery/id',
		publicIdField: 'fibery/public-id',
		titleField: '',
		rankField: null,
	} as {
		idField: string;
		publicIdField: string;
		titleField: string;
		rankField: string | null;
	};

	const installedMixins = new Set(Object.keys(rawMeta['app/mixins'] || {}));

	const hasRank = installedMixins.has('fibery/rank-mixin');

	const fieldObjects = rawType['fibery/fields']
		.filter((rawField) => rawField['fibery/deleted?'] !== true)
		.map((f) => {
			const fieldObject = makeFieldObject(f, { holderType: rawType['fibery/name'] });

			if (fieldObject.isId) {
				fieldShortcuts.idField = fieldObject.name;
			} else if (fieldObject.isPublicId) {
				fieldShortcuts.publicIdField = fieldObject.name;
			} else if (fieldObject.isTitle) {
				fieldShortcuts.titleField = fieldObject.name;
			} else if (hasRank && fieldObject.name === 'fibery/rank') {
				fieldShortcuts.rankField = fieldObject.name;
			}

			return fieldObject;
		});

	const fieldObjectsByName = keyBy(fieldObjects, (f) => f.name);

	return {
		id: rawType['fibery/id'],
		name: rawType['fibery/name'],
		rawMeta,
		isDomain: rawMeta['fibery/domain?'] || false,
		isPrimitive: rawMeta['fibery/primitive?'] || false,
		fieldObjects,
		getFieldObjectByName(name: string) {
			const fieldObject = fieldObjectsByName[name];

			if (!fieldObject) {
				throw new Error(`Field "${name}" not found in the database "${rawType['fibery/name']}"`);
			}

			return fieldObject;
		},
		isEntityRef: rawType['fibery/name'] === 'fibery/entity-ref',
		installedMixins,
		...fieldShortcuts,
	};
};

export type TypeObject = ReturnType<typeof makeTypeObject>;

export const makeSchema = (rawSchema: RawSchema) => {
	const { 'fibery/types': rawTypes, ...schemaRest } = rawSchema;
	const typeObjects = rawTypes
		.filter((rawType) => rawType['fibery/deleted?'] !== true)
		.map(makeTypeObject);

	const typeObjectsByName = keyBy(typeObjects, (t) => t.name);

	return {
		...schemaRest,
		typeObjects,
		getTypeObjectByName(name: string) {
			const typeObject = typeObjectsByName[name];

			if (!typeObject) {
				throw new Error(`Database "${name}" not found in the schema`);
			}

			return typeObject;
		},
	};
};

export type Schema = ReturnType<typeof makeSchema>;
