import type {
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { databaseRLC } from './actions/common.descriptions';
import * as listSearch from './actions/methods/listSearch';
import { apiRequest } from './actions/transport';

export class FiberyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Fibery Trigger',
		name: 'fiberyTrigger',
		icon: 'file:fibery.svg',
		group: ['trigger'],
		version: 1,
		description: 'Handle Fibery events to Database from webhooks',
		defaults: {
			name: 'Fibery Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'fiberyTokenApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['fiberyTokenApi'],
					},
				},
			},
			// {
			// 	name: 'fiberyOAuth2Api',
			// 	required: true,
			// 	displayOptions: {
			// 		show: {
			// 			authentication: ['fiberyOAuth2Api'],
			// 		},
			// 	},
			// },
		],

		webhooks: [
			{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Access Token',
						value: 'fiberyTokenApi',
					},
					// {
					// 	name: 'OAuth2',
					// 	value: 'fiberyOAuth2Api',
					// },
				],
				default: 'fiberyTokenApi',
			},
			{
				displayName: 'Only Fibery Admins can configure webhooks.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{ ...databaseRLC, displayOptions: undefined },
		],
	};

	methods = {
		listSearch,
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const { value: database } = this.getNodeParameter('database') as { value: string };

				const webhooks = await apiRequest.call(this, 'GET', `webhooks/v2`);

				for (const webhook of webhooks) {
					if (
						webhook.url === webhookUrl &&
						webhook.type === database &&
						webhook.state === 'active'
					) {
						webhookData.webhookId = webhook.id as string;
						return true;
					}
				}
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');
				const { value: database } = this.getNodeParameter('database') as { value: string };

				const response = await apiRequest.call(this, 'POST', 'webhooks/v2', {
					url: webhookUrl,
					type: database,
				});

				webhookData.webhookId = response.id;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');

				if (webhookData.webhookId !== undefined) {
					await apiRequest.call(this, 'DELETE', `webhooks/v2/${webhookData.webhookId}`);

					delete webhookData.webhookId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
