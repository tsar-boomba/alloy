import { start } from '../bindings.ts';
import { handlerCallback } from './utils/handlerCallback.ts';
import { AlloyBody, AlloyBodySource } from './Body.ts';

type RouteOptions = {
	body?: boolean;
};

export type Handler = {
	handler: (
		req: AlloyRequest,
	) => Promise<void | AlloyResponse> | void | AlloyResponse;
} & RouteOptions;

type ServerHandler = { pointer: bigint } & RouteOptions;

type RouteHandlers = {
	get?: Handler;
	post?: Handler;
	delete?: Handler;
	put?: Handler;
	options?: Handler;
	trace?: Handler;
	patch?: Handler;
	head?: Handler;
};

export type Server = {
	routes: Record<
		string,
		{
			get?: ServerHandler;
			post?: ServerHandler;
			delete?: ServerHandler;
			put?: ServerHandler;
			options?: ServerHandler;
			trace?: ServerHandler;
			patch?: ServerHandler;
			head?: ServerHandler;
		}
	>;
};

/** Request object as received from rust backend */
export type RawReq = {
	pathname: string;
	query: Record<string, string>;
	headers: [string, string][];
	params: Record<string, string>;
	body?: number[];
};

export type AlloyRequest = {
	pathname: string;
	query: Record<string, string>;
	headers: Headers;
	params: Record<string, string>;
	body?: AlloyBody;
};

export type AlloyResponse = {
	status?: number;
	headers?: HeadersInit;
	body?: AlloyBodySource;
};

/** Res type rust is expecting */
export type RawRes = {
	status?: number;
	headers?: [string, string][];
	body?: AlloyBody;
};

export class Alloy {
	#routes: Record<string, RouteHandlers> = {};

	constructor() {}

	#route(route: string, method: keyof RouteHandlers, handler: Handler): this {
		if (route in this.#routes) {
			this.#routes[route][method] = handler;
		} else {
			this.#routes[route] = { [method]: handler };
		}
		return this;
	}

	get(route: string, options: RouteOptions, handler: Handler['handler']): this;
	get(route: string, handler: Handler['handler']): this;
	get(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'get', opts);
	}

	post(route: string, options: RouteOptions, handler: Handler['handler']): this;
	post(route: string, handler: Handler['handler']): this;
	post(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'post', opts);
	}

	put(route: string, options: RouteOptions, handler: Handler['handler']): this;
	put(route: string, handler: Handler['handler']): this;
	put(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'put', opts);
	}

	delete(
		route: string,
		options: RouteOptions,
		handler: Handler['handler'],
	): this;
	delete(route: string, handler: Handler['handler']): this;
	delete(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'delete', opts);
	}

	patch(
		route: string,
		options: RouteOptions,
		handler: Handler['handler'],
	): this;
	patch(route: string, handler: Handler['handler']): this;
	patch(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'patch', opts);
	}

	options(
		route: string,
		options: RouteOptions,
		handler: Handler['handler'],
	): this;
	options(route: string, handler: Handler['handler']): this;
	options(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'options', opts);
	}

	trace(
		route: string,
		options: RouteOptions,
		handler: Handler['handler'],
	): this;
	trace(route: string, handler: Handler['handler']): this;
	trace(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'trace', opts);
	}

	head(route: string, options: RouteOptions, handler: Handler['handler']): this;
	head(route: string, handler: Handler['handler']): this;
	head(
		route: string,
		options: RouteOptions | Handler['handler'],
		handler?: Handler['handler'],
	) {
		const opts: Handler = typeof options === 'function'
			? { handler: options }
			: { ...options, handler: handler! };
		return this.#route(route, 'head', opts);
	}

	startServer() {
		// turn handlers into pointers etc
		const server: Server = {
			routes: Object.fromEntries(
				Object.entries(this.#routes).map(([route, handlers]) => {
					const handlerPointers = Object.fromEntries(
						Object.entries(handlers).map<[string, ServerHandler]>(
							([method, { handler, ...options }]) => {
								const ptr = handlerCallback(handler);
								ptr.ref();
								return [method, { pointer: ptr.pointer, ...options }];
							},
						),
					);
					return [route, handlerPointers];
				}),
			),
		};
		start(server);
	}
}
