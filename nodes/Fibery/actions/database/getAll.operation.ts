import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';
import { generatePairedItemData } from '../helpers/utils';
import { getSchema } from '../transport';

const displayOptions = {
	show: {
		resource: ['database'],
		operation: ['getAll'],
	},
};

const properties: INodeProperties[] = [];

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[]> {
	let dbs: IDataObject[] = [];

	const schema = await getSchema.call(this);

	dbs = schema.typeObjects
		.filter((typeObject) => typeObject.isDomain)
		.map((typeObject) => ({
			id: typeObject.id,
			name: typeObject.name,
		}));

	const itemData = generatePairedItemData(this.getInputData().length);

	const returnData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(dbs), {
		itemData,
	});

	return returnData;
}
