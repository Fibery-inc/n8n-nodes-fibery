import {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	NodeApiError,
} from 'n8n-workflow';
import { LRUCache } from '../helpers/lru-cache';
import { makeSchema, RawSchema, Schema } from '../helpers/schema-factory';

const schemaCache = new LRUCache<{ etag: string; schema: Schema }>({
	maxSize: 100,
	ttl: 1000 * 60 * 10,
});
const schemaRequestsPromisesMap = new Map<string, Promise<Schema>>();

export async function getBaseUrl(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions | IHookFunctions,
) {
	const authenticationMethod = this.getNodeParameter('authentication', 0) as string;
	const credentials = await this.getCredentials<{ workspace: string }>(authenticationMethod);

	return `https://${credentials.workspace}.fibery.io`;
}

export async function apiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions | IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject | IDataObject[] | undefined = undefined,
	headers: IHttpRequestOptions['headers'] = {},
	options: Omit<IHttpRequestOptions, 'url'> = {},
) {
	const authenticationMethod = this.getNodeParameter('authentication', 0) as string;

	const baseUrl = await getBaseUrl.call(this);

	const finalOptions: IHttpRequestOptions = {
		headers: {
			'User-Agent': 'n8n-fibery-node',
			...headers,
		},
		method,
		body,
		url: `${baseUrl}/api/${endpoint}`,
		json: true,
		...options,
	};

	return await this.helpers.httpRequestWithAuthentication.call(
		this,
		authenticationMethod,
		finalOptions,
	);
}

export async function executeSingleCommand(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	command: IDataObject,
) {
	const response = await apiRequest.call(this, 'POST', 'commands', command);

	if (!response.success) {
		throw new NodeApiError(this.getNode(), response.result);
	}

	return response.result;
}

export async function executeBatchCommands(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	commands: IDataObject[],
) {
	return executeSingleCommand.call(this, {
		command: `fibery.command/batch`,
		args: { commands },
	});
}

async function getRawSchema(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	etag?: string,
) {
	const headers: Record<string, string> = {};
	if (etag) {
		headers['If-None-Match'] = etag;
	}

	try {
		const response = await apiRequest.call(this, 'GET', 'schema', undefined, headers, {
			returnFullResponse: true,
		});

		const rawSchema = response.body as RawSchema;
		return {
			useCache: false,
			etag: response.headers['etag'],
			rawSchema: rawSchema,
		};
	} catch (error) {
		if (error.httpCode === '304') {
			return {
				useCache: true,
				rawSchema: null,
			};
		}

		throw error;
	}
}

async function getSchemaInternal(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	workspace: string,
) {
	const cachedData = schemaCache.get(workspace);

	const result = await getRawSchema.call(this, cachedData?.etag);
	if (result.useCache) {
		return cachedData!.schema;
	}

	const schema = makeSchema(result.rawSchema!);

	schemaCache.set(workspace, {
		etag: result.etag,
		schema,
	});

	return schema;
}

export async function getSchema(this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions) {
	const { workspace } = await this.getCredentials<{ workspace: string }>('fiberyTokenApi');

	let promise = schemaRequestsPromisesMap.get(workspace);

	if (promise) {
		return promise;
	}

	promise = getSchemaInternal.call(this, workspace).then(
		(data) => {
			schemaRequestsPromisesMap.delete(workspace);
			return data;
		},
		(err) => {
			schemaRequestsPromisesMap.delete(workspace);
			throw err;
		},
	);
	schemaRequestsPromisesMap.set(workspace, promise);

	return promise;
}

export async function createEntity(
	this: IExecuteFunctions,
	typeName: string,
	entity: Record<string, unknown>,
	select: Record<string, unknown>,
) {
	const id = crypto.randomUUID();

	const [
		,
		{
			result: [createdEntity],
		},
	] = await executeBatchCommands.call(this, [
		{
			command: 'fibery.entity/create',
			args: {
				type: typeName,
				entity: {
					'fibery/id': id,
					...entity,
				},
			},
		},
		{
			command: 'fibery.entity/query',
			args: {
				query: {
					'q/from': typeName,
					'q/select': select,
					'q/where': ['=', ['fibery/id'], '$entityId'],
					'q/limit': 1,
				},
				params: { $entityId: id },
			},
		},
	]);

	return createdEntity;
}

export type CollectionItem = {
	field: string;
	values: string[];
	type: string;
};

export async function addCollectionItems(
	this: IExecuteFunctions,
	entityId: string,
	collections: CollectionItem[],
) {
	const addCollectionItemsCommands = collections.map(({ field, values, type }) => ({
		command: `fibery.entity/add-collection-items`,
		args: {
			entity: { 'fibery/id': entityId },
			field: field,
			items: values.map((v) => ({ 'fibery/id': v })),
			type: type,
		},
	}));

	if (addCollectionItemsCommands.length > 0) {
		await executeBatchCommands.call(this, addCollectionItemsCommands);
	}
}

async function executeDocumentsCommand(
	this: IExecuteFunctions,
	command: IDataObject,
	format = 'md',
) {
	return apiRequest.call(this, 'POST', 'documents/commands', command, undefined, {
		qs: {
			format,
		},
	});
}

export async function queryCollaborationDocuments(
	this: IExecuteFunctions,
	secrets: string[],
	format: string,
) {
	if (secrets.length === 0) {
		return [];
	}

	return executeDocumentsCommand.call(
		this,
		{
			command: 'get-documents',
			args: secrets.map((secret) => ({ secret })),
		},
		format,
	) as Promise<{ secret: string; content: string }[]>;
}

export async function updateCollaborationDocuments(
	this: IExecuteFunctions,
	collabDocs: { field: string; content: string }[],
	entity: IDataObject,
	format?: string,
) {
	const secretContentPairs = collabDocs
		.filter((doc) => entity[doc.field])
		.map((doc) => ({
			secret: entity[doc.field],
			content: doc.content,
		}));

	if (secretContentPairs.length === 0) {
		return;
	}

	return executeDocumentsCommand.call(
		this,
		{
			command: 'create-or-update-documents',
			args: secretContentPairs,
		},
		format,
	);
}
