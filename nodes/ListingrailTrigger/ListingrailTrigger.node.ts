import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { getMonitors, listingrailRequest } from '../Listingrail/GenericFunctions';
import { itemsFor, shouldEmit, type Event } from './changes';

export class ListingrailTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Listingrail Trigger',
		name: 'listingrailTrigger',
		icon: { light: 'file:listingrail.svg', dark: 'file:listingrail.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description:
			'Starts the workflow when a Listingrail monitor finds new listings or price drops',
		defaults: { name: 'Listingrail Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'listingrailApi', required: true }],
		properties: [
			{
				displayName:
					'Listingrail checks each monitor once a day (06:20 UTC). Polling every hour is enough; polling uses no credits. Create the monitor on listingrail.com/monitors/ or with the Listingrail node.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Monitor Name or ID',
				name: 'monitorId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getMonitors' },
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'New Listing',
						value: 'newListing',
						description: 'A listing the monitor had not seen before',
					},
					{
						name: 'Price Drop',
						value: 'priceDrop',
						description: 'A listing whose price went down since the previous check',
					},
				],
				default: 'newListing',
			},
			{
				displayName: 'Include First Check',
				name: 'includeFirstCheck',
				type: 'boolean',
				default: false,
				description:
					'Whether to emit the first check of a new monitor, which reports every listing it finds as new',
			},
		],
	};

	methods = { loadOptions: { getMonitors } };

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const monitorId = String(this.getNodeParameter('monitorId'));
		const event = this.getNodeParameter('event') as Event;
		const includeFirstCheck = this.getNodeParameter('includeFirstCheck', false) as boolean;
		const manual = this.getMode() === 'manual';
		const state = this.getWorkflowStaticData('node');

		// one call: the monitor list carries each monitor's last check
		const data = await listingrailRequest.call(this, 'GET', '/v1/monitors');
		const monitor = ((data.monitors as IDataObject[]) || []).find(
			(m) => String(m.id) === monitorId,
		);
		if (!monitor) {
			throw new NodeOperationError(this.getNode(), `Monitor ${monitorId} was not found for this API key`);
		}
		const changes = (monitor.changes as IDataObject) || {};
		if (!shouldEmit(changes, state.lastCheckedAt as string | undefined, includeFirstCheck, manual)) {
			return null;
		}
		if (!manual) state.lastCheckedAt = changes.checked_at as string;

		const items = itemsFor(monitor, changes, event);
		if (!items.length) return null;
		return [this.helpers.returnJsonArray(items)];
	}
}
