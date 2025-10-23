import { ILoadOptionsFunctions, NodeOperationError } from 'n8n-workflow';

export function getDatabaseParam(this: ILoadOptionsFunctions) {
	const database = this.getCurrentNodeParameter('database', {
		extractValue: true,
		ensureType: 'string',
	}) as string;

	if (!database) {
		throw new NodeOperationError(this.getNode(), new Error('Database is required'), {
			description: 'Please select a Database first',
		});
	}

	return database;
}
