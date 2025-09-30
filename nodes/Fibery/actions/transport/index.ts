import { factory, Schema } from '@fibery/schema';
import { LRUCache } from 'lru-cache';
import {
	IDataObject,
	IRequestOptions,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IPollFunctions,
	NodeApiError,
	IHookFunctions,
} from 'n8n-workflow';

const schemaCache = new LRUCache<string, { etag: string; schema: Schema }>({
	max: 100,
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
	headers: IRequestOptions['headers'] = {},
	options: IRequestOptions = {},
) {
	const authenticationMethod = this.getNodeParameter('authentication', 0) as string;

	const baseUrl = await getBaseUrl.call(this);

	const finalOptions: IRequestOptions = {
		headers: {
			'User-Agent': 'n8n-fibery-node',
			...headers,
		},
		method,
		body,
		uri: `${baseUrl}/api/${endpoint}`,
		useQuerystring: false,
		json: true,
		...options,
	};

	return await this.helpers.requestWithAuthentication.call(
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
			resolveWithFullResponse: true,
		});

		const rawSchema = response.body;
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

	const schema = factory.makeSchema(result.rawSchema, { shouldRemoveDeletedTypesAndFields: true });
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
