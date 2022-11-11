const textEncoder = new TextEncoder();

/**
 * Creates a buffer where chars up to `{` are the length of the json
 * @param json json string
 */
export const jsonBuffer = (json: string) => {
	const valueLength = json.length;

	if (valueLength === 0) return new Uint8Array([0]);

	const valueLengthString = valueLength.toString();
	const buffer = new Uint8Array(json.length + valueLengthString.length);
	buffer.set(textEncoder.encode(valueLengthString));
	// [1,0,0,{,",t,"]
	// [0,1,2,3,4]
	//        ^ start adding the value here (valueLengthString.length)
	buffer.set(textEncoder.encode(json), valueLengthString.length);
	return buffer;
};
