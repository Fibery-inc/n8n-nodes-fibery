import { TypeObject } from '@fibery/schema';
import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { isCollabDoc } from '../helpers/schema';
import { queryCollaborationDocuments } from '../transport';

export async function entitiesWithCollabDos(
	this: IExecuteFunctions,
	entities: IDataObject[],
	typeObject: TypeObject,
) {
	const collabDocsFields = typeObject.fieldObjects.filter(isCollabDoc).map((f) => f.name);

	const secretsMap = collabDocsFields.reduce((map, fieldName) => {
		entities.forEach((entity, entityIdx) => {
			const secret = entity[fieldName] as string;
			if (!secret) {
				return;
			}

			map.set(secret, { entityIdx, fieldName });
		});

		return map;
	}, new Map<string, { entityIdx: number; fieldName: string }>());

	const collaborationDocuments = await queryCollaborationDocuments.call(
		this,
		Array.from(secretsMap.keys()),
		`md`,
	);

	collaborationDocuments.forEach((doc) => {
		const data = secretsMap.get(doc.secret);
		if (!data) {
			return;
		}

		const { entityIdx, fieldName } = data;

		entities[entityIdx][fieldName] = doc.content;
	});

	return entities;
}

export async function entityWithCollabDocs(
	this: IExecuteFunctions,
	entity: IDataObject,
	typeObject: TypeObject,
) {
	const data = await entitiesWithCollabDos.call(this, [entity], typeObject);
	return data[0];
}
