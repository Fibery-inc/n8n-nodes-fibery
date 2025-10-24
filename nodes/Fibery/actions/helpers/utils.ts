import { INode, IPairedItemData, NodeApiError, NodeOperationError } from 'n8n-workflow';

export function generatePairedItemData(length: number): IPairedItemData[] {
	return Array.from({ length }, (_, item) => ({
		item,
	}));
}

export const prepareFiberyError = (node: INode, error: Error, itemIndex: number) => {
	if (error instanceof NodeApiError) {
		error.context.itemIndex = itemIndex;
		return error;
	}

	if (error instanceof NodeOperationError && error.context.itemIndex === undefined) {
		error.context.itemIndex = itemIndex;
		return error;
	}

	return new NodeOperationError(node, error, { itemIndex });
};

export const keyBy = <T>(array: T[], key: (item: T) => string): Record<string, T> => {
	const result: Record<string, T> = {};
	for (const item of array) {
		result[key(item)] = item;
	}
	return result;
};
