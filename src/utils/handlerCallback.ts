import { AlloyRequest, AlloyResponse, Handler, RawReq, RawRes } from '../Alloy.ts';
import { AlloyBody } from '../Body.ts';
import { jsonBuffer } from './jsonBuffer.ts';
import { PollFn, promiseResult, queryablePromise } from './queryablePromise.ts';

/**
 * Crate an async callback pointer
 *
 * rust type: `Option<extern "C" fn(req: *const u8) -> Option<extern "C" fn() -> *const u8>>`
 * @param fn Function which returns promise
 * @returns Pointer to callback which returns function to poll promise
 */
export const handlerCallback = (fn: Handler['handler']) => {
	const ptr = new Deno.UnsafeCallback(
		{
			parameters: ['buffer', 'u32'],
			result: 'function',
		} as const,
		(reqPtr, len) => {
			const rawReq = new Uint8Array(
				Deno.UnsafePointerView.getArrayBuffer(reqPtr, len)
			);
			const req: RawReq = JSON.parse(new TextDecoder().decode(rawReq));
			const finalReq: AlloyRequest = {
				...req,
				headers: new Headers(req.headers),
				body: req.body ? new AlloyBody(new Uint8Array(req.body)) : undefined,
			};

			const result = fn(finalReq);

			// called whenever rust side polls promise
			const pollFn: PollFn<AlloyResponse | void> = ({ value, fulfilled, rejected }) => {
				if (fulfilled) {
					const res = value ?? { status: 200 };
					const rawRes: RawRes = {
						...res,
						body: res.body ? new AlloyBody(res.body) : undefined,
						headers: res.headers ? [...new Headers(res.headers)] : undefined,
					};

					if (rawRes.body) {
						const body = rawRes.body;
						if (!body.isStream()) {
							return jsonBuffer(
								promiseResult('Fulfilled', {
									...rawRes,
									body: { t: 'Bytes', c: Array.from(body.rawAsBytes()) },
								})
							);
						} else {
							// backed by stream, do some extra stuff to get it pollable by rust
							const stream = body.rawAsStream();
							const reader = stream.getReader();

							const read = () => {
								const chunkPromise = reader.read();
								const queryable = queryablePromise(
									chunkPromise,
									({ value, fulfilled, rejected }) => {
										if (fulfilled && value) {
											// received chunk from stream
											const { done, value: chunk } = value;
											return jsonBuffer(
												promiseResult('Fulfilled', {
													done,
													value: chunk ? Array.from(chunk) : undefined,
												})
											);
										} else if (fulfilled) {
											return jsonBuffer(
												promiseResult(
													'Rejected',
													'Read call fulfilled without value.'
												)
											);
										} else if (rejected) {
											return jsonBuffer(
												promiseResult(
													'Rejected',
													rejected?.toString() ?? 'Unknown error'
												)
											);
										} else {
											return jsonBuffer('');
										}
									}
								);

								const readPollPtr = new Deno.UnsafeCallback(
									{ parameters: [], result: 'buffer' } as const,
									queryable.poll
								);

								return readPollPtr.pointer;
							};

							const readFnPointer = new Deno.UnsafeCallback(
								{ parameters: [], result: 'function' } as const,
								read
							);

							return jsonBuffer(
								JSON.stringify({
									...rawRes,
									// NOTE: might need to send ptr as string if a bigint
									body: { t: 'Stream', c: readFnPointer.pointer },
								})
							);
						}
					} else {
						return jsonBuffer(promiseResult('Fulfilled', res));
					}
				} else if (rejected) {
					return jsonBuffer(
						promiseResult('Rejected', rejected?.toString() ?? 'Unknown error')
					);
				} else {
					return jsonBuffer('');
				}
			};

			const queryable =
				result?.constructor === Promise
					? queryablePromise(result, pollFn)
					: queryablePromise(Promise.resolve(result), pollFn);

			const pollPtr = new Deno.UnsafeCallback(
				{
					parameters: [],
					result: 'buffer',
				} as const,
				queryable.poll
			);

			return pollPtr.pointer;
		}
	);

	return ptr;
};
