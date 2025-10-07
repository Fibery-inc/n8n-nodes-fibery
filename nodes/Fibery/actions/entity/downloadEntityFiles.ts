import { TypeObject } from '@fibery/schema';
import {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	IPairedItemData,
} from 'n8n-workflow';
import { apiRequest } from '../transport';

export async function downloadEntityFiles(
	this: IExecuteFunctions,
	entities: IDataObject[],
	typeObject: TypeObject,
	pairedItem?: IPairedItemData[],
) {
	const elements: INodeExecutionData[] = [];

	const fileFields = typeObject.fieldObjects
		.filter((f) => f.type === 'fibery/file')
		.map((f) => f.name);

	for (const entity of entities) {
		const element: INodeExecutionData = { json: {}, binary: {} };
		element.json = entity as unknown as IDataObject;
		if (pairedItem) {
			element.pairedItems = pairedItem;
		}
		for (const key of fileFields) {
			const files = entity[key] as { name: string; url: string }[];
			if (files) {
				for (const [index, file] of files.entries()) {
					const data = await apiRequest.call(
						this,
						'GET',
						`files/${file.url.split('/').pop()}`,
						undefined,
						undefined,
						{ json: false, encoding: null },
					);
					element.binary![`${key}_${index}`] = await this.helpers.prepareBinaryData(data as Buffer);
				}
			}
		}
		if (Object.keys(element.binary as IBinaryKeyData).length === 0) {
			delete element.binary;
		}
		elements.push(element);
	}
	return elements;
}
