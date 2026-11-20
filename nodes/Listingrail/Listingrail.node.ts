import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type JsonObject,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { dropEmpty, getMonitors, getSources, listingrailRequest } from './GenericFunctions';

const sourceField = {
	displayName: 'Source Name or ID',
	name: 'source',
	type: 'options' as const,
	typeOptions: { loadOptionsMethod: 'getSources' },
	required: true,
	default: '',
	description:
		'The property portal, e.g. zillow, rightmove, idealista. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

export class Listingrail implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Listingrail',
		name: 'listingrail',
		icon: { light: 'file:listingrail.svg', dark: 'file:listingrail.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Search sale and rental listings from 22 property portals (Zillow, Rightmove, Idealista and more) and manage listing monitors',
		defaults: { name: 'Listingrail' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'listingrailApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Listing', value: 'listing' },
					{ name: 'Monitor', value: 'monitor' },
					{ name: 'Source', value: 'source' },
				],
				default: 'listing',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['listing'] } },
				options: [
					{
						name: 'Search',
						value: 'search',
						action: 'Search listings',
						description: 'Live listings of one portal and location; one credit per listing returned',
					},
					{
						name: 'Get Details',
						value: 'getDetails',
						action: 'Get listing details',
						description: 'Full facts of one listing by its URL',
					},
					{
						name: 'Get Price History',
						value: 'getHistory',
						action: 'Get price history of a listing',
						description: 'Price changes seen for one listing (paid plans, no credits)',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['monitor'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a monitor',
						description: 'Store a search that Listingrail checks once a day',
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete a monitor',
					},
					{
						name: 'Get Changes',
						value: 'getChanges',
						action: 'Get the last changes of a monitor',
						description: 'New listings, removed listings and price changes from the last daily check',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many monitors',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['source'] } },
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many sources',
						description: 'Every portal with its countries, location format and filters',
					},
				],
				default: 'getAll',
			},

			// listing: search, monitor: create
			{
				...sourceField,
				displayOptions: {
					show: { resource: ['listing'], operation: ['search', 'getDetails', 'getHistory'] },
				},
			},
			{
				...sourceField,
				displayOptions: { show: { resource: ['monitor'], operation: ['create'] } },
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Austin, TX',
				description:
					'City, postcode or area in the format the source takes (shown under the source in the list). A search link of the portal also works for most sources.',
				displayOptions: {
					show: { resource: ['listing', 'monitor'], operation: ['search', 'create'] },
				},
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Rent', value: 'rent' },
					{ name: 'Sale', value: 'sale' },
				],
				default: '',
				displayOptions: {
					show: { resource: ['listing', 'monitor'], operation: ['search', 'create'] },
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 50,
				description: 'Max number of results to return',
				hint: 'Each listing returned costs one credit',
				displayOptions: {
					show: { resource: ['listing', 'monitor'], operation: ['search', 'create'] },
				},
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: { resource: ['listing', 'monitor'], operation: ['search', 'create'] },
				},
				options: [
					{
						displayName: 'Min Price',
						name: 'minPrice',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
					},
					{
						displayName: 'Max Price',
						name: 'maxPrice',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
					},
					{
						displayName: 'Min Bedrooms',
						name: 'minBeds',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
					},
				],
			},
			{
				displayName: 'Split Into Items',
				name: 'split',
				type: 'boolean',
				default: true,
				description:
					'Whether to output one item per listing (on) or the whole response as one item (off)',
				displayOptions: { show: { resource: ['listing'], operation: ['search'] } },
			},

			// listing: details, history
			{
				displayName: 'Listing URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://www.rightmove.co.uk/properties/94455012',
				displayOptions: { show: { resource: ['listing'], operation: ['getDetails'] } },
			},
			{
				displayName: 'Listing ID',
				name: 'listingId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID field of a listing; where a portal gives none, the listing URL',
				displayOptions: { show: { resource: ['listing'], operation: ['getHistory'] } },
			},

			// monitor: create
			{
				displayName: 'Additional Fields',
				name: 'monitorFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['monitor'], operation: ['create'] } },
				options: [
					{
						displayName: 'Webhook URL',
						name: 'webhook_url',
						type: 'string',
						default: '',
						description:
							'Public http(s) address that receives the changes as JSON after each daily check (an n8n Webhook node URL works)',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						description: 'Address that receives the changes by email',
					},
				],
			},

			// monitor: delete, getChanges
			{
				displayName: 'Monitor Name or ID',
				name: 'monitorId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getMonitors' },
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				displayOptions: { show: { resource: ['monitor'], operation: ['delete', 'getChanges'] } },
			},
		],
	};

	methods = { loadOptions: { getSources, getMonitors } };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const push = (json: IDataObject | IDataObject[]) => {
					for (const j of Array.isArray(json) ? json : [json]) {
						out.push({ json: j, pairedItem: { item: i } });
					}
				};

				if (resource === 'listing' && operation === 'search') {
					const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
					const body = dropEmpty({
						source: this.getNodeParameter('source', i),
						location: this.getNodeParameter('location', i),
						type: this.getNodeParameter('type', i, ''),
						limit: this.getNodeParameter('limit', i, 50),
						minPrice: filters.minPrice || undefined,
						maxPrice: filters.maxPrice || undefined,
						minBeds: filters.minBeds || undefined,
					});
					const data = await listingrailRequest.call(this, 'POST', '/v1/listings/search', body);
					if (this.getNodeParameter('split', i, true)) {
						push((data.listings as IDataObject[]) || []);
					} else {
						push(data);
					}
				} else if (resource === 'listing' && operation === 'getDetails') {
					push(
						await listingrailRequest.call(this, 'POST', '/v1/listings/details', {
							source: this.getNodeParameter('source', i),
							url: this.getNodeParameter('url', i),
						}),
					);
				} else if (resource === 'listing' && operation === 'getHistory') {
					const source = encodeURIComponent(this.getNodeParameter('source', i) as string);
					const id = encodeURIComponent(this.getNodeParameter('listingId', i) as string);
					push(await listingrailRequest.call(this, 'GET', `/v1/listings/${source}/${id}/history`));
				} else if (resource === 'monitor' && operation === 'create') {
					const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
					const extra = this.getNodeParameter('monitorFields', i, {}) as IDataObject;
					const body = dropEmpty({
						source: this.getNodeParameter('source', i),
						location: this.getNodeParameter('location', i),
						filters: dropEmpty({
							type: this.getNodeParameter('type', i, ''),
							limit: this.getNodeParameter('limit', i, 50),
							minPrice: filters.minPrice || undefined,
							maxPrice: filters.maxPrice || undefined,
							minBeds: filters.minBeds || undefined,
						}),
						webhook_url: extra.webhook_url,
						email: extra.email,
					});
					push(await listingrailRequest.call(this, 'POST', '/v1/monitors', body));
				} else if (resource === 'monitor' && operation === 'getAll') {
					const data = await listingrailRequest.call(this, 'GET', '/v1/monitors');
					push((data.monitors as IDataObject[]) || []);
				} else if (resource === 'monitor' && operation === 'getChanges') {
					const id = this.getNodeParameter('monitorId', i);
					push(await listingrailRequest.call(this, 'GET', `/v1/monitors/${id}/changes`));
				} else if (resource === 'monitor' && operation === 'delete') {
					const id = this.getNodeParameter('monitorId', i);
					push(await listingrailRequest.call(this, 'DELETE', `/v1/monitors/${id}`));
				} else if (resource === 'source' && operation === 'getAll') {
					const data = await listingrailRequest.call(this, 'GET', '/v1/sources');
					push((data.sources as IDataObject[]) || []);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown operation ${operation} for ${resource}`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [out];
	}
}
