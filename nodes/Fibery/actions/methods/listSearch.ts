import { ILoadOptionsFunctions, INodeListSearchResult, INodePropertyOptions } from 'n8n-workflow';
import { executeSingleCommand, getSchema } from '../transport';
import { getDatabaseParam } from './getDatabaseParam';

export async function getDatabases(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	let returnData: INodePropertyOptions[] = [];

	const schema = await getSchema.call(this);

	returnData = schema.typeObjects
		.filter(
			(typeObject) =>
				typeObject.isDomain &&
				(filter ? typeObject.name.toLowerCase().includes(filter.toLowerCase()) : true),
		)
		.map((typeObject) => ({
			name: typeObject.name,
			value: typeObject.name,
		}));

	return {
		results: returnData,
	};
}

export async function getEntities(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const database = getDatabaseParam.call(this);

	const schema = await getSchema.call(this);

	const typeObject = schema.getTypeObjectByName(database);

	const pageLimit = 50;

	const offset = paginationToken ? parseInt(paginationToken) : 0;

	const command = {
		command: 'fibery.entity/query',
		args: {
			query: {
				'q/from': database,
				'q/limit': pageLimit,
				'q/offset': offset,
				'q/select': {
					name: typeObject.titleField,
					value: typeObject.idField,
				},
				'q/order-by': [[[typeObject.rankField || typeObject.titleField], 'q/asc']],
				'q/where': filter ? ['q/contains', [typeObject.titleField], '$filter'] : undefined,
			},
			params: {
				$filter: filter,
			},
		},
	};

	const responseData: { name: string; value: string }[] = await executeSingleCommand.call(
		this,
		command,
	);

	return {
		results: responseData.map((entity) => ({
			name: entity.name,
			value: entity.value,
			description: entity.value,
		})),
		paginationToken: responseData.length === pageLimit ? String(offset + pageLimit) : undefined,
	};
}
