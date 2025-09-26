import type { IAuthenticateGeneric, ICredentialType, INodeProperties } from 'n8n-workflow';

export class FiberyTokenApi implements ICredentialType {
	name = 'fiberyTokenApi';

	displayName = 'Fibery API Key API';

	documentationUrl = 'https://the.fibery.io/@public/User_Guide/Guide/Fibery-API-keys-252';

	properties: INodeProperties[] = [
		{
			displayName: 'Workspace',
			name: 'workspace',
			type: 'string',
			default: '',
			hint: 'The name of your Fibery workspace',
			placeholder: 'my-company',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Token {{$credentials.apiKey}}',
			},
		},
	};
}
