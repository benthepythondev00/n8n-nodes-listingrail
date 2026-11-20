import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IPollFunctions,
} from 'n8n-workflow';

type Context = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export async function listingrailRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('listingrailApi');
	const baseUrl = String(credentials.baseUrl || 'https://listingrail.com').replace(/\/$/, '');
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		json: true,
		headers: { Accept: 'application/json' },
	};
	if (body !== undefined) options.body = body;
	if (qs !== undefined) options.qs = qs;
	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'listingrailApi',
		options,
	)) as IDataObject;
}

/** Drops empty and unset values, so an empty filter is not sent as 0 or "". */
export function dropEmpty(obj: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v !== undefined && v !== null && v !== '') out[k] = v;
	}
	return out;
}

export async function getSources(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const data = await listingrailRequest.call(this, 'GET', '/v1/sources');
	const sources = (data.sources as IDataObject[]) || [];
	return sources.map((s) => ({
		name: `${s.source} (${((s.countries as string[]) || []).join(', ')}; ${((s.kinds as string[]) || []).join(', ')})`,
		value: s.source as string,
		description: s.location as string,
	}));
}

export async function getMonitors(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const data = await listingrailRequest.call(this, 'GET', '/v1/monitors');
	const monitors = (data.monitors as IDataObject[]) || [];
	return monitors.map((m) => ({
		name: `#${m.id} ${m.source}: ${m.location}`,
		value: m.id as number,
	}));
}
