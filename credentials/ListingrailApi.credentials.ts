import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ListingrailApi implements ICredentialType {
	name = 'listingrailApi';

	displayName = 'Listingrail API';

	icon: Icon = {
		light: 'file:../nodes/Listingrail/listingrail.svg',
		dark: 'file:../nodes/Listingrail/listingrail.dark.svg',
	};

	documentationUrl = 'https://github.com/benthepythondev00/n8n-nodes-listingrail#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 're_...',
			description:
				'Your Listingrail API key. A free key (250 listings a month, no card) is issued at https://listingrail.com/#key.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://listingrail.com',
			description: 'Leave as is unless Listingrail support gives you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// GET /v1/account costs no credits and answers 401 for a wrong key
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
			url: '/v1/account',
		},
	};
}
