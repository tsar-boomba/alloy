const textDecoder = new TextDecoder();

export type AlloyBodySource =
	| Uint8Array
	| string
	| object
	| ReadableStream<Uint8Array>;

const readStream = async (
	stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> => {
	const reader = stream.getReader();
	let finished = false;
	const chunks: Uint8Array[] = [];

	while (!finished) {
		const { value, done } = await reader.read();
		finished = done || !value;

		if (value) chunks.push(value);
	}

	return new Uint8Array(
		chunks.reduce<number[]>((arr, chunk) => {
			arr.push(...chunk);
			return arr;
		}, []),
	);
};

const isStream = (o: NonNullable<unknown>): o is ReadableStream<Uint8Array> => {
	return o.constructor === ReadableStream;
};

export class AlloyBody {
	#byteSource: Uint8Array | ReadableStream<Uint8Array>;
	#isStream = false;

	/**
	 * Create a body
	 * @param body Either a `Unit8Array`, `string`, a json serializable object, or a stream of bytes (`ReadableStream<Unit8Array>`)
	 */
	constructor(body: AlloyBodySource) {
		if (typeof body === 'string') {
			this.#byteSource = new TextEncoder().encode(body);
		} else if (body.constructor === Uint8Array) {
			this.#byteSource = body;
		} else if (body.constructor === ReadableStream) {
			this.#byteSource = body;
			this.#isStream = true;
		} else {
			this.#byteSource = new TextEncoder().encode(JSON.stringify(body));
		}
	}

	/** Returns if this body is backed by a stream */
	isStream() {
		return this.#isStream;
	}

	async text(): Promise<string> {
		return isStream(this.#byteSource)
			? textDecoder.decode(await readStream(this.#byteSource))
			: textDecoder.decode(this.#byteSource);
	}

	async json<T = any>(): Promise<T> {
		return isStream(this.#byteSource)
			? (JSON.parse(
				textDecoder.decode(await readStream(this.#byteSource)),
			) as T)
			: (JSON.parse(textDecoder.decode(this.#byteSource)) as T);
	}

	/** Be careful not to mutate the inner bytes with this, consumes stream if this is backed by one */
	async raw(): Promise<Uint8Array> {
		return isStream(this.#byteSource)
			? await readStream(this.#byteSource)
			: this.#byteSource;
	}

	/** Returns the `Unit8Array` backing this body, if backed by a stream this throws */
	rawAsBytes(): Uint8Array {
		if (isStream(this.#byteSource)) {
			throw new Error(
				'Cannot get Unit8Array from stream backed body, use `rawAsStream` instead.',
			);
		}
		return this.#byteSource;
	}

	/** Returns the `ReadableStream<Unit8Array>` backing this body, if backed by a Unit8Array this throws */
	rawAsStream(): ReadableStream<Uint8Array> {
		if (!isStream(this.#byteSource)) {
			throw new Error(
				'Cannot get ReadableStream from array backed body, use `rawAsBytes` instead.',
			);
		}
		return this.#byteSource;
	}

	source(): Uint8Array | ReadableStream<Uint8Array> {
		return this.#byteSource;
	}
}
