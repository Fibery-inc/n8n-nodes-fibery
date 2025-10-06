import {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
	NodeOperationError,
} from 'n8n-workflow';
import { executeSingleCommand, getSchema } from '../transport';

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
	const database = this.getCurrentNodeParameter('database', {
		extractValue: true,
		ensureType: 'string',
	}) as string;

	if (!database) {
		throw new NodeOperationError(this.getNode(), new Error('Database is required'), {
			description: 'Please select a Database first',
		});
	}

	const schema = await getSchema.call(this);

	const typeObject = schema.typeObjectsByName[database];

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
