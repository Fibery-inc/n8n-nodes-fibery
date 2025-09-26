import { ILoadOptionsFunctions, INodeListSearchResult, INodePropertyOptions } from 'n8n-workflow';
import { getSchema } from '../transport';

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
