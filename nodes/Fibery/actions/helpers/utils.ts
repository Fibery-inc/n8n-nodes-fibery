import { INode, IPairedItemData, NodeApiError, NodeOperationError } from 'n8n-workflow';
import set from 'lodash/set';

export function generatePairedItemData(length: number): IPairedItemData[] {
	return Array.from({ length }, (_, item) => ({
		item,
	}));
}

export const prepareFiberyError = (node: INode, error: Error, itemIndex: number) => {
	if (error instanceof NodeApiError) {
		set(error, 'context.itemIndex', itemIndex);
		return error;
	}

	if (error instanceof NodeOperationError && error?.context?.itemIndex === undefined) {
		set(error, 'context.itemIndex', itemIndex);
		return error;
	}

	return new NodeOperationError(node, error, { itemIndex });
};
