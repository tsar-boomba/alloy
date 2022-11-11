import { jsonBuffer } from './jsonBuffer.ts';

export type PollFn<T> = ({
	value,
	rejected,
	fulfilled,
}: {
	value?: T;
	rejected: unknown;
	fulfilled: boolean;
}) => Uint8Array;

export interface QueryablePromise<T> extends Promise<T> {
	isFulfilled: () => boolean;
	isRejected: () => boolean;
	isPending: () => boolean;
	// string which is either `{"value":T}`|`{"error":string}`
	poll: () => Uint8Array;
}

const isQueryablePromise = <T>(p: Promise<T>): p is QueryablePromise<T> =>
	'isFulfilled' in p;

export const promiseResult = (
	result: 'Fulfilled' | 'Rejected',
	c: any,
): string => JSON.stringify({ t: result, c });

/**
 * This function allow you to modify a JS Promise by adding some status properties.
 * Based on: http://stackoverflow.com/questions/21485545/is-there-a-way-to-tell-if-an-es6-promise-is-fulfilled-rejected-resolved
 * But modified according to the specs of promises : https://promisesaplus.com/
 */
export const queryablePromise = <T>(
	promise: Promise<T>,
	pollFn?: PollFn<T>,
): QueryablePromise<T> => {
	// Don't modify any promise that has been already modified.
	if (isQueryablePromise(promise)) return promise;

	// Set initial state
	let isPending = true;
	let rejection: unknown;
	let isFulfilled = false;
	let value: T;

	// Observe the promise, saving the fulfillment in a closure scope.
	const result = promise.then(
		function (v) {
			isFulfilled = true;
			isPending = false;
			value = v;
			return v;
		},
		function (e) {
			rejection = e;
			isPending = false;
		},
	) as QueryablePromise<T>;

	result.isFulfilled = () => isFulfilled;
	result.isPending = () => isPending;
	result.isRejected = () => rejection !== undefined;
	result.poll = pollFn
		? () => pollFn({ value, fulfilled: isFulfilled, rejected: rejection })
		: () => {
			if (isFulfilled) {
				return jsonBuffer(promiseResult('Fulfilled', value ?? null));
			} else if (rejection !== undefined) {
				return jsonBuffer(
					promiseResult('Rejected', rejection?.toString() ?? 'Unknown error'),
				);
			} else {
				return jsonBuffer('');
			}
		};
	return result;
};
